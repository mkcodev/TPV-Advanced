# Paso 0.5 — Pulido del TPV antes de Veri*factu

Plan aprobado el 2026-11-09. Cuatro PRs encadenados (A → B → C → D). Cada uno sale de `main`, cierra sus issues con `Closes #N` y pasa lint, typecheck y test antes del push.

Etiqueta de los issues: `paso-0.5`. Las mejoras que quedan fuera (editor de mesas #15, informe Z #16, plantillas #17) llevan la etiqueta `mejora`.

## Decisiones aprobadas

| Decisión | Resultado |
|---|---|
| D-schema1 | Columna nueva `businesses.blind_cash_close boolean NOT NULL DEFAULT true` (PR-C). |
| D-schema2 | Columna nueva `orders.bill_requested_at timestamptz NULL` (PR-D), con las reglas de más abajo. |
| D1 | Navegación TPV ↔ admin con enlaces simples. No se toca la autenticación. |
| D3 | El ajuste de cierre ciego se edita en una página mínima `/admin/settings`. |
| PR-D | El plano se refresca con `refetchInterval` de 15 s y `refetchOnWindowFocus`. |

### Reglas de `bill_requested_at` (D-schema2)

- "Pedir cuenta" fija `bill_requested_at` en una comanda abierta. Es idempotente.
- Añadir líneas a una comanda con `bill_requested_at` lo pone otra vez a `NULL`: la mesa vuelve a "ocupada".
- Al cobrar la comanda del todo, la comanda pasa a `paid` y la mesa queda libre.
- Un pago parcial no toca `bill_requested_at`: la comanda sigue abierta y pendiente de cobro.
- Quitar o anular líneas no lo resetea. Solo lo resetea añadir líneas o subir cantidades.
- `requestBill` en una comanda sin líneas devuelve `PRECONDITION_FAILED`.
- Todas estas reglas llevan test.
- `tables.status` es una caché que nadie escribe: el plano deriva el estado de la comanda abierta, no de ese campo.

### Límites de D1

El TPV entra con PIN y el admin con Supabase Auth. Un manager sin sesión de admin que pulse el enlace llegará a `/admin/login`. Un navegador sin emparejar llegará a la pantalla de vincular dispositivo. Un puente de sesión sería un cambio de autenticación (regla 10) y queda fuera.

## PR-A — Pulido sin riesgo

Cierra #10, #11, #12 y #13. Esquema de BD: no. Riesgo: bajo.

| Issue | Cambio | Archivos |
|---|---|---|
| #10 Prefijo "Mesa" duplicado | Los textos dejan de anteponer "Mesa" y se muestra el nombre tal cual. El seed llama a las mesas "Mesa 1…4". | `apps/web/messages/es.json` (`tpv.floor.tableLabel`, `orderContext`) |
| #11 Seed con zona y mesas | El seed crea la zona "Sala" y 4 mesas ("Mesa 1…4"). Crea solo lo que falta (por nombre) y solo resetea comandas y catálogo si el negocio demo no tiene ventas: una factura o un pago impide borrar las comandas. | `packages/db/scripts/seed.ts` |
| #12 Saludo | El saludo usa `users.full_name`; sin nombre, un saludo neutro. | `apps/web/src/app/(admin)/admin/(shell)/page.tsx`, `lib/admin/queries.server.ts`, `messages/es.json` |
| #13 Hidratación | `BreadcrumbSeparator` pasa a ser hermano de `BreadcrumbItem`. | `apps/web/src/components/admin/shell/breadcrumbs.tsx` |

Tests: el de breadcrumbs comprueba que no haya `li` dentro de `li`. El seed se verifica ejecutándolo.

## PR-B — Navegación y caja en el plano

Cierra #3, #4, #5 y #9. Esquema de BD: no. Riesgo: medio-bajo (el #9 toca el flujo de cobro).

| Issue | Cambio | Archivos |
|---|---|---|
| #3 Volver al plano desde barra | El botón de volver existe también en pedidos de barra. Hoy se oculta en dos sitios. | `tpv-header.tsx:28`, `floor/tpv-back-to-floor-button.tsx:47-48` |
| #4 Caja en el plano | El plano muestra el control de caja reutilizando `TpvCashChip`. | `app/tpv/page.tsx` o la cabecera del plano |
| #5 Navegación TPV ↔ admin | Enlace a `/admin` en el TPV para manager/admin y enlace a `/tpv` en el admin. Función pura `canAccessAdmin(role)`. | `tpv-employee-chip.tsx`, `tpv-header.tsx`, `admin/shell/user-menu.tsx` |
| #9 Aviso de caja cerrada | El aviso incluye un botón que abre la caja y deja seguir cobrando sin perder la comanda. | `payment/payment-dialog.tsx:119`, `payment/cash-panel.tsx`, `cash/open-cash-session-dialog.tsx` |

Tests: unitario de `canAccessAdmin`. Para el #9, el flujo "sin caja → abrir → seguir cobrando" si se puede probar sobre el store.

## PR-C — Cierre ciego y efectivo esperado

Cierra #14, #8 y #22. Esquema de BD: sí. Riesgo: alto (dinero, permisos y migración).

Hoy el interruptor de cierre ciego es solo cosmético: `cashSession.close` siempre calcula y devuelve el esperado. Mostrar el efectivo esperado en el chip a cualquiera anularía el cierre ciego, por eso los dos issues van juntos.

- Migración `0005` (arreglo, #22): el `.sql` del índice `cash_sessions_open_device_unique` no estaba en `meta/_journal.json` ni tenía snapshot, así que nunca se aplicó a la BD y el `CONFLICT` de `cashSession.open` no saltaba. Se regenera con drizzle-kit (solo el `CREATE UNIQUE INDEX … WHERE status = 'open'`). Se comprobó antes que no hay dos sesiones `open` por dispositivo.
- Migración `0006`: `ALTER TABLE "businesses" ADD COLUMN "blind_cash_close" boolean DEFAULT true NOT NULL;`. Los negocios existentes quedan en ciego. Se revierte con `DROP COLUMN` (primero se revierte el código, después la columna). No hay BD de staging: se aplica a la única BD, y es aditiva. No se ejecuta `pnpm db:migrate` sin confirmar el contenido de los dos `.sql`.
- Router nuevo `business`: `getSettings` y `updateSettings` (`managerProcedure`). El input no lleva `business_id` y es `.strict()`.
- `@tpv/core.canSeeExpectedCash(role, blindCashClose)`: regla pura. Solo un worker con cierre ciego no ve el esperado; rol desconocido cuenta como worker.
- `cashSession.getExpected`: procedimiento nuevo que usa un helper compartido con `close` para las tres agregaciones y `computeExpectedCashCents`. El rol sale de `ctx.employeeId` (PIN) leído en BD, nunca del input.
- `procedures.ts`: se exporta `getEmployeeRole`.

### Qué devuelve cada endpoint según rol y ajuste

| Endpoint | worker + ciego | worker + no ciego | manager/admin (cualquier ajuste) |
|---|---|---|---|
| `getCurrent` | Sesión sin campos de cuadre | igual | igual |
| `getExpected` | `{ visible: false, expectedAmountCents: null }` | `{ visible: true, expectedAmountCents: n }` | `{ visible: true, … }` |
| `close` | `expectedAmountCents` y `differenceCents` a `null` (la BD guarda los reales) | valores reales | valores reales |
| `getZReport`, sesión abierta (informe X) | `FORBIDDEN` | completo | completo |
| `getZReport`, sesión cerrada (informe Z) | `expectedAmountCents` y `differenceCents` a `null` | completo | completo |

Sin sesión abierta, `getExpected` devuelve `null`. Sin empleado con PIN, `UNAUTHORIZED`. El informe X se bloquea porque fondo, ventas por método y movimientos permiten deducir el esperado. Límite que no se cubre: un worker puede sumar a mano sus tickets en efectivo.
- Chip de caja: cerrada muestra "Abrir caja"; abierta muestra el efectivo esperado si el rol lo permite. Se invalida la consulta tras cada cobro y movimiento. El color hardcodeado `bg-green-500` pasa a un token.
- Diálogo de cierre: se quita el interruptor. Si el rol puede verlo muestra el esperado; si no, solo la pista de cierre ciego y ningún aviso de descuadre tras cerrar.
- Página `/admin/settings` mínima con un interruptor; la entrada de navegación pasa a `ready`.

Tests: matriz rol × ajuste en `getExpected`, `close` y `getZReport`; `canSeeExpectedCash`; suma en céntimos con cobros en efectivo, entradas y salidas. `updateSettings`: un worker recibe `FORBIDDEN`, el campo llega al SET, el WHERE usa el negocio del contexto y un `businessId` en el input da `BAD_REQUEST`. Un `role` extra en el input de `close` se rechaza.

## PR-D — Plano informativo

Cierra #6, #7, #20 y #21. Esquema de BD: sí. Riesgo: medio (consulta con joins en la pantalla más usada, solo lectura).

- Migración `0007`: `ALTER TABLE "orders" ADD COLUMN "bill_requested_at" timestamp with time zone;`. Nullable y sin default. Se revierte con `DROP COLUMN`.
- `floor.tables.listWithOpenOrders` devuelve, por mesa ocupada: total, pagado, pendiente, hora de apertura, nombre del empleado y `bill_requested_at`. Todos los joins filtran por `business_id`.
- El total sale de `orders.total_cents`, que el servidor ya recalcula con `orderTaxBreakdown` en cada `upsert` (regla 8). El pendiente es ese total menos los pagos completados, con una función pura `pendingCents` en `@tpv/core`.
- `orders.requestBill`: mutación nueva y botón "Pedir cuenta" en la comanda. `upsert` pone `bill_requested_at` a `NULL` cuando añade líneas.
- #20, nombre del negocio: la cabecera del TPV muestra `businesses.name` en vez del "Mi Negocio" fijo. Lo lee un procedimiento de `deviceProcedure` desde el contexto (sin `business_id` en el input) y se elimina la clave `tpv.header.businessName`. Test: devuelve el negocio del contexto y nunca el de otro.
- #21, "Volver al plano": al volver, la mesa aparece ocupada al instante (actualización optimista de la caché de `floor.tables.listWithOpenOrders`). Al acabar el guardado se invalida la consulta; si falla, se revierte la mesa y se avisa por i18n sin perder las líneas del store local. Test de la lógica optimista y del revertido. Archivos: `floor/tpv-back-to-floor-button.tsx`, `floor/tpv-floor-view.tsx`.
- `cashSession.getExpected` en una sola consulta SQL: hoy lanza 9 sentencias en serie (unos 660 ms con caja abierta) y unificada tarda unos 78 ms (medido en #24). Las sumas siguen filtrando por `business_id`, y `close` y el chip siguen usando el mismo cálculo. La transacción de `withBusinessContext` se mantiene (prepara RLS).
- Estados del plano: libre, ocupada y pendiente de cobro (token `--state-billing`). Además del color llevan texto.
- El tiempo abierta se calcula en cliente solo para mostrarlo. El plano usa `refetchInterval` de 15 s y `refetchOnWindowFocus`.
- Se sustituye el `text-[10px]` de `tpv-floor-table.tsx` por un tamaño de la escala.
- Se actualiza `docs/DATABASE-SCHEMA.md`.

Tests: `pendingCents` (pendiente ≥ 0 y ≤ total) y la función pura de estado visual. Router del plano: el total sale de BD, el pendiente descuenta pagos parciales y los joins filtran por negocio. `requestBill`: solo con comanda abierta, idempotente y acotada al negocio. Reglas de `bill_requested_at`: añadir líneas lo pone a `NULL`, y al cobrar del todo la mesa queda libre.

### Reparto de PR-D en tres PRs

PR-D toca unos 30 archivos, así que se parte:

| PR | Contenido | Cierra |
|---|---|---|
| D1 | Nombre real del negocio en la cabecera, botón "Abrir TPV" en el admin y `getExpected` en una consulta | #20, #29 (y `Refs #24`) |
| D2 | Migración 0007, estados y datos de mesa en el plano, "Pedir cuenta", "Volver al plano" optimista | #6, #7, #21 |
| D3 | Ver más abajo | #30 |

Puntos de parada: tras el merge de D1 se pausa para la prueba en el navegador (4 pasos). En D2 se pausa antes de `pnpm db:migrate` para revisar el `.sql` de 0007.

## PR-D3 — Plano por posición

Cierra #30. Esquema de BD: no. Riesgo: medio-bajo (solo presentación). Depende de D2.

Hoy `tpv-floor-view.tsx` pinta las mesas en fila (`flex flex-wrap`) e ignora `tables.pos_x`, `pos_y`, `width` y `height`, así que colocar mesas en `/admin/floor` no tiene efecto en el TPV.

- El plano del TPV coloca cada mesa según la posición y el tamaño definidos en el admin.
- Función pura que traduce posición y tamaño a estilos, con test.
- El tamaño mínimo sale de la constante única `TABLE_MIN_SIZE_CLASS` (introducida en D2), para que el objetivo táctil de 44 px no dependa del tamaño dibujado en el admin.
- Texto por i18n y estilos con tokens.

### Decisiones de implementación (D3)
- **Coordenadas:** px lógicos del admin, origen arriba-izquierda, rejilla `FLOOR_GRID_PX` = 10. El TPV toma la caja que envuelve las mesas y la escala (mismo factor en X e Y, tope `MAX_FLOOR_SCALE` = 2) para que quepa sin scroll, centrada. Admin sigue a 1:1.
- **Mínimo táctil:** tras escalar, ninguna mesa baja de 128×96 px (redondas: círculo de ≥128). Crece alrededor de su centro y se encaja dentro del contenedor.
- **Solapes:** se aceptan (no se recolocan); `layoutFloor` devuelve `overlapCount` para un posible aviso futuro en el admin.
- **Mesas sin colocar:** si dos o más comparten posición exacta, la zona usa la lista de siempre + aviso `tpv.floor.unplacedHint`.
- **Altas en el admin:** `nextFreePosition` busca el primer hueco de la rejilla (filas de izquierda a derecha) usando la huella táctil del TPV, en vez de (20,20) siempre.
- Código: `apps/web/src/lib/floor/floor-layout.ts` (+ test).

## Orden y flujo

Orden: A → B → C → D1 → D2 → D3. Va de menor a mayor riesgo; C y D son independientes entre sí.

Por PR: rama desde `main` → código → `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde → push → PR con `Closes #N` → CI.

- PR-A: con CI verde se hace merge squash y se sigue con PR-B.
- PR-B, PR-C y PR-D: con CI verde se pausa y se hace una lista de comprobaciones en el navegador (máximo 5 pasos). El merge se hace tras confirmarlas.

## Design system

Todo estilo sale de un token (`docs/DESIGN-SYSTEM.md`), con objetivos táctiles de al menos 44 px en el TPV y textos por i18n. Nada de `#hex` ni valores inventados.
