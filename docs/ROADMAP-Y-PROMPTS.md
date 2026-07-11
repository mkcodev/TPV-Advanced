# Roadmap y prompts para Claude Code

Guía operativa: qué construir, en qué orden, y con qué **prompt exacto** pedírselo a Claude Code.
Los prompts están pensados para este proyecto (no son genéricos): mencionan tus paquetes, tablas y reglas.

---

## Cómo usar este documento

**El bucle de cada tarea (repítelo siempre):**

1. **¿Tarea crítica o compleja?** → primero **Opus en modo plan** (marcadas con 🧠). Opus piensa y escribe el plan, sin tocar código. Tú lo revisas y apruebas.
2. **Ejecutar** con **Sonnet** (marcadas con ⚡). Escribe el código de la tarea aprobada.
3. **Revisar el diff** antes de aceptar.
4. **`pnpm lint && pnpm typecheck && pnpm test`** — que pase todo.
5. **Commit pequeño** (`feat:`, `fix:`, `docs:`...).

**No repitas el contexto en cada mensaje**: el `CLAUDE.md` ya lo tiene. Los prompts de abajo asumen que Claude Code ya lo ha leído.

**Ritmo de modelos:** usa 🧠 Opus para arquitectura, esquema, lo legal y lo que reparte dinero; ⚡ Sonnet para el resto (UI, CRUD, pantallas).

---

## Antes de empezar (una vez)

Abre la carpeta en Claude Code y lanza esto para confirmar que ha cargado el contexto:

```
Lee CLAUDE.md y todos los archivos de /docs. Resúmeme en 5 líneas qué construimos,
lista las reglas de oro y dime qué fase toca según docs/ROADMAP-Y-PROMPTS.md.
No escribas código todavía.
```

Luego: `git init`, primer commit, y `pnpm install`.

---

# FASE 0 — Fundaciones técnicas

**Objetivo:** dejar el proyecto compilando, con la base de datos real, autenticación y el armazón de la UI. Nada de funcionalidad de venta todavía. Cuando termine la Fase 0, tienes un esqueleto vivo sobre el que construir rápido.

### 0.1 ⚡ Generar la app web

```
Genera la app web en apps/web siguiendo apps/web/README.md: create-next-app con
TypeScript, App Router, Tailwind y --src-dir, SIN ESLint (usamos Biome de la raíz).
Añade como dependencias `workspace:*` los paquetes @tpv/ui, @tpv/core, @tpv/api,
@tpv/validators y @tpv/db, y configura el path alias "@/*".
Criterios de aceptación: `pnpm --filter web dev` arranca sin errores, `pnpm lint`
y `pnpm typecheck` pasan, y no has añadido ninguna librería fuera del stack de
CLAUDE.md. Entregable: la app arrancando y el diff.
```

### 0.2 🧠 Materializar el esquema completo en Drizzle

```
Modo plan (no escribas código aún). Vamos a traducir a Drizzle TODO el modelo de
docs/DATABASE-SCHEMA.md. Propón la organización en packages/db/src/schema con un
archivo por módulo (accounts.ts, catalog.ts, inventory.ts, floor.ts, orders.ts,
billing.ts) reexportados desde index.ts, la lista de tablas por archivo, y los enums
que usarás. Respeta las reglas: snake_case en columnas, dinero en *_cents (integer),
business_id en toda tabla de dominio, created_at/updated_at, UUID como PK.
Incluye todos los constraints UNIQUE legales (invoices: business_id+series+number;
billing_records: business_id+sequence_number; orders: business_id+order_number)
y el índice parcial UNIQUE (table_id) WHERE status='open' en orders.
Cuando apruebe el plan, lo implementas y generas la migración con `pnpm db:generate`
SIN aplicarla.
```

### 0.3 🧠 Conexión a Supabase + RLS multi-negocio (doble defensa)

