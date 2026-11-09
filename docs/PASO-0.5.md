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
- Ambas reglas llevan test.
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

Cierra #14 y #8. Esquema de BD: sí. Riesgo: alto (dinero, permisos y migración).

Hoy el interruptor de cierre ciego es solo cosmético: `cashSession.close` siempre calcula y devuelve el esperado. Mostrar el efectivo esperado en el chip a cualquiera anularía el cierre ciego, por eso los dos issues van juntos.

- Migración `0006`: `ALTER TABLE "businesses" ADD COLUMN "blind_cash_close" boolean DEFAULT true NOT NULL;`. Los negocios existentes quedan en ciego. Se revierte con `DROP COLUMN`. No hay BD de staging: se aplica a la única BD, y es aditiva.
- Router nuevo `business`: `getSettings` y `updateSettings` (`managerProcedure`). El input no lleva `business_id`.
- `cashSession.getExpected`: procedimiento nuevo que usa un helper compartido con `close` para las tres agregaciones y `computeExpectedCashCents`. Si el cierre es ciego y quien pregunta no es manager/admin, devuelve `null`.
- `procedures.ts`: se exporta `getEmployeeRole`.
- Chip de caja: cerrada muestra "Abrir caja"; abierta muestra el efectivo esperado si el rol lo permite. Se invalida la consulta tras cada cobro y movimiento. El color hardcodeado `bg-green-500` pasa a un token.
- Diálogo de cierre: se quita el interruptor y se lee el ajuste del servidor.
- Página `/admin/settings` mínima con un interruptor; la entrada de navegación pasa a `ready`.

Tests: `getExpected` con worker/manager y ciego/no ciego, suma en céntimos con cobros en efectivo, entradas y salidas. `updateSettings`: un worker recibe `FORBIDDEN`, el campo llega al SET y el negocio sale del contexto. Los tests de `close` actuales siguen en verde.

## PR-D — Plano informativo

Cierra #6 y #7. Esquema de BD: sí. Riesgo: medio (consulta con joins en la pantalla más usada, solo lectura).

- Migración `0007`: `ALTER TABLE "orders" ADD COLUMN "bill_requested_at" timestamp with time zone;`. Nullable y sin default. Se revierte con `DROP COLUMN`.
- `floor.tables.listWithOpenOrders` devuelve, por mesa ocupada: total, pagado, pendiente, hora de apertura, nombre del empleado y `bill_requested_at`. Todos los joins filtran por `business_id`.
- El total sale de `orders.total_cents`, que el servidor ya recalcula con `orderTaxBreakdown` en cada `upsert` (regla 8). El pendiente es ese total menos los pagos completados, con una función pura `pendingCents` en `@tpv/core`.
- `orders.requestBill`: mutación nueva y botón "Pedir cuenta" en la comanda. `upsert` pone `bill_requested_at` a `NULL` cuando añade líneas.
- Estados del plano: libre, ocupada y pendiente de cobro (token `--state-billing`). Además del color llevan texto.
- El tiempo abierta se calcula en cliente solo para mostrarlo. El plano usa `refetchInterval` de 15 s y `refetchOnWindowFocus`.
- Se sustituye el `text-[10px]` de `tpv-floor-table.tsx` por un tamaño de la escala.
- Se actualiza `docs/DATABASE-SCHEMA.md`.

Tests: `pendingCents` (pendiente ≥ 0 y ≤ total) y la función pura de estado visual. Router del plano: el total sale de BD, el pendiente descuenta pagos parciales y los joins filtran por negocio. `requestBill`: solo con comanda abierta, idempotente y acotada al negocio. Reglas de `bill_requested_at`: añadir líneas lo pone a `NULL`, y al cobrar del todo la mesa queda libre.

## Orden y flujo

Orden: A → B → C → D. Va de menor a mayor riesgo; C y D son independientes entre sí.

Por PR: rama desde `main` → código → `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde → push → PR con `Closes #N` → CI.

- PR-A: con CI verde se hace merge squash y se sigue con PR-B.
- PR-B, PR-C y PR-D: con CI verde se pausa y se hace una lista de comprobaciones en el navegador (máximo 5 pasos). El merge se hace tras confirmarlas.

## Design system

Todo estilo sale de un token (`docs/DESIGN-SYSTEM.md`), con objetivos táctiles de al menos 44 px en el TPV y textos por i18n. Nada de `#hex` ni valores inventados.
