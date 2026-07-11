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

**Por qué estos prompts funcionan bien** (por si quieres escribir los tuyos): cada uno tiene (a) **objetivo** claro, (b) **alcance** acotado —qué sí y qué no—, (c) **restricciones** que apuntan a las reglas del `CLAUDE.md` sin repetirlas enteras, (d) **criterios de aceptación** verificables, y (e) **entregable** (diff, tests, docs). Y piden **plan antes de código** cuando la tarea es delicada.

**Ritmo de modelos:** usa 🧠 Opus para arquitectura, esquema, lo legal y lo que reparte dinero; ⚡ Sonnet para el resto (UI, CRUD, pantallas). Es lo que menos cuesta.

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
business_id en toda tabla de dominio, created_at/updated_at, UUID como PK, y los
índices de la sección "Notas de implementación". Cuando apruebe el plan, lo
implementas y generas la migración con `pnpm db:generate` SIN aplicarla.
```

### 0.3 🧠 Conexión a Supabase + RLS multi-negocio

```
Configura la conexión a Supabase en packages/db (cliente `postgres` + Drizzle) leyendo
DATABASE_URL. Después, diseña y aplica Row Level Security: activa RLS en todas las
tablas con business_id y escribe políticas que restrinjan las filas al negocio del
usuario autenticado. Documenta en /docs cómo se propaga el business_id desde la sesión.
Criterio de aceptación: una consulta hecha como un usuario de otro negocio devuelve
CERO filas. Muéstrame el plan de las políticas antes de aplicarlas.
```

### 0.4 🧠 Autenticación en dos niveles

```
Modo plan primero. Implementa la autenticación descrita en CLAUDE.md: (1) login del
panel admin con Supabase Auth (email/contraseña) para `users`; (2) en el TPV: elegir
negocio y luego login de empleado por PIN. El PIN se guarda SOLO hasheado (pin_hash)
con un hash seguro; nunca en claro. Crea el router tRPC `auth` en packages/api con
endpoints validados por Zod (@tpv/validators) para verificar el PIN y abrir sesión de
empleado. Añade tests del hash/verificación en @tpv/core. Entregable: plan → código →
tests verdes → diff.
```

### 0.5 🧠 Design system (hazlo ANTES de cualquier pantalla)

```
Modo plan primero. Vamos a implementar el design system de docs/DESIGN-SYSTEM.md, que es
de obligado cumplimiento. Pasos: (1) inicializa shadcn/ui en apps/web con estilo new-york,
base slate, radio 0.5rem y fuente Inter; (2) reemplaza las variables CSS generadas por las
de packages/ui/src/styles/tokens.css (nuestra fuente de verdad) e impórtalas en el
globals.css; (3) mapea los tokens en el tema de Tailwind (según la versión vigente) para que
bg-primary, text-muted-foreground, border-border, etc. resuelvan a hsl(var(--token)); (4)
instala los componentes base de shadcn listados en la Sección 6.1. Respeta el patrón de
packages/ui/src/components/button.tsx para todo lo nuevo. Criterio de aceptación: la app
compila, el Button de @tpv/ui se renderiza con los tokens, y no hay ni un color #hex ni un
espaciado arbitrario. No construyas pantallas de negocio todavía.
```

### 0.6 ⚡ Armazón de UI + i18n

```
Con el design system ya en marcha, monta el armazón visual: i18n en español con un único
diccionario es.json (NADA de textos fijos en componentes — todo vía i18n) y el layout base
del TPV (cabecera, zona de contenido, barra lateral de comanda) usando SOLO componentes de
@tpv/ui y tokens del design system. Objetivos táctiles ≥44px. Solo estructura y navegación,
sin lógica de negocio.
```

### 0.7 🧠 Storybook (revisar componentes aislados = consistencia)

```
Modo plan primero. Monta Storybook en packages/ui para revisar los componentes del design
system de forma aislada. Requisitos: (1) Storybook 8 con framework React + Vite; (2) carga
Tailwind y packages/ui/src/styles/tokens.css en el preview para que los componentes se vean
con NUESTROS tokens; (3) crea una story del Button de referencia cubriendo todas las variantes
y tallas (default/secondary/outline/ghost/destructive/success × sm/default/lg/xl); (4) añade
una story "Design Tokens" que muestre en vivo la paleta de color, la escala de espaciado (4px)
y la tipografía, como referencia visual. Añade el script `pnpm --filter @tpv/ui storybook`.
Criterio de aceptación: Storybook arranca y el Button se ve con los tokens correctos. No añadas
addons innecesarios. A partir de aquí, cada componente nuevo de @tpv/ui llega con su story.
```

**✅ Checkpoint Fase 0:** el proyecto arranca, la BD existe con RLS, puedes iniciar sesión, y ves el armazón del TPV. Commit y a la Fase 1.

---

# FASE 1 — MVP usable en el bar

**Objetivo:** que tu padre pueda usarlo de verdad en una tablet/PC: carta con fotos, comandas, mesas, cobro, ticket impreso, empleados y cierre de caja. **Al terminar la Fase 1, ponlo en el bar y úsalo** antes de seguir. Ese uso real es lo que valida todo.

### 1.1 ⚡ Backend del catálogo (tRPC + Drizzle)

```
Implementa el router tRPC `catalog` en packages/api con CRUD de product_categories y
products, y sus variantes (product_variants) y grupos de modificadores. TODAS las
consultas filtradas por business_id (nunca consultes sin él). Entradas validadas con
Zod en @tpv/validators. Los precios se manejan en céntimos (enteros). Tests de la
lógica de precios en @tpv/core. Entregable: routers + tests verdes + diff.
```

### 1.2 ⚡ Panel admin del catálogo + subida de fotos

```
Crea en el panel admin las pantallas para gestionar categorías y productos (listar,
crear, editar, activar/desactivar), consumiendo el router `catalog` con TanStack Query.
La FOTO del producto se sube a Supabase Storage y se guarda la URL en image_url. En la
UI el precio se introduce en euros, pero se convierte a céntimos con
@tpv/core.eurosToCents antes de guardar. Textos en español vía i18n. Formularios
validados con los esquemas Zod compartidos.
```

### 1.3 ⚡ Pantalla del TPV: tocar producto → total en vivo

```
Implementa la pantalla principal del TPV: rejilla de productos con foto y precio,
navegable por categorías. Al tocar un producto se añade a la comanda actual y el total
se recalcula EN VIVO usando @tpv/core (lineTotalCents, totales y desglose de IVA con
taxBreakdownFromGross). Permite cambiar cantidad y borrar líneas. Todavía sin persistir:
la comanda vive en estado local de React. Criterio de aceptación: los totales y el IVA
cuadran al céntimo con los tests de @tpv/core.
```

### 1.4 ⚡ Variantes, modificadores y menús

```
Añade en el TPV la selección de variantes (tamaños), modificadores (extras) y menús/
combos al añadir un producto que los tenga, respetando min_select/max_select de cada
grupo (según product_variants, modifier_groups y combo_sections). Al confirmar, la línea
guarda el snapshot de nombre/precio y los deltas de modificadores. Actualiza el cálculo
de total de línea en @tpv/core si hace falta, con tests.
```

### 1.5 ⚡ Plano visual de sala y mesas

```
Implementa las zonas (salón/terraza/barra) y el plano visual de mesas por coordenadas
(pos_x, pos_y, width, height, shape) según el esquema. En el TPV, una vista de plano
muestra el estado de cada mesa por color (libre/ocupada/por cobrar). En el admin, un
editor permite colocar y arrastrar mesas. Persistencia vía router tRPC `floor`, filtrado
por business_id.
```

### 1.6 🧠 Persistir comandas y aparcarlas en mesas

```
Modo plan primero (hay reglas legales sutiles). Conecta las comandas a la BD: al abrir
una mesa se crea/recupera un `order` (status open) con sus order_items; se puede aparcar
(dejar abierta) y volver luego. Genera order_number correlativo por negocio de forma
ATÓMICA. Cada línea guarda snapshots (name_snapshot, unit_price_cents, tax_rate): cambiar
el producto después NO debe alterar comandas pasadas. Registra cambios en order_events.
Router tRPC `orders`. Tests de: numeración correlativa sin huecos y que los snapshots
no cambian al editar el producto.
```

### 1.7 🧠 Dividir cuenta, juntar mesas, transferir

```
Modo plan primero: es lógica delicada de reparto de dinero. Implementa dividir cuenta,
juntar mesas y transferir comanda usando merged_into_order_id y split_from_order_id del
esquema. Dividir: separar líneas o importe entre varias cuentas. Juntar: unificar
comandas de varias mesas. Transferir: mover líneas o la comanda entera a otra mesa. Cada
acción deja rastro en order_events. Tests que verifiquen que, tras cualquier división, la
suma de las partes cuadra al céntimo con el total original.
```

### 1.8 🧠 Cobro (efectivo/tarjeta/mixto) y cierre de comanda

```
Modo plan primero. Implementa el cobro: efectivo, tarjeta (botón manual, sin integración
de datáfono) y mixto; cálculo de cambio; una comanda puede tener varios `payments`
(mixto o cuenta dividida). Al quedar cubierto el total, la comanda pasa a 'paid' y la
mesa a 'free'. Todo en céntimos. Los pagos se asocian a la cash_session abierta. Tests
del cálculo de cambio y de pagos parciales que completan el total.
```

### 1.9 ⚡ Ticket y comanda de cocina imprimibles (local)

```
Genera el ticket (factura simplificada) con datos del negocio, líneas, desglose de IVA
y total, en un layout imprimible por navegador (el ESC/POS real llega en Fase 2 con
Electron). Deja un HUECO comentado y bien señalado para el QR y el encadenamiento
Veri*factu — NO inventes el formato del QR (va en Fase 2 con la especificación oficial).
Genera también la "comanda de cocina" imprimible con las líneas pendientes de la mesa.
```

### 1.10 ⚡ Empleados, login por PIN y ventas por empleado

```
Implementa la gestión de empleados en el admin (nombre, foto en Storage, rol
admin/manager/worker, PIN hasheado) y el login por PIN en el TPV. Cada order y cada
payment guardan employee_id. Añade una vista de "ventas por empleado" del día. Respeta
roles: un `worker` no accede a la configuración del negocio (refuérzalo también en el
backend, no solo ocultando botones).
```

### 1.11 ⚡ Sesión de caja y cierre Z (arqueo)

```
Implementa la sesión de caja: apertura con fondo (opening_amount_cents), cierre con
recuento (counted_amount_cents), y cálculo de esperado y descuadre (difference_cents).
Informe de cierre Z: totales del día por método de pago y por empleado. Todo en céntimos.
Una cash_session cerrada es de solo lectura. Tests del cálculo de esperado/descuadre.
```

**✅ Checkpoint Fase 1:** instálalo en el bar y úsalo unos días. Anota lo que falla o incomoda. Corrige eso ANTES de la Fase 2.

---

# FASE 2 — Legal, tiempo real, móvil y escritorio

**Objetivo:** convertirlo en un TPV "de verdad": legal (Veri*factu), sincronizado entre dispositivos, con app de camareros, impresión térmica real y funcionamiento offline.

### 2.1 🧠 Módulo legal Veri*factu (lo más crítico del proyecto)

```
Modo plan, SIN código. Vamos con el módulo legal en packages/core/billing (aislado y
el más testeado). Primero, consulta la especificación técnica oficial y VIGENTE de la
AEAT para Veri*factu: formato del hash encadenado, contenido y URL del QR, estructura
del registro de alta y de anulación, y el envío al servicio web. Resume los requisitos
y propón el diseño: funciones puras que calculen el hash a partir del registro anterior,
generen el QR y escriban en billing_records (append-only). NO inventes el formato: cíñete
a la especificación. Al aprobar el diseño, lo implementamos con tests exhaustivos
(encadenamiento, inmutabilidad, corrección vía cancellation + alta nueva, numeración sin
huecos). Pregúntame antes de integrar el envío real a la AEAT.
```

### 2.2 🧠 Sincronización en tiempo real entre dispositivos

```
Modo plan primero. Añade sincronización en tiempo real con Supabase Realtime: cuando un
dispositivo cambia una comanda o el estado de una mesa, el resto lo ve al instante.
Define canales por business_id y por mesa. Resuelve el caso de dos camareros tocando la
misma mesa sin pisarse los cambios. Verifica que no hay fugas de eventos entre negocios.
```

### 2.3 ⚡ App de camareros (Expo)

```
Modo plan de pantallas primero. Genera apps/mobile con Expo (ver su README) e implementa
la app de camareros: login por PIN, ver el plano de mesas, tomar comanda y enviarla (se
sincroniza en tiempo real con la caja y la cocina). Reutiliza @tpv/core, @tpv/api y
@tpv/validators. Empieza por la toma de comanda, que es el flujo estrella.
```

### 2.4 ⚡ Cocina: KDS y/o impresora (configurable)

```
Implementa la salida a cocina configurable por negocio: (a) pantalla KDS que muestra las
comandas con estados 'en preparación/listo', y/o (b) impresión de comanda en térmica.
Que cada negocio elija una, otra o ambas. Los estados de las líneas (order_items.status)
se actualizan y se reflejan en tiempo real en el TPV y el móvil.
```

### 2.5 🧠 Empaquetar la caja como app de escritorio (Electron)

```
Modo plan primero. Monta apps/desktop como cáscara Electron que carga la MISMA UI de
apps/web (no se reescribe la interfaz). Añade: impresión ESC/POS con node-thermal-printer
(ticket y comanda de cocina), apertura del cajón portamonedas, y empaquetado con
electron-builder con auto-update. Sustituye la impresión de navegador de la Fase 1 por la
térmica real. Pregúntame antes de añadir dependencias nativas.
```

### 2.6 🧠 Offline-first (SQLite local + sincronización)

```
Modo plan primero: es la parte más delicada. Implementa la capa offline-first para la
caja (Electron): una SQLite local que refleja las tablas de venta, con cola de
sincronización hacia Supabase y resolución de conflictos por updated_at. Aprovecha los
UUID existentes (seguros offline). Diseña la estrategia de sync y los casos de conflicto
antes de codificar, y acompáñala de tests de conflictos (dos dispositivos editan offline
la misma comanda).
```

**✅ Checkpoint Fase 2:** ya es un producto sólido y legal para un local. Momento de decidir si empiezas a ofrecérselo a otros bares.

---

# FASE 3 — Producto SaaS (vendible a muchos bares)

**Objetivo:** que cualquier bar pueda darse de alta, pagar y usarlo sin ti.

### 3.1 🧠 Alta y onboarding multi-negocio

```
Modo plan primero. Implementa el alta self-service: un dueño crea su organization y su
primer business, configura datos fiscales, y crea empleados. Onboarding guiado para
empezar a vender en minutos (crear categorías/productos de ejemplo, primera mesa).
Refuerza el aislamiento multi-tenant (RLS) en cada paso. Sin fugas entre negocios.
```

### 3.2 ⚡ Informes y analítica

```
Crea el panel de informes: ventas por hora/día/producto/empleado, ticket medio, productos
más vendidos y comparativa de periodos. Consultas agregadas filtradas por business_id,
agregando en la BD (con índices), NO en el cliente. Gráficos con la librería del stack.
```

### 3.3 ⚡ Activar inventario y escandallos

```
Activa el módulo de inventario ya diseñado (inventory_items, product_recipes,
stock_movements): descuento automático de stock al vender según el escandallo, avisos de
bajo stock, y entradas por compra/merma/ajuste. stock_movements es append-only. Tests del
descuento de stock al cerrar una venta.
```

### 3.4 🧠 Suscripciones y cobro del SaaS (Stripe)

```
Modo plan primero, y PREGÚNTAME antes de añadir Stripe (es alta de proveedor). Implementa
la suscripción SaaS: planes, checkout, y webhooks que actualizan subscription_status en
organizations. Control de acceso por plan. Nunca guardes datos de tarjeta: delega todo en
Stripe.
```

### 3.5 ⚡ Multi-local

```
Permite que una organization tenga varios businesses (locales), con cambio de local en la
UI e informes agregados por organización. Comprueba que ninguna consulta cruza datos entre
locales salvo los informes agregados explícitos.
```

---

# FASE 4 — Diferenciadores (para ser el mejor del mercado)

**Objetivo:** las funciones que te distinguen y ayudan a vender. Elige según lo que pidan los clientes.

### 4.1 ⚡ Carta digital con QR

```
Implementa la carta digital pública: una página web por negocio (por slug) que muestra el
catálogo activo con fotos, precios y alérgenos, generada desde los mismos products. Genera
el QR que enlaza a esa carta. Solo lectura, sin datos sensibles, cacheada para que vaya
rápida.
```

### 4.2 🧠 Pedido y pago desde la mesa por el cliente

```
Modo plan primero. Implementa el pedido y pago desde la mesa por el propio cliente: QR en
la mesa → ve la carta → pide → paga. El pedido entra en la misma comanda de esa mesa y se
sincroniza con cocina y caja. Reutiliza el módulo de pagos y el legal (Veri*factu). Cuida
la seguridad: el cliente solo puede actuar sobre su mesa.
```

### 4.3 ⚡ Fidelización y promociones

```
Implementa promociones y happy hours (precios por franja horaria) y un programa de puntos
básico por cliente. Las promociones afectan al cálculo de totales en @tpv/core, con tests.
```

### 4.4 ⚡ Reservas

```
Implementa reservas de mesa: calendario, disponibilidad por zona/hora, y bloqueo de la
mesa reservada en el plano a la hora correspondiente.
```

### 4.5 🧠 Integración con plataformas de delivery

```
Modo plan primero. Integra pedidos de delivery (Glovo/Uber Eats/Just Eat) volcándolos como
comandas de tipo 'delivery' en el TPV y la cocina. Diseña una capa de integración por
proveedor. Pregúntame antes de dar de alta cada proveedor/credenciales.
```

---

## Resumen de la cadencia

| Fase | Cuándo | Foco | Modelo dominante |
|------|--------|------|------------------|
| 0 | Ahora | Fundaciones (scaffold, BD, auth, UI) | 🧠 + ⚡ |
| 1 | Tras la 0 | MVP usable → **ponerlo en el bar** | ⚡ (con 🧠 en comandas/pagos) |
| 2 | Tras usar el MVP | Legal, tiempo real, móvil, escritorio, offline | 🧠 en lo crítico |
| 3 | Al querer vender | Onboarding, informes, inventario, suscripciones | ⚡ + 🧠 en pagos |
| 4 | Según demanda | Carta QR, pago en mesa, fidelización, reservas, delivery | Mixto |

**Regla de oro del ritmo:** una tarea cada vez, revisa el diff, tests en verde, commit. No saltes de fase sin cerrar el checkpoint anterior. El módulo Veri*factu (2.1) y toda lógica que reparte dinero se hacen con Opus y tests exhaustivos.