```
Configura la conexión a Supabase en packages/db (cliente postgres + Drizzle) leyendo
DATABASE_URL. Después, implementa la doble defensa multi-tenant:

1. CAPA APLICACIÓN: crea el middleware tRPC `businessProcedure` que inyecta
   business_id desde el contexto de autenticación (sesión de dispositivo o JWT).
   El business_id NUNCA se acepta como parámetro de entrada en ningún endpoint.
   Documenta esta regla en un comentario en el middleware.

2. RLS CON auth.jwt(): activa Row Level Security en todas las tablas con business_id
   y escribe políticas que filtren por el negocio del usuario autenticado usando
   auth.jwt(). Esta capa protege el acceso directo a Supabase (Realtime, carta
   pública, app camareros PWA).

Test de aceptación: una consulta hecha como usuario de otro negocio devuelve CERO
filas, verificado por AMBOS caminos: (a) a través del router tRPC y (b) directo
al cliente de Supabase. Muéstrame el plan de políticas antes de aplicarlas.
```

### 0.4 🧠 Autenticación en dos niveles

```
Modo plan primero. Implementa la autenticación completa según docs/AUTH-DEVICES.md:

1. PANEL ADMIN: login con Supabase Auth (email/contraseña) para `users`.

2. EMPAREJAMIENTO DE DISPOSITIVO: endpoint para generar código de emparejamiento
   (6 dígitos, caduca en 15 minutos, un solo uso) desde el admin → el terminal
   lo introduce → el servidor crea la fila en `devices` y devuelve token de
   dispositivo persistente. El token porta business_id; nunca se acepta como
   parámetro.

3. LOGIN DE EMPLEADO POR PIN: el PIN se envía por HTTPS al servidor (nunca se
   hashea en cliente). El servidor valida contra employees.pin_hash (argon2/bcrypt).
   Implementar lockout: tras 5 fallos → locked_until = NOW() + 15 minutos.
   Rate limiting por IP+device_id (máx 20 intentos/min, contador en BD).

4. Toda acción lleva employee_id + device_id.

Entregable: plan → código → tests del hash/verificación + lockout en @tpv/core.
```

### 0.5 🧠 Design system (hazlo ANTES de cualquier pantalla)

```
Modo plan primero. Implementa el design system de docs/DESIGN-SYSTEM.md. Pasos:
(1) inicializa shadcn/ui en apps/web con estilo new-york, base slate, radio 0.5rem,
fuente Inter; (2) reemplaza las variables CSS generadas por las de
packages/ui/src/styles/tokens.css (nuestra fuente de verdad) e impórtalas en
globals.css; (3) mapea los tokens en Tailwind para que bg-primary,
text-muted-foreground, etc. resuelvan a hsl(var(--token)); (4) instala los
componentes base de shadcn listados en la Sección 6.1 del DESIGN-SYSTEM.md.
Respeta el patrón de packages/ui/src/components/button.tsx para todo lo nuevo.
Criterio de aceptación: la app compila, el Button de @tpv/ui se renderiza con
los tokens, y no hay ni un color #hex ni un espaciado arbitrario.
```

### 0.6 ⚡ Armazón de UI + i18n

```
Con el design system ya en marcha, implementa next-intl para i18n (App Router-nativo)
con un único diccionario es.json — NADA de textos fijos en componentes, todo vía i18n.
Monta el armazón visual del TPV: cabecera, zona de contenido, barra lateral de
comanda usando SOLO componentes de @tpv/ui y tokens del design system.
Objetivos táctiles ≥44px. Solo estructura y navegación, sin lógica de negocio.
```

### 0.7 🧠 Storybook

```
Modo plan primero. Monta Storybook en packages/ui: (1) Storybook 8 con React + Vite;
(2) carga Tailwind y packages/ui/src/styles/tokens.css en el preview; (3) story del
Button cubriendo todas las variantes × tallas; (4) story "Design Tokens" que muestre
en vivo la paleta de color, la escala de espaciado y la tipografía; (5) story de los
tokens de Motion (§7 del DESIGN-SYSTEM.md). Criterio: Storybook arranca y el Button
se ve con los tokens correctos. Cada componente nuevo de @tpv/ui llega con su story.
```

### 0.8 ⚡ CI (GitHub Actions)

