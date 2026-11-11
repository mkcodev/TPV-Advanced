# Paso 1 — Instalar el TPV en un bar real sin seed

> **Estado:** PR-1 (#39, empleados + `db:bootstrap`) mergeado. PR-2 (#40, terminales) mergeado. PR-3 (#36, líneas fijadas + anulación con PIN de encargado + migración 0008) en revisión. Este documento es el plan aprobado; las desviaciones se anotan en cada PR.

## Contexto

`main` en 43e4888 (Paso 0.5 cerrado). Hoy solo se puede usar el TPV con `pnpm db:seed`: no hay alta de negocio, ni gestión de empleados, ni de terminales en el admin, y la anulación de líneas no tiene control de rol. Objetivo: que el dueño monte el bar desde cero (negocio → empleados → vincular terminal) y que las acciones sensibles se validen en servidor.

## Lo que ya existe (se reutiliza)

| Pieza | Dónde |
|---|---|
| Hash PIN argon2id, `hashPin`, `verifyPin`, `DUMMY_HASH_PROMISE` | `packages/api/src/auth/pin.ts` |
| Lockout (`checkLockout`, `applyPinFailure`, `applyPinSuccess`), rate-limit, `generatePairingCode`, `pairingCodeExpiresAt` (TTL 15 min, 8 dígitos) | `packages/core/src/auth/*` |
| `createPairingCode`, `pairDevice` (claim atómico de un solo uso), `employeeLogin`, `listEmployees`, `revokeDevice` | `packages/api/src/routers/auth.ts` |
| `managerProcedure`, `adminProcedure`, `getEmployeeRole` (rol leído de BD) | `packages/api/src/procedures.ts` |
| `logAuthEvent` → `system_events` (append-only) | `packages/api/src/auth/events.ts` |
| `createEmployeeSchema` | `packages/validators/src/index.ts` |
| Columnas `order_items.status / sent_to_kitchen_at / voided_reason / voided_by` (sin usar) | `packages/db/src/schema/orders.ts` |
| Z con `byEmployee` (cobrado + propinas por empleado y sesión) | `routers/cash-session.ts` `getZReport` |
| Pantalla de vincular con modo "pegar token" ya tras `NODE_ENV === 'development'` | `components/tpv/auth/device-pairing-screen.tsx` |

## Respuestas a las preguntas

- **PIN duplicados:** no hace falta garantizarlo. El login es "elige empleado + PIN" (`employeeLoginSchema` lleva `employeeId`). Con hash argon2 con sal no se podría imponer con un índice UNIQUE; comprobarlo obligaría a verificar el PIN contra todos los hashes del negocio. No se hace.
- **¿Existen anular-línea-enviada y descuentos hoy?** No.
  - Anular: no hay endpoint. Peor: `reconcileLines` en `orders.upsert` **borra** (DELETE) cualquier línea que falte en el input, aunque ya se haya enviado a cocina, y cualquier worker puede bajar cantidades. Además `markLinesSent` solo escribe un evento: nunca rellena `status` ni `sent_to_kitchen_at`. PR-3 lo arregla.
  - Descuentos: no hay endpoint (solo columnas). **Aplazado** (decisión tuya): se crea el issue "Descuentos e invitaciones (antes de instalar en el bar real)" con etiqueta `paso-1`. Sin endpoint, nadie puede descontar, así que el permiso se cumple solo.
- **Ventas por empleado del día:** cubierto por el informe Z (`byEmployee`). Un bar, una caja, una sesión al día. Sin trabajo extra (supuesto por defecto: la pregunta quedó sin respuesta explícita; dímelo si quieres la vista admin).
- **Migración:** una, en PR-3: `0008` con el CHECK de anulación (aprobada; SQL abajo). Ninguna otra.

## Paso previo (GitHub, sin código)

1. Issue "Descuentos e invitaciones (antes de instalar en el bar real)", etiqueta `paso-1` (crear la etiqueta si no existe con `gh label create paso-1`).
2. Issue "Cocina: ticket de ANULACIÓN al anular una línea enviada (Fase 2, ESC/POS)", etiqueta `mejora` (crearla si no existe). Es un issue aparte, no va dentro del de descuentos.
3. Un issue por PR (PR-1, PR-2, PR-3). Una rama por issue desde `main`: `feat/paso1-employees`, `feat/paso1-devices`, `feat/paso1-void-line`.

## Flujo por PR

Para cada PR: commits pequeños → push → abrir PR con `Closes #N` → esperar CI verde → **PARAR** y entregar la lista de prueba en navegador. El merge lo hace el usuario cuando confirme; no se empieza el PR siguiente hasta entonces. En PR-3 hay una parada extra antes de `pnpm db:migrate`: se enseña el `.sql` generado.

## Orden de los PRs

PR-1 (empleados + alta de negocio) → PR-2 (terminales) → PR-3 (anulación con PIN de encargado). PR-2 depende de PR-1 solo por `panelAdminProcedure`. PR-3 es independiente, pero va último porque toca `orders.ts` y el store de la comanda (más riesgo).

---

## PR-1 — Empleados en el admin + alta de negocio sin seed

### Archivos, en orden
0. `packages/core/src/auth/roles.ts` (+ `roles.test.ts`): `isManagerOrAbove(role)` y `hasActiveApprover(employees)` (true si hay al menos un empleado activo con rol manager o admin). Se adelanta de PR-3 a PR-1 porque el aviso del punto 7 lo usa. `procedures.ts` reutiliza `isManagerOrAbove`.
1. `packages/api/src/procedures.ts` — nuevo `panelAdminProcedure` = `adminProcedure` + `ctx.auth.kind === 'admin'`. Así solo gestiona personal el dueño o admin del panel (owner/admin), nunca un terminal. Hoy `createPairingCode` repite esa comprobación a mano; en PR-2 pasa a usar este procedure.
2. `packages/validators/src/index.ts` — `updateEmployeeSchema` (`id`, `name?`, `role?`), `setEmployeePinSchema` (`id`, `pin` 4–6 dígitos), `setEmployeeActiveSchema` (`id`, `isActive`). Ninguno lleva `businessId`. Foto: fuera de alcance; el TPV muestra iniciales (`avatarUrl` sigue null).
3. `packages/api/src/auth/events.ts` — añadir tipos `employee_created`, `employee_updated`, `employee_pin_changed`, `employee_deactivated`, `employee_reactivated`. El payload nunca lleva el PIN.
4. `packages/api/src/routers/employees.ts` (nuevo, patrón `catalog.ts`), todo con `panelAdminProcedure` y filtrado por `ctx.businessId`:
   - `list`: id, name, role, isActive, lockedUntil, createdAt. **Nunca** `pinHash`.
   - `create`: `hashPin` y luego insert, más evento.
   - `update`: patch campo a campo (name, role), con un test por campo (regla CLAUDE.md §6).
   - `setActive`: desactivar, nunca borrar. No hay endpoint de borrado.
   - `setPin`: `hashPin`, y además resetea `failedPinAttempts=0` y `lockedUntil=null` (sirve también para desbloquear).
   - Si `UPDATE … WHERE id AND business_id` devuelve 0 filas: `NOT_FOUND`.
5. `packages/api/src/routers/root.ts` — registrar `employees`.
6. `packages/api/src/auth/resolver.ts` — hoy una sesión PIN de 12 h sigue valiendo aunque el empleado se desactive. Cambio: verificar primero el JWT (sin BD), luego **una sola consulta** `devices LEFT JOIN employees ON id = session.employeeId AND business_id = device.business_id AND is_active`. Si no hay empleado, `employeeId = null`. Se mantiene un viaje a BD por petición.
7. `apps/web/src/components/admin/employees/employees-panel.tsx`, `employee-form-dialog.tsx` (patrón `category-form-dialog.tsx`), `employee-pin-dialog.tsx`. Estados: activo / desactivado / bloqueado hasta HH:MM. **Aviso visible** arriba del panel (componente de alerta del DS, tono de advertencia) cuando `hasActiveApprover(list)` es false: "No hay ningún encargado activo: nadie podrá autorizar anulaciones". Se recalcula al crear, editar o desactivar.
8. `apps/web/src/app/(admin)/admin/(shell)/employees/page.tsx`.
9. `apps/web/src/lib/admin/nav-config.ts` — `employees` pasa a `status: 'ready'`.
10. `apps/web/messages/es.json` — claves `admin.employees.*` (incluidos los roles worker/manager/admin explicados en una línea).
11. `packages/db/scripts/bootstrap-business.ts` + script `db:bootstrap` (raíz y `packages/db/package.json`). Argumentos: `--email` (usuario ya creado en Supabase Auth desde el dashboard), `--org`, `--business`, `--tax-id`, `--legal-name`, `--address`. Crea `users` (si falta), `organizations`, `businesses` y `memberships(owner)`. **Sin datos demo, no borra nada.** Aborta si ese usuario ya es dueño de un negocio con el mismo NIF. Lo único que imprime es el `businessId`.
12. Docs: `CLAUDE.md` §4 (router employees, procedure, script), `docs/AUTH-DEVICES.md` (por qué no hay unicidad de PIN; gestión solo desde panel), `docs/PASOS-A-SEGUIR.md`.

### Tests (PR-1)
| Archivo | Caso |
|---|---|
| `core/auth/roles.test.ts` | `isManagerOrAbove`: worker false, manager/admin true. `hasActiveApprover`: lista vacía → false; solo workers → false; manager desactivado → false; un manager o admin activo → true |
| `employees-router.test.ts` (patrón `queuedDb`, `hashPin` mockeado) | `list` no devuelve `pinHash`; WHERE con `ctx.businessId` |
| 〃 | `create` guarda hash ≠ PIN; evento sin PIN en el payload |
| 〃 | `update`: un test por campo (`name`, `role`) que llega al SET |
| 〃 | `update` / `setActive` / `setPin` sobre un empleado de otro negocio dan `NOT_FOUND` (aislamiento) |
| 〃 | `businessId` colado en el input se ignora (el WHERE usa el de ctx) |
| 〃 | Terminal (incluido un empleado con rol admin) → `FORBIDDEN`; membership `staff` → `FORBIDDEN` |
| 〃 | `setPin` resetea `failedPinAttempts` y `lockedUntil` |
| `resolver.test.ts` | Sesión de empleado desactivado → `employeeId null`; empleado de otro negocio → `null`; activo → ok |
| `auth-router.test.ts` | `employeeLogin` sigue verde (sin cambios) |

### Riesgos (PR-1)
- Confusión entre el rol `admin` de empleado (TPV) y la membership owner/admin (panel): se explica en la UI con un texto de ayuda.
- Desactivar a alguien con comandas abiertas: las comandas conservan `employee_id`, sin problema. Su sesión cae en la siguiente petición.
- Script de bootstrap contra producción: no borra nada y exige argumentos explícitos. Revisarlo antes de ejecutarlo.

### Probar en navegador (PR-1)
1. `/admin/employees` → crear "Ana" (worker, PIN 1234) y "Luis" (manager).
2. Editar a Ana: cambiar el rol a manager y luego volver a worker. Se ve en la lista.
3. En el TPV: Ana entra con su PIN. Fallar 5 veces con Luis: aparece "bloqueado hasta HH:MM".
4. Admin → Luis → cambiar PIN. Queda desbloqueado y entra con el PIN nuevo.
5. Desactivar a Ana con su sesión abierta en el TPV. La siguiente acción la saca al selector y ya no aparece en él.
6. Desactivar a Luis (el único encargado): aparece el aviso "nadie podrá autorizar anulaciones". Reactivarlo: el aviso desaparece.

---

## PR-2 — Terminales en el admin

### Archivos, en orden
1. `packages/api/src/routers/auth.ts`:
   - `createPairingCode` pasa a `panelAdminProcedure` (se quita la comprobación manual). **Fix de colisión:** antes de insertar, comprobar que no haya otro código activo igual (`used_at IS NULL AND expires_at > now()`) en ningún negocio; si lo hay, regenerar (hasta 3 intentos). Hoy `pairDevice` hace `UPDATE … WHERE code = $1` sin acotar: con dos códigos iguales activos marcaría los dos y el terminal podría quedar vinculado al negocio equivocado.
   - `pairDevice`: el claim pasa a una sola fila: `WHERE id = (SELECT id FROM pairing_codes WHERE code=$1 AND used_at IS NULL AND expires_at > now() LIMIT 1 FOR UPDATE SKIP LOCKED)`.
   - Nuevo `listDevices` (`panelAdminProcedure`): id, name, type, isActive, lastSeenAt, createdAt. **Nunca** `deviceTokenHash`.
   - `revokeDevice` pasa a `panelAdminProcedure`.
   - TTL: se queda en 15 min (`PAIRING_CODE_TTL_MS`, según AUTH-DEVICES). Un solo uso: ya lo garantiza el claim atómico.
2. `apps/web/src/components/admin/devices/devices-panel.tsx` (lista: activo/revocado, "visto hace X") y `revoke-device-dialog.tsx` (confirmación; avisa si puede tener una caja abierta).
3. `apps/web/src/components/admin/devices/pairing-code-dialog.tsx`: nombre + tipo; luego muestra el código en grande con cuenta atrás hasta `expiresAt` y el aviso "un solo uso".
4. `apps/web/src/app/(admin)/admin/(shell)/devices/page.tsx` + `nav-config.ts` (`devices` pasa a ready).
5. `apps/web/src/components/tpv/auth/device-pairing-screen.tsx`: el modo "pegar token" ya está solo en desarrollo (Next sustituye `NODE_ENV` al compilar, así que en producción el código desaparece). Arreglar el placeholder en español fijo (debe ir por i18n) y cambiar los valores arbitrarios (`min-h-[44px]`, `tracking-[0.5em]`) por tokens del DS.
6. Cliente TPV: si una petición con device token responde `UNAUTHORIZED` por dispositivo revocado, limpiar `use-device-store` y volver a la pantalla de vincular. Verificar el comportamiento actual en `tpv-auth-gate.tsx`; si ya lo hace, no se toca.
7. `es.json` (`admin.devices.*`), `CLAUDE.md` §4, `docs/AUTH-DEVICES.md`.

### Tests (PR-2)
| Archivo | Caso |
|---|---|
| `auth-router.test.ts` | `listDevices` no expone `deviceTokenHash`; WHERE con `ctx.businessId`; terminal → `FORBIDDEN` |
| 〃 | `createPairingCode` regenera si choca con un código activo; guarda el `businessId` de ctx |
| 〃 | `pairDevice`: código ya usado o caducado → `NOT_FOUND`; el claim afecta a 1 fila; rate-limit → `TOO_MANY_REQUESTS` |
| 〃 | `revokeDevice` de un dispositivo de otro negocio → `NOT_FOUND` (aislamiento) |
| `resolver.test.ts` | Token de un dispositivo revocado (`hash null`, `isActive false`) → `anonymous` |

### Riesgos (PR-2)
- Revocar un terminal con la caja abierta deja la sesión abierta, y `close` va por dispositivo. Solo se avisa en el diálogo; el cierre remoto de caja queda fuera de alcance.
- Si el reloj del navegador va mal, la cuenta atrás sale mal. Se calcula desde el `expiresAt` del servidor y el servidor manda.

### Probar en navegador (PR-2)
1. `/admin/devices` → "Vincular terminal" (Caja, pos_terminal). Sale el código con la cuenta atrás.
2. En otro navegador o incógnito, `/tpv` → meter el código. Queda vinculado y sale el selector de empleados.
3. Reutilizar el mismo código en una tercera ventana: error "código no válido o caducado".
4. El admin ve el terminal nuevo con "visto hace unos segundos".
5. Revocar → el TPV vuelve a la pantalla de vincular en la siguiente acción.
6. Con `pnpm build && pnpm start`, el bloque "pegar token" no aparece.

---

## PR-3 — Líneas fijadas al guardar + anulación con PIN de encargado

### Estado: no hace falta uno nuevo
El esquema ya tiene `pending | sent | preparing | ready | served | cancelled`. La línea queda **fijada en cuanto existe en BD**, es decir, desde el primer `orders.upsert` que la persiste. Ese upsert lo disparan "Guardar", el guardado optimista al volver al plano y el envío a cocina (que guarda antes de marcar). Con eso:
- **Solo en el cliente, sin guardar** (no existe fila): se edita libremente.
- **`pending` en BD** = guardada, aún no enviada. **Fijada**. Pasa con todas, tenga o no `print_destination` (las cañas de barra incluidas).
- **`sent`** (+ `sent_to_kitchen_at`) = enviada a cocina/barra. Fijada.
- **`cancelled`** = anulada. Nunca se borra (es auditoría) y no cuenta en totales, cobro ni cocina.

No se añade ningún valor al enum, así que el CHECK `order_items_status_check` no cambia. "Fijada" = `status <> 'cancelled'` y la fila existe.

### Reglas
- Línea fijada: el upsert **rechaza** quitarla o bajar su cantidad (`FORBIDDEN`, `LINE_LOCKED_USE_VOID`). Solo se puede anular con `orders.voidLine`.
- Subir la cantidad de una línea `pending` guardada está permitido (solo suma). En una línea `sent` se rechaza: lo nuevo no ha ido a cocina, así que el cliente crea una línea nueva.
- `voidLine` vale para cualquier línea fijada (`pending` o `sent`). Lo autoriza un encargado (manager/admin) con su PIN en ese momento. Si quien está logueado ya es manager o superior, el aprobador es él mismo y no se pide PIN.

### Archivos, en orden
1. (`isManagerOrAbove` ya existe desde PR-1 en `packages/core/src/auth/roles.ts`.)
2. `packages/api/src/auth/verify-employee-pin.ts`: extraer de `employeeLogin` el bloque rate-limit → carga del empleado (negocio + activo) → dummy hash → lockout → fallo/éxito con eventos. Lo usan `employeeLogin` (refactor sin cambio de comportamiento) y `voidLine`.
3. `packages/validators/src/index.ts`: `voidLineSchema` = `orderId`, `lineId`, `reason` (1–200, obligatorio), `approverEmployeeId?`, `approverPin?` (los dos o ninguno).
4. `packages/api/src/routers/orders.ts`:
   - `markLinesSent`: además del evento, `UPDATE order_items SET status='sent', sent_to_kitchen_at=now() WHERE id IN (…) AND order_id=… AND status='pending'`.
   - `reconcileLines`: **ya no borra nunca**. Si una línea existente no `cancelled` falta del input → `FORBIDDEN` (`LINE_LOCKED_USE_VOID`). Si su cantidad baja → `FORBIDDEN`. Si es `sent` y su cantidad sube → `BAD_REQUEST`. Las `cancelled` se ignoran tanto si vienen en el input como si faltan. La comprobación va **antes** de cualquier escritura: si algo falla, la transacción no toca nada.
   - `applyTotals`, `pay` y `getKitchenPayload`: filtrar con `ne(status, 'cancelled')`.
   - `mapItem`: añadir `status` y `sentToKitchenAt`.
   - Nuevo `voidLine` (`deviceProcedure`, empleado logueado obligatorio, en `withBusinessContext`):
     1. `SELECT … FOR UPDATE` de la comanda (negocio de ctx, estado `open`).
     2. La línea pertenece a la comanda y no está `cancelled`.
     3. Resolver el aprobador con `verify-employee-pin`: mismo negocio, activo, `isManagerOrAbove`. Un PIN fallido cuenta para su lockout.
     4. `UPDATE order_items SET status='cancelled', voided_reason, voided_by=<aprobador>`.
     5. `order_events` `item_voided` con `employee_id` = **quien lo pide** (el logueado) y payload `{ lineId, reason, approvedBy, nameSnapshot, quantity, lineTotalCents }`.
     6. `applyTotals`; devuelve la comanda igual que `upsert`.
5. `apps/web/src/lib/stores/use-order-store.ts`: la línea lleva `status` y `persisted` (true cuando viene del servidor). Añadir un producto se fusiona con una línea no guardada o con una `pending` guardada, nunca con una `sent`. `decrementLine` y `removeLine` no hacen nada sobre líneas `persisted`. Los totales optimistas excluyen `cancelled`. Tras cada respuesta de `upsert`/`voidLine`, el store se hidrata con las líneas del servidor (`tpv-order-hydrator.tsx`).
6. `apps/web/src/components/tpv/tpv-order-line.tsx`: una línea guardada muestra un candado e insignia "Guardada" o "En cocina"; tiene "+" (solo si es `pending`) y "Anular" (≥44 px), sin −/×. Una anulada sale tachada, con el motivo.
7. `apps/web/src/components/tpv/tpv-void-line-dialog.tsx` (nuevo): motivos rápidos (error del camarero, cliente lo rechaza, producto agotado) + texto libre; selector de encargado (`auth.listEmployees` filtrado por rol) + teclado PIN. Reutilizar el teclado de `employee-login-screen.tsx`; si está embebido, extraerlo a un componente.
8. `es.json` (`tpv.void.*`), `docs/AUTH-DEVICES.md` §3 (anular = PIN de encargado al momento), `docs/DATABASE-SCHEMA.md` (transiciones de `order_items.status`), `CLAUDE.md` §4.

### Migración (aprobada) — `0008_order_items_void_check.sql`
**PARADA:** tras `pnpm db:generate` se enseña el `.sql` generado y se espera OK antes de `pnpm db:migrate`.

Antes, comprobar que no hay filas incompatibles:
```sql
SELECT count(*) FROM order_items
WHERE status = 'cancelled' AND (voided_reason IS NULL OR voided_by IS NULL);
```
Si da algo distinto de 0, se para y se consulta. Si da 0, se añade el `check()` en `schema/orders.ts` y `pnpm db:generate --name order_items_void_check`. SQL esperado:
```sql
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_voided_check"
  CHECK ("order_items"."status" <> 'cancelled'
         OR ("order_items"."voided_reason" IS NOT NULL AND "order_items"."voided_by" IS NOT NULL));
```
Sin RLS ni GRANT nuevos.

### Tests (PR-3)
| Archivo | Caso |
|---|---|
| `auth-router.test.ts` | `employeeLogin`: los tests actuales verdes tras el refactor |
| `orders-router.test.ts` | `markLinesSent` solo marca líneas `pending` de esa comanda |
| 〃 | **Línea guardada con `print_destination='none'` (`pending`, nunca enviada) → quitarla en el upsert da `FORBIDDEN`** y no se ejecuta ningún DELETE |
| 〃 | upsert: bajar una `pending` guardada → `FORBIDDEN`; subirla → ok; quitar una `sent` → `FORBIDDEN`; subir una `sent` → `BAD_REQUEST`; línea nueva en el input → INSERT; `cancelled` ausente del input → ni error ni DELETE |
| 〃 | upsert con fallo de fijado: ninguna escritura anterior (sin UPDATE/INSERT parciales) |
| 〃 | `voidLine`: worker sin aprobador → `FORBIDDEN`; aprobador worker → `FORBIDDEN`; PIN mal → `UNAUTHORIZED` + contador; aprobador bloqueado → `FORBIDDEN` |
| 〃 | `voidLine` aislamiento: aprobador de otro negocio → `UNAUTHORIZED`; comanda de otro negocio → `NOT_FOUND` |
| 〃 | `voidLine` sobre una `pending` guardada → ok; sobre una ya anulada → `BAD_REQUEST`; comanda no abierta → `PRECONDITION_FAILED` |
| 〃 | `voidLine` éxito: SET `cancelled` + `voided_by`=aprobador; evento con `employeeId`=solicitante y `approvedBy`+`reason`; manager logueado sin PIN → ok |
| `orders-pay.test.ts` | Los totales y el cobro excluyen las `cancelled` (invariante base+cuota = total) |

### Riesgos (PR-3)
- **Cocina no se entera de la anulación** (no hay ticket de "ANULADO"). Por ahora se avisa de palabra; va en su propio issue (`mejora`, Fase 2 ESC/POS).
- **Más fricción:** el guardado optimista al volver al plano fija las líneas. Un error de dedo ("3 cañas en vez de 2") ya guardado necesita encargado. `voidLine` anula la línea entera; la anulación parcial (por unidades) queda fuera. Si molesta en el bar, se abre un issue.
- El refactor de `employeeLogin` toca auth: los tests existentes son la red de seguridad.
- Cambio de costumbre: tras enviar, la misma caña sale en una línea nueva.

### Probar en navegador (PR-3)
Personas: Ana = admin (autoriza), Luis = manager, Bruno = camarero (PIN 5678).
1. Bruno abre una mesa y añade 2 cañas: antes de guardar, el −/× funciona.
2. Vuelve al plano (guarda) y entra de nuevo: las cañas tienen candado, sin −/×, y el + suma.
3. Añade una tapa y la envía a cocina. Otra tapa sale en una línea nueva, no se suma a la enviada.
4. Bruno anula la caña → motivo → elige a Luis → PIN mal: error. PIN bien: sale tachada y el total baja.
5. Bruno intenta anular la tapa eligiendo como aprobador a Bruno (o con su PIN): NO autoriza (solo salen encargados/admin; el servidor lo rechaza con FORBIDDEN).
6. Ana (admin) logueada anula la tapa enviada: no pide PIN.
7. Cobrar: el ticket y el Z no incluyen lo anulado.

---

## Verificación global (cada PR)
`pnpm lint && pnpm typecheck && pnpm test` en local → push → CI verde → **PARAR** con la lista de navegador; el merge lo hace el usuario. En PR-3: enseñar el `.sql` y esperar OK → `pnpm db:migrate` en dev → repetir la SELECT de control.
