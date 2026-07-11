# CLAUDE.md — next-TPV

Constitución del proyecto para agentes de IA. **Lee este archivo y luego fíate de los documentos a los que apunta, en vez de re-escanear todo el repositorio.** Mantén este archivo corto y actualizado; cuando algo estructural cambie, actualiza este archivo y `/docs`.

> Nota de idioma: **este documento y las explicaciones van en español**. Pero el **código, identificadores, tablas, columnas y mensajes de commit van en inglés** (estándar profesional). Los textos que ve el usuario final van en español vía i18n.

---

## 1. Qué estamos construyendo

Un TPV/POS moderno para hostelería (bares y restaurantes), España. Dos objetivos a la vez:
- **Uso real**: llevar un bar real (un solo local) en el día a día.
- **SaaS vendible**: producto multi-negocio para muchos locales.

**Reparto de UI entre plataformas:**
- **apps/web**: TPV + admin + landing. Todo React/Next.js.
- **apps/desktop** (Electron): cáscara que carga la **misma UI web al 100%**. No se reescribe nada.
- **apps/mobile** (app de camareros): **PWA primero** (ruta `/waiter` en apps/web, instalable). Comparte solo `@tpv/core`, `@tpv/api`, `@tpv/validators`. Expo diferido — solo si surge necesidad nativa real (impresión BT, NFC).

Primero web, empaquetar escritorio después.

---

## 2. Reglas de oro (cómo se trabaja aquí)

1. **Planificar antes de programar.** El trabajo no trivial lleva un plan corto (qué archivos se tocan, enfoque) antes de editar. Las decisiones de arquitectura/BD/legales se toman en `/docs`, no se improvisan en el código.
2. **Tareas pequeñas y cerradas.** Un archivo o una función cada vez. Es mejor editar archivos existentes que reescribirlos.
3. **No re-escanear el repo cada vez.** Usa la Sección 5 (mapa del proyecto), `/docs/DATABASE-SCHEMA.md` y este archivo como fuente de verdad. Abre solo los archivos que necesitas cambiar.
4. **El dinero son enteros (céntimos).** Nunca uses floats para dinero. `4,50 €` → `450`. Todas las columnas y variables `_cents` son enteros.
5. **Siempre multi-negocio.** El `business_id` se deriva SIEMPRE del contexto de autenticación (middleware `businessProcedure`). Está **prohibido aceptar `business_id` como parámetro de entrada en cualquier endpoint**. Nunca escribas una consulta que pueda filtrar datos entre negocios.
6. **Las tablas legales son de solo añadir.** Nunca UPDATE/DELETE en `billing_records`, `invoices`, `invoice_tax_lines`, `system_events`, `stock_movements`, `time_entries`. Las correcciones se hacen con registros nuevos.
7. **Las ventas son fotos (snapshots).** Al vender, copia nombre/precio/IVA en la línea de la comanda. Cambiar un producto después no debe cambiar las comandas pasadas.
8. **El servidor es autoritativo para los totales.** El cliente calcula para feedback optimista (UI instantánea), pero el servidor siempre recalcula con `@tpv/core.orderTaxBreakdown` antes de persistir, cobrar o facturar.
9. **Explica para principiante.** El mantenedor está aprendiendo a programar. Cuando tomes una decisión no obvia, añade un comentario de una línea o una nota corta en la respuesta. Evita jerga sin explicar.
10. **Pregunta antes de movimientos grandes o irreversibles** (nueva dependencia de primer nivel, cambio de esquema, borrar archivos, cambiar la autenticación).

---

## 3. Stack tecnológico (definitivo — no cambiar sin preguntar)

| Área | Elección |
|---|---|
| Lenguaje | **TypeScript** en todo (modo strict) |
| Monorepo | **Turborepo** + workspaces de **pnpm** |
| Web (TPV + admin + landing) | **Next.js** (App Router) + **React** |
| App de escritorio (la caja) | **Electron** envolviendo la UI React compartida |
| Móvil (app de camareros) | **PWA** primero; Expo diferido/condicional |
| UI / estilos | **Tailwind CSS** + **shadcn/ui** |
| Backend / API | Servidor Next.js + **tRPC** (type-safe de extremo a extremo) |
| Base de datos | **PostgreSQL** vía **Supabase** |
| ORM / migraciones | **Drizzle ORM** |
| Auth | **Supabase Auth** (panel admin) + PIN para empleados (TPV) |
| Tiempo real | **Supabase Realtime** (canales privados por business_id) |
| Offline | **SQLite** local en Electron + sync por operaciones append-only |
| Estado TPV (cliente) | **Zustand** (comanda activa, cola offline) |
| Validación | **Zod** (esquemas compartidos) |
| Datos / caché | **TanStack Query** |
| i18n | **next-intl** (App Router-nativo; mensajes compartidos) |
| Impresión | **ESC/POS** (impresoras térmicas) desde Electron |
| Lint / formato | **Biome** |
| Tests | **Vitest** (unitarios) + **Playwright** (e2e) |
| Hosting | **Vercel** (web) + **Supabase** (BD/auth/almacenamiento) |
| Observabilidad | **Sentry** (al desplegar en real) |