```
Crea el workflow de GitHub Actions en .github/workflows/ci.yml que se ejecute en
cada PR y push a main. Pasos: checkout → pnpm install → pnpm lint → pnpm typecheck
→ pnpm test. Sin pasos de build (demasiado lento para CI de feature). El workflow
falla si algún paso falla. Criterio: el pipeline pasa en verde con el estado actual
del repo.
```

**✅ Checkpoint Fase 0:** el proyecto arranca, la BD existe con RLS y doble defensa multi-tenant, puedes iniciar sesión y emparejar dispositivos, ves el armazón del TPV, Storybook funciona y CI pasa. Commit y a la Fase 1.

---

# FASE 1 — MVP usable en el bar

**Objetivo:** que tu padre pueda usarlo de verdad en una tablet/PC: carta con fotos, comandas, mesas, cobro, ticket impreso, empleados y cierre de caja. **Al terminar la Fase 1, ponlo en el bar y úsalo** antes de seguir.

> ⚠️ Con ventas reales aplica ya el RD 1619/2012 (tickets correlativos y conservación). Verificar con gestor antes de la primera venta real.

### 1.0 🧠 Política de redondeo de IVA y totales en @tpv/core

```
Modo plan primero. Antes de cualquier pantalla que muestre precios, implementa y
testea en @tpv/core la política de redondeo de IVA por bloques definida en
docs/DATABASE-SCHEMA.md "Notas de implementación":

1. Función orderTaxBreakdown(items): agrupa líneas por tax_rate, suma bruto por
   bloque, aplica taxBreakdownFromGross a cada bloque, devuelve breakdown + total.
2. Property-test (con fast-check o similar): para cualquier conjunto de líneas,
   SUM(base_cents + tax_cents por bloque) == total_cents siempre. Este invariante
   no puede romperse.
3. El servidor siempre usa esta función para calcular los totales antes de persistir.
   El cliente calcula localmente solo para feedback visual optimista.

Entregable: funciones en @tpv/core + tests que pasan (incluyendo el property-test).
```

### 1.1 ⚡ Backend del catálogo (tRPC + Drizzle)

```
Implementa el router tRPC `catalog` en packages/api con CRUD de product_categories
(incluido print_destination) y products (incluidos allergens text[]), y sus variantes
y grupos de modificadores. TODAS las consultas filtradas por business_id a través del
middleware businessProcedure — NUNCA aceptes business_id en el input del endpoint.
Entradas validadas con Zod en @tpv/validators. Los precios en céntimos (enteros).
Tests de la lógica de precios en @tpv/core. Entregable: routers + tests verdes + diff.
```

### 1.2 ⚡ Panel admin del catálogo + subida de fotos

```
Crea en el panel admin las pantallas para gestionar categorías y productos (listar,
crear, editar, activar/desactivar), consumiendo el router `catalog` con TanStack Query.
La FOTO del producto se sube a Supabase Storage y se guarda la URL en image_url.
Incluir campo de alérgenos (los 14 del Reglamento UE 1169/2011) con checkboxes.
El precio se introduce en euros, se convierte a céntimos con @tpv/core.eurosToCents
antes de guardar. Textos en español vía i18n. Formularios con esquemas Zod compartidos.
```

### 1.3 ⚡ Pantalla del TPV: tocar producto → total en vivo

```
Implementa la pantalla principal del TPV: rejilla de productos con foto y precio,
navegable por categorías (4–5 col caja, 2–3 col móvil). Al tocar un producto se
añade a la comanda actual y el total se recalcula EN VIVO usando
@tpv/core.orderTaxBreakdown (política de bloques de la tarea 1.0). Permite cambiar
cantidad y borrar líneas. La comanda vive en estado local de React (Zustand). Todavía
sin persistir. Implementa S3 (tap=+1 pulso, long-press continuo) y S10 (total tick).
Criterio de aceptación: totales e IVA cuadran al céntimo con los tests de @tpv/core.
```

### 1.4 ⚡ Variantes, modificadores y menús

```
Añade en el TPV la selección de variantes, modificadores y combos al añadir un
producto que los tenga, respetando min_select/max_select. Al confirmar, la línea
guarda el snapshot de nombre/precio y los deltas de modificadores. Actualiza
orderTaxBreakdown en @tpv/core si hace falta, con tests.
```

### 1.5 ⚡ Plano visual de sala y mesas

```
Implementa zonas y plano de mesas por coordenadas según el esquema. En el TPV, el
plano muestra el estado por color (usando tokens state-*). Implementa S5 (pulso de
borde al marcar listo + badge de minutos). En el admin, editor de arrastrar mesas.
Persistencia vía router tRPC `floor`, filtrado por business_id.
IMPORTANTE: no existe current_order_id en tables. La comanda activa de una mesa
se consulta como: orders WHERE table_id = ? AND status = 'open'.
```

### 1.6 🧠 Persistir comandas y aparcarlas en mesas

```
Modo plan primero. Conecta las comandas a la BD: al abrir una mesa se crea/recupera
un order (status='open') con sus order_items; se puede aparcar y volver.
order_number lo asigna el servidor al sincronizar (offline se usa un nº provisional
local). El UNIQUE (business_id, order_number) y el índice parcial UNIQUE (table_id)
WHERE status='open' garantizan la integridad — no puede haber 2 comandas abiertas
en la misma mesa.
Cada línea guarda snapshots (name_snapshot, unit_price_cents, tax_rate). Los totales
los calcula el servidor con @tpv/core.orderTaxBreakdown, no los acepta del cliente.
Registra cambios en order_events. Router tRPC `orders`. Todos los endpoints usan
businessProcedure (business_id del contexto, nunca del input).
Tests: numeración correlativa sin huecos y snapshots que no cambian al editar el producto.
```

### 1.7 🧠 Dividir cuenta, juntar mesas, transferir

```
Modo plan primero: es lógica delicada de reparto de dinero. Implementa dividir cuenta,
juntar mesas y transferir comanda usando merged_into_order_id y split_from_order_id.
Cada acción deja rastro en order_events. El servidor recalcula los totales con
@tpv/core.orderTaxBreakdown tras cada operación.
Tests: tras cualquier división, la suma de las partes cuadra al céntimo con el total
original (usar el invariante del property-test de la tarea 1.0).
```

### 1.8 🧠 Cobro (efectivo/tarjeta/Bizum/mixto) y cierre de comanda

```
Modo plan primero. Implementa el cobro: efectivo, tarjeta, Bizum (method='bizum') y
mixto; cálculo de cambio (S2: botones de billetes 5/10/20/50 + exacto, cambio en
display grande); una comanda puede tener varios payments. Al quedar cubierto el total,
la comanda pasa a 'paid', tables.status a 'free'.
Los payments llevan status='completed' por defecto y un reference opcional.
Los pagos se asocian a la cash_session abierta. La sesión de caja incluye
cash_movements en el cálculo del expected_amount_cents.
Tests: cálculo de cambio, pagos parciales que completan el total, y que un pago
de método 'bizum' se registra correctamente.
```

### 1.9 ⚡ Ticket y comanda de cocina imprimibles (Fase 1 — navegador)

```
Implementa la vista imprimible de ticket (factura simplificada) según docs/PRINTING.md:
datos del negocio, líneas, desglose de IVA (por bloques de tax_rate), total, cambio,
y el HUECO señalado para el QR Veri*factu (no inventar formato — "disponible en Fase 2").
Implementa también la comanda de cocina (sin importes, con notas y alérgenos), con
enrutado según product_categories.print_destination ('kitchen' / 'bar').
La impresión real ESC/POS llega en Fase 2 con Electron (ver docs/PRINTING.md §6).
```

### 1.10 ⚡ Empleados, login por PIN y ventas por empleado

```
Implementa la gestión de empleados en el admin (nombre, foto, rol, PIN hasheado con
argon2/bcrypt, lockout tras fallos) y el login por PIN en el TPV tal como describe
docs/AUTH-DEVICES.md. Implementa S8 (chip de empleado en líneas de comanda).
Cada order y payment guardan employee_id. Vista de "ventas por empleado" del día.
Roles en el servidor (businessProcedure): worker no accede a configuración;
anular línea enviada a cocina y descuentos requieren manager+.
```

### 1.11 ⚡ Sesión de caja, cash_movements y cierre Z (arqueo)