**Regla:** ninguna librería nueva sin una razón clara y un OK. Prioriza el stack de arriba.

---

## 4. Estructura del monorepo

```
next-TPV/
├─ apps/
│  ├─ web/          # Next.js: TPV (navegador) + panel admin + landing + PWA /waiter
│  ├─ desktop/      # Cáscara Electron que envuelve la UI web/POS
│  └─ mobile/       # (diferido) Expo React Native — solo si hay necesidad nativa real
├─ packages/
│  ├─ ui/           # Componentes React DOM compartidos (basados en shadcn)
│  ├─ core/         # Lógica de dominio: precios, IVA, totales, reglas de comanda, billing puro
│  ├─ db/           # Esquema Drizzle, migraciones, consultas
│  ├─ api/          # Routers tRPC
│  ├─ validators/   # Esquemas Zod compartidos
│  └─ config/       # (futuro) presets de tsconfig, biome, tailwind
├─ docs/
│  ├─ PLANIFICACION-TPV.md    # Visión, funcionalidades, roadmap, legal
│  ├─ DATABASE-SCHEMA.md      # Fuente de verdad del modelo de datos
│  ├─ DESIGN-SYSTEM.md        # Tokens, componentes y reglas estrictas de UI
│  ├─ AUTH-DEVICES.md         # Autenticación de dispositivos y PIN de empleados
│  ├─ PRINTING.md             # Especificación de impresión (ticket, cocina)
│  ├─ PASOS-A-SEGUIR.md       # Guía lineal de pasos (empieza aquí)
│  ├─ ROADMAP-Y-PROMPTS.md    # Fases, tareas y prompts para Claude Code
│  └─ CLAUDE-CODE-SETUP.md    # Cómo continuar en Claude Code
└─ CLAUDE.md
```

> Estado actual: esqueleto (config raíz + `packages/*` con starters) existe. Las `apps/*` se generan con sus scaffolders oficiales (ver README de cada carpeta).

**Dónde vive cada cosa (para no buscar):**
- Modelo de datos / tablas → `packages/db` + `docs/DATABASE-SCHEMA.md`
- Cálculos de negocio (totales, IVA, divisiones) → `packages/core`
- Módulo legal / Veri*factu → `packages/core/billing` (funciones puras sin IO, las más testeadas)
- Endpoints de la API → `packages/api`
- UI reutilizable → `packages/ui`

---

## 5. Comandos

```bash
pnpm install           # instalar
pnpm dev               # arrancar todas las apps en desarrollo
pnpm --filter web dev  # arrancar una sola app
pnpm build             # construir todo
pnpm test              # tests unitarios (Vitest)
pnpm test:e2e          # Playwright
pnpm lint              # comprobación de Biome
pnpm typecheck         # comprobación de tipos
pnpm db:generate       # Drizzle: generar migración desde el esquema
pnpm db:migrate        # aplicar migraciones (entorno del DATABASE_URL en .env)
```

---

## 6. Convenciones de código

- **Código, identificadores, tablas, columnas, commits: en inglés.** **Textos de interfaz de usuario: en español** (vía i18n — nada de strings en español fijos en los componentes).
- **TypeScript strict.** Nada de `any` salvo que se justifique con un comentario. Prefiere tipos inferidos + validados con Zod.
- **Nombres:** `camelCase` para variables/funciones, `PascalCase` para componentes/tipos, `snake_case` para columnas de BD, `kebab-case` para archivos.
- **Validación en los bordes:** valida toda entrada externa (API, formularios) con Zod.
- **Funciones pequeñas y puras** en `packages/core` (fáciles de testear, sin efectos secundarios).
- **Sin secretos en el código.** Usa variables de entorno. Nunca commitees `.env`.
- **Comentarios:** explica el *porqué*, no el *qué*. Notas cortas bienvenidas para el mantenedor principiante.

---

## 7. Principios de arquitectura

- **Multi-negocio:** `organizations` → `businesses`. Cada fila de dominio lleva `business_id` derivado del contexto de auth. **Doble defensa:** (1) middleware `businessProcedure` en tRPC; (2) RLS con `auth.jwt()` en Supabase. Ver `docs/DATABASE-SCHEMA.md` "Notas de implementación".
- **Servidor autoritativo de totales:** el cliente pinta el estado optimista; el servidor siempre recalcula con `@tpv/core.orderTaxBreakdown` antes de persistir. Los totales enviados por el cliente son ignorados.
- **Emisor legal único por negocio:** solo el nodo emisor designado (caja Electron o backend cloud) escribe en `billing_records`. Evita el fork de la cadena de hash. Ver `docs/DATABASE-SCHEMA.md` módulo 6.
- **Offline = operaciones append-only:** la sincronización se hace por replay idempotente de operaciones (añadir línea, anular, pagar), no por LWW. Los totales se recalculan en servidor tras el replay. Ver `docs/DATABASE-SCHEMA.md` "Offline-first".
- **Módulo legal aislado:** `packages/core/billing` = funciones puras sin IO. La persistencia y el envío AEAT viven en `packages/api`/`db`.
- **Snapshots sobre referencias** para todo lo que se vende (nombre, precio, IVA copiados en la línea).
- Modelo de datos completo: **`docs/DATABASE-SCHEMA.md`** (léelo antes de tocar la BD).