```
Implementa la sesión de caja: apertura con fondo, registro de movimientos manuales
(cash_movements: pay_in/pay_out con motivo obligatorio), cierre con recuento.
Opción de "cierre ciego" (el empleado cuenta sin ver el esperado — anti-fraude).
expected_amount_cents = opening_amount + sum(payments cash) + sum(pay_in cash_movements)
  - sum(pay_out cash_movements).
Informe de cierre Z: totales del día por método de pago, por empleado, y movimientos
manuales. Una cash_session cerrada es de solo lectura.
Tests del cálculo de esperado con y sin cash_movements, y con cierre ciego.
```

**✅ Checkpoint Fase 1:** instálalo en el bar de tu padre y úsalo unos días. Anota lo que falla o incomoda. Corrige eso ANTES de la Fase 2. Recuerda: el RD 1619/2012 aplica desde el primer ticket real — verificar con gestor.

---

# FASE 2 — Legal, tiempo real, móvil y escritorio

**Objetivo:** convertirlo en un TPV "de verdad": legal (Veri*factu), sincronizado entre dispositivos, con app de camareros, impresión térmica real y funcionamiento offline.

### 2.1 🧠 Módulo legal Veri*factu (lo más crítico del proyecto)

```
Modo plan, SIN código todavía. Vamos con el módulo legal en packages/core/billing
(funciones puras, sin IO — ver docs/DATABASE-SCHEMA.md "Módulo billing = funciones puras").

ANTES de diseñar nada: consulta la especificación técnica oficial y VIGENTE de la AEAT
para Veri*factu (Orden HAC/1177/2024 + spec técnica de la AEAT). Resume los requisitos:
- Formato exacto del hash encadenado y el payload que se hashea (record_payload en billing_records).
- Contenido y URL del QR.
- Estructura del registro de alta y de anulación.
- Estructura del envío al servicio web de la AEAT.
- Requisitos del registro de eventos (system_events) en modo no_verifactu.

Propón el diseño del módulo con las reglas de la sección 6 de DATABASE-SCHEMA.md:
- Emisor único por negocio (solo la caja Electron o el backend cloud escribe en billing_records).
- record_payload: serialización determinista; el hash se calcula sobre esa serialización exacta.
- Facturas rectificativas (invoice_type='rectificative') — verificar tipos R1–R5 con gestor.
- Numeración sin huecos generada atómicamente.

NO inventar ningún formato. Al aprobar el diseño, implementar con tests exhaustivos
(encadenamiento, inmutabilidad, rectificativas, numeración sin huecos).

ADEMÁS: usar la VENTANA DE PRUEBAS AEAT 2026 para validar la integración con el entorno
de pruebas de la AEAT antes de la obligación real (1-7-2027 autónomos, verificar con AEAT).
```

### 2.2 🧠 Sincronización en tiempo real entre dispositivos

```
Modo plan primero. Añade sincronización con Supabase Realtime:
- Canales PRIVADOS autorizados por business_id (realtime.channels con RLS).
- Payloads MÍNIMOS: solo ids + version. El receptor refetchea el dato completo.
  No enviar datos sensibles en el payload del canal.
- Implementa S6 (SyncStatusPill) en la UI: verde/ámbar + cola offline.
- Test de no-fuga: eventos de un negocio no llegan a otro negocio.
- Resuelve el caso de dos camareros tocando la misma mesa simultáneamente
  (usar el campo version de orders para optimistic locking).
```

### 2.3 ⚡ App de camareros (PWA)

```
Modo plan de pantallas primero. La app de camareros es una PWA instalable dentro de
apps/web (ruta /waiter), con manifest.json para instalación en Android/iOS.
NO se genera una nueva app de Expo — la PWA reutiliza el 100% de la UI web y el
design system (ver docs/PLANIFICACION-TPV.md §4).

Implementa: login por PIN, ver el plano de mesas, tomar comanda y enviarla
(sincronización en tiempo real con la caja y la cocina). Empieza por la toma de
comanda, que es el flujo estrella. Diseño responsive para 390×844px (S1, S3, S4).
```

### 2.4 ⚡ Cocina: KDS y/o impresora (configurable)

```
Implementa la salida a cocina configurable por negocio: (a) pantalla KDS con
data-theme='dark' (ver tokens.css y docs/DESIGN-SYSTEM.md §1) mostrando comandas
con estados 'en preparación/listo', y/o (b) impresión de comanda según docs/PRINTING.md.
Los estados de order_items se actualizan en tiempo real en el TPV y el móvil.
```

### 2.5 🧠 Empaquetar la caja como app de escritorio (Electron)

```
Modo plan primero. Monta apps/desktop como cáscara Electron que carga la MISMA UI de
apps/web (sin reescribir la interfaz). Añade: impresión ESC/POS según docs/PRINTING.md
(ticket y comanda de cocina), apertura del cajón portamonedas, y empaquetado con
electron-builder con auto-update. Sustituye la impresión de navegador de la Fase 1
por la térmica real. Pregunta antes de añadir dependencias nativas.
```

### 2.6 🧠 Offline-first (SQLite local + sincronización por operaciones)

```
Modo plan primero: es la parte más delicada.

La estrategia NO es "último en escribir gana (LWW)". Ver docs/DATABASE-SCHEMA.md
"Offline-first (estrategia de sync)". La estrategia es:

1. OUTBOX LOCAL: cada operación (añadir línea, anular línea, pago) se guarda en un
   outbox SQLite local con su UUID. La UI pinta el estado optimista inmediatamente.
2. REPLAY IDEMPOTENTE: al reconectar, las operaciones del outbox se replayan en servidor
   en orden. El servidor las aplica solo si el UUID no existe ya (idempotente).
3. TOTALES EN SERVIDOR: el servidor recalcula los totales con @tpv/core.orderTaxBreakdown
   tras el replay. El cliente nunca envía totales calculados localmente como definitivos.
4. LWW SOLO en campos no monetarios (notes, guest_count, table_id).

Diseña los casos de conflicto antes de codificar. Tests obligatorios: dos dispositivos
editan offline la misma comanda → tras sync los datos son consistentes y los totales
cuadran al céntimo.
```

**✅ Checkpoint Fase 2:** ya es un producto sólido, legal y con app móvil para un local. Momento de decidir si empiezas a ofrecérselo a otros bares.

---

# FASE 3 — Producto SaaS (vendible a muchos bares)

**Objetivo:** que cualquier bar pueda darse de alta, pagar y usarlo sin ti.

### 3.1 🧠 Alta y onboarding multi-negocio

```
Modo plan primero. Implementa el alta self-service: un dueño crea su organization y su
primer business, configura datos fiscales, y crea empleados. Onboarding guiado para
empezar a vender en minutos. Refuerza el aislamiento multi-tenant (RLS + businessProcedure)
en cada paso. Test de no-fuga entre negocios obligatorio.
```

### 3.2 ⚡ Informes y analítica

```
Crea el panel de informes: ventas por hora/día/producto/empleado, ticket medio, productos
más vendidos, comparativa de periodos, reparto de propinas por empleado.
Consultas agregadas filtradas por business_id (con índices), NO en el cliente.
Añade el botón "export para gestoría": descarga CSV/Excel del mes (facturas + cierre Z).
```

### 3.3 ⚡ Activar inventario y escandallos

```
Activa el módulo de inventario (inventory_items, product_recipes, stock_movements):
descuento automático de stock al vender según el escandallo, avisos de bajo stock,
entradas por compra/merma/ajuste. stock_movements es append-only.
Tests del descuento de stock al cerrar una venta. Verificar que
inventory_items.current_stock == SUM(stock_movements.quantity) con un job periódico.
```

### 3.4 🧠 Suscripciones y cobro del SaaS (Stripe)

```
Modo plan primero, y PREGÚNTAME antes de añadir Stripe. Implementa suscripción SaaS:
planes, checkout, y webhooks que actualizan subscription_status en organizations.
Control de acceso por plan. Nunca guardes datos de tarjeta: delega todo en Stripe.
```

### 3.5 ⚡ Multi-local