### Design system (estricto — leer antes de tocar UI)
- **Todo estilo sale de un token** de `docs/DESIGN-SYSTEM.md`. **Prohibido** inventar valores: nada de `#hex`, espaciados (`p-[13px]`), `z-[9999]`.
- **Solo `transform`/`opacity`** en animaciones. Duraciones de `--duration-*` en `tokens.css`.
- Base **shadcn/ui** (estilo new-york, base slate, radio 0.5rem, fuente Inter). Componentes nuevos en `packages/ui` con el patrón de `button.tsx` (cva + `cn` + tokens).
- Objetivos táctiles **≥44px** en el TPV. Textos siempre por i18n. Valores en `packages/ui/src/styles/tokens.css`.

---

## 8. Guardarraíles legales (Veri*factu — España, RD 1007/2023)

- Los registros de facturación son **inmutables y encadenados por hash**.
- Las correcciones = factura rectificativa (invoice_type='rectificative') o cancellation+alta según proceda. **Verificar con gestor/AEAT vigente** el procedimiento exacto.
- Los números de factura son **correlativos por serie, sin huecos** (UNIQUE constraint + generación atómica). La serie incluye el año (ej. `A2027`).
- Cada ticket necesita el **QR** legal y (en modo verifactu) la etiqueta `VERI*FACTU`.
- **No inventar el formato del hash/QR.** Al implementar (Fase 2), consulta la especificación técnica oficial de la AEAT vigente. Ver `docs/DATABASE-SCHEMA.md` módulo 6.
- Somos el "fabricante del SIF" → el software tiene responsabilidad legal (multas hasta 150.000 €). Trata este módulo con el máximo cuidado y cobertura de tests. Consultar asesoría jurídica antes de vender a terceros.
- Con ventas reales ya en Fase 1: el **RD 1619/2012** (reglamento de facturación) aplica hoy. Verificar con gestor.

---

## 9. Política de tests

Los tests son **obligatorios** en la lógica crítica, ligeros en el resto:
- **Hay que testear:** cálculo de totales e IVA (incluido el property-test del invariante `SUM(base+cuota) == total`), dividir/juntar comandas, el módulo Veri*factu, sync offline y resolución de conflictos.
- **Más ligero:** componentes de UI, pantallas CRUD.
- Un cambio en `packages/core` o `billing` no está terminado hasta que sus tests pasan.

---

## 10. Git y flujo de trabajo

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`. Cortos, en inglés, en imperativo.
- Commits pequeños y enfocados. Un cambio lógico por commit.
- Nunca commitees secretos, `node_modules`, salidas de build ni `.env`.

---

## 11. Definición de terminado

Una tarea está terminada cuando: hace lo que se pidió, los tipos compilan, Biome pasa, los tests requeridos pasan, no hay filtración entre negocios, el dinero se maneja en céntimos, los totales los calcula el servidor, y cualquier cambio estructural se refleja en `/docs` + este archivo.

---

## 12. Nunca hagas

- ❌ Floats para dinero.
- ❌ `business_id` en el input de un endpoint (siempre del contexto de auth).
- ❌ Consultas sin filtro por `business_id`.
- ❌ UPDATE/DELETE en tablas legales / de solo añadir.
- ❌ Strings en español fijos en los componentes (usa i18n).
- ❌ Nueva dependencia pesada sin preguntar.
- ❌ Inventar el formato del hash/QR de Veri*factu en vez de usar la especificación oficial.
- ❌ Reescribir un archivo entero por un cambio pequeño.
- ❌ Animar `width`/`height`/`margin`/`top` — solo `transform`/`opacity`.
- ❌ `z-[9999]` — usar la escala de z-index del design system.

---

## 13. Índice de documentos

- `docs/PLANIFICACION-TPV.md` — visión, funcionalidades, roadmap, resumen legal, plataformas.
- `docs/DATABASE-SCHEMA.md` — el modelo de datos (fuente de verdad).
- `docs/DESIGN-SYSTEM.md` — tokens, componentes, motion e interacciones del TPV (fuente de verdad del diseño).
- `docs/AUTH-DEVICES.md` — autenticación de dispositivos y PIN de empleados.
- `docs/PRINTING.md` — especificación de impresión (ticket legal, cocina, ESC/POS).
- `docs/PASOS-A-SEGUIR.md` — guía lineal: todos los pasos en orden (empieza aquí).
- `docs/CLAUDE-CODE-SETUP.md` — cómo continuar el desarrollo en Claude Code.
- `docs/ROADMAP-Y-PROMPTS.md` — fases, tareas ordenadas y prompts listos para Claude Code.
- `CLAUDE.md` — este archivo: stack, convenciones, guardarraíles.

*Mantén estos documentos sincronizados. Existen para que los agentes no tengan que re-deducir el contexto en cada sesión.*