```
Permite que una organization tenga varios businesses (locales), con cambio de local en
la UI e informes agregados por organización. Comprueba que ninguna consulta cruza datos
entre locales salvo los informes agregados explícitos (businessProcedure + RLS).
```

### 3.6 ⚡ Registro de jornada (time_entries)

```
Activa el módulo de registro de jornada (tabla time_entries, append-only) para
cumplir el RD-ley 8/2019. Flujo: fichaje de entrada/salida por PIN desde el TPV;
informe mensual por empleado exportable.
IMPORTANTE: los requisitos exactos de formato, conservación (mínimo 4 años),
accesibilidad a inspección y firma electrónica deben verificarse con gestor/asesoría
laboral ANTES de implementar. No asumir el formato.
```

---

# FASE 4 — Diferenciadores (para ser el mejor del mercado)

**Objetivo:** las funciones que te distinguen y ayudan a vender. Elige según lo que pidan los clientes.

### 4.1 ⚡ Carta digital con QR

```
Implementa la carta digital pública: una página web por negocio (por slug) que muestra
el catálogo activo con fotos, precios y alérgenos (del campo allergens de products),
generada desde los mismos products. Genera el QR que enlaza a esa carta.
Solo lectura, sin datos sensibles, cacheada para que vaya rápida.
```

### 4.2 🧠 Pedido y pago desde la mesa por el cliente

```
Modo plan primero. QR en la mesa → el cliente ve la carta → pide → paga. El pedido
entra en la comanda de esa mesa y se sincroniza con cocina y caja. Reutiliza el
módulo de pagos y el legal (Veri*factu). El cliente solo puede actuar sobre su mesa
(validación en servidor por table_id + session efímera).
```

### 4.3 ⚡ Fidelización, fiado y promociones

```
Implementa: (a) programa de puntos básico por cliente (tabla customers ya existe);
(b) fiado/cuenta de habitual (saldo por customer_id, append-only); (c) happy hours
(precios por franja horaria); (d) descuentos de promoción (afectan a orderTaxBreakdown
en @tpv/core, con tests). Las promociones se auditan en order_events.
```

### 4.4 ⚡ Reservas

```
Implementa reservas de mesa: calendario, disponibilidad por zona/hora, y bloqueo
de la mesa reservada en el plano (tables.status = 'reserved') a la hora correspondiente.
```

### 4.5 🧠 Integración con plataformas de delivery

```
Modo plan primero. Integra pedidos de delivery volcándolos como comandas de tipo
'delivery'. Diseña una capa de integración por proveedor. Pregúntame antes de dar
de alta cada proveedor/credenciales.
```

### 4.6 🧠 Expo nativa (si hay necesidad probada)

```
Evaluar solo si surge una necesidad nativa real (impresión Bluetooth, NFC, hardware
específico) que la PWA no pueda cubrir. Si se decide implementar: la app de camareros
de Expo comparte @tpv/core, @tpv/api, @tpv/validators pero NO @tpv/ui (React DOM
no es compatible con React Native). La UI se reimplementa en React Native.
```

---

## Resumen de la cadencia

| Fase | Cuándo | Foco | Modelo dominante |
|------|--------|------|------------------|
| 0 | Ahora | Fundaciones (scaffold, BD, auth, doble RLS, CI, UI) | 🧠 + ⚡ |
| 1 | Tras la 0 | MVP usable → **ponerlo en el bar** | ⚡ (con 🧠 en lógica de dinero) |
| 2 | Tras usar el MVP | Legal (Veri*factu), tiempo real, PWA, escritorio, offline | 🧠 en lo crítico |
| 3 | Al querer vender | Onboarding, informes, inventario, suscripciones, jornada | ⚡ + 🧠 en pagos |
| 4 | Según demanda | Carta QR, pago en mesa, fidelización, reservas, delivery, Expo | Mixto |

**Regla de oro del ritmo:** una tarea cada vez, revisa el diff, tests en verde, commit. No saltes de fase sin cerrar el checkpoint anterior. El módulo Veri*factu (2.1), toda lógica que reparte dinero y el registro de jornada (3.6) se hacen con Opus y tests exhaustivos. Siempre verificar con gestor/AEAT vigente antes de implementar lo legal.
