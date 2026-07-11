# CLAUDE.md — next-TPV

Constitución del proyecto para agentes de IA. **Lee este archivo y luego fíate de los documentos a los que apunta, en vez de re-escanear todo el repositorio.** Mantén este archivo corto y actualizado; cuando algo estructural cambie, actualiza este archivo y `/docs`.

> Nota de idioma: **este documento y las explicaciones van en español**. Pero el **código, identificadores, tablas, columnas y mensajes de commit van en inglés** (estándar profesional). Los textos que ve el usuario final van en español vía i18n.

---

## 1. Qué estamos construyendo

Un TPV/POS moderno para hostelería (bares y restaurantes), España. Dos objetivos a la vez:
- **Uso real**: llevar un bar real (un solo local) en el día a día.
- **SaaS vendible**: producto multi-negocio para muchos locales.

Una sola UI de React, reutilizada en web, escritorio y móvil. Primero web, empaquetar escritorio después.

---

## 2. Reglas de oro (cómo se trabaja aquí)

1. **Planificar antes de programar.** El trabajo no trivial lleva un plan corto (qué archivos se tocan, enfoque) antes de editar. Las decisiones de arquitectura/BD/legales se toman en `/docs`, no se improvisan en el código.
2. **Tareas pequeñas y cerradas.** Un archivo o una función cada vez. Es mejor editar archivos existentes que reescribirlos.
3. **No re-escanear el repo cada vez.** Usa la Sección 5 (mapa del proyecto), `/docs/DATABASE-SCHEMA.md` y este archivo como fuente de verdad. Abre solo los archivos que necesitas cambiar.
4. **El dinero son enteros (céntimos).** Nunca uses floats para dinero. `4,50 €` → `450`. Todas las columnas y variables `_cents` son enteros.
5. **Siempre multi-negocio.** Toda consulta de dominio se filtra por `business_id`. Nunca escribas una consulta que pueda filtrar datos entre negocios.
6. **Las tablas legales son de solo añadir.** Nunca UPDATE/DELETE en `billing_records`, `invoices`, `invoice_tax_lines`, `system_events`, `stock_movements`. Las correcciones se hacen con registros nuevos.
7. **Las ventas son fotos (snapshots).** Al vender, copia nombre/precio/IVA en la línea de la comanda. Cambiar un producto después no debe cambiar las comandas pasadas.
8. **Explica para principiante.** El mantenedor está aprendiendo a programar. Cuando tomes una decisión no obvia, añade un comentario de una línea o una nota corta en la respuesta. Evita jerga sin explicar.
9. **Pregunta antes de movimientos grandes o irreversibles** (nueva dependencia de primer nivel, cambio de esquema, borrar archivos, cambiar la autenticación).

---

## 3. Stack tecnológico (definitivo — no cambiar sin preguntar)

| Área | Elección |
|---|---|
| Lenguaje | **TypeScript** en todo (modo strict) |
| Monorepo | **Turborepo** + workspaces de **pnpm** |
| Web (TPV + admin + landing) | **Next.js** (App Router) + **React** |
| App de escritorio (la caja) | **Electron** envolviendo la UI React compartida |
| Móvil (app de camareros) | **Expo** (React Native) |
| UI / estilos | **Tailwind CSS** + **shadcn/ui** |
| Backend / API | Servidor Next.js + **tRPC** (type-safe de extremo a extremo) |
| Base de datos | **PostgreSQL** vía **Supabase** |
| ORM / migraciones | **Drizzle ORM** |
| Auth | **Supabase Auth** (panel admin) + PIN para empleados (TPV) |
| Tiempo real | **Supabase Realtime** (sincronización de dispositivos) |
| Offline | **SQLite** local en Electron + capa de sincronización |
| Validación | **Zod** (esquemas compartidos) |
| Datos / caché | **TanStack Query** |
| Impresión | **ESC/POS** (impresoras térmicas) desde Electron |
| Lint / formato | **Biome** |
| Tests | **Vitest** (unitarios) + **Playwright** (e2e) |
| Hosting | **Vercel** (web) + **Supabase** (BD/auth/almacenamiento) |

**Regla:** ninguna librería nueva sin una razón clara y un OK. Prioriza el stack de arriba.

---

## 4. Estructura del monorepo

```
next-TPV/
├─ apps/
│  ├─ web/          # Next.js: TPV (navegador) + panel admin + landing
│  ├─ desktop/      # Cáscara Electron que envuelve la UI web/POS
│  └─ mobile/       # App de camareros (Expo)
├─ packages/
│  ├─ ui/           # Componentes React compartidos (basados en shadcn)
│  ├─ core/         # Lógica de dominio: precios, IVA, totales, reglas de comanda
│  ├─ db/           # Esquema Drizzle, migraciones, consultas
│  ├─ api/          # Routers tRPC
│  ├─ validators/   # Esquemas Zod compartidos
│  └─ config/       # (futuro) presets de tsconfig, biome, tailwind
├─ docs/
│  ├─ PLANIFICACION-TPV.md    # Visión, funcionalidades, roadmap, legal
│  ├─ DATABASE-SCHEMA.md      # Fuente de verdad del modelo de datos
│  └─ CLAUDE-CODE-SETUP.md    # Cómo continuar en Claude Code
└─ CLAUDE.md
```

> Estado actual: el esqueleto (config raíz + `packages/*` con starters) ya existe. Las `apps/*` aún están sin generar (se crean con sus scaffolders oficiales; ver los README de cada carpeta).

**Dónde vive cada cosa (para no buscar):**
- Modelo de datos / tablas → `packages/db` + `docs/DATABASE-SCHEMA.md`
- Cálculos de negocio (totales, IVA, divisiones) → `packages/core`
- Endpoints de la API → `packages/api`
- UI reutilizable → `packages/ui`
- Módulo legal / Veri*factu → `packages/core/billing` (aislado, el más testeado)

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
pnpm db:migrate        # aplicar migraciones
```

---

## 6. Convenciones de código

- **Código, identificadores, tablas, columnas, commits: en inglés.** **Textos de interfaz de usuario: en español** (vía i18n, para poder añadir más idiomas después — nada de strings en español fijos en los componentes).
- **TypeScript strict.** Nada de `any` salvo que se justifique con un comentario. Prefiere tipos inferidos + validados con Zod.
- **Nombres:** `camelCase` para variables/funciones, `PascalCase` para componentes/tipos, `snake_case` para columnas de BD, `kebab-case` para archivos.
- **Validación en los bordes:** valida toda entrada externa (API, formularios) con Zod.
- **Funciones pequeñas y puras** en `packages/core` (fáciles de testear, sin efectos secundarios).
- **Sin secretos en el código.** Usa variables de entorno. Nunca commitees `.env`.
- **Comentarios:** explica el *porqué*, no el *qué*. Notas cortas bienvenidas para el mantenedor principiante.

---

## 7. Principios de arquitectura

- **Multi-negocio:** `organizations` → `businesses`. Cada fila de dominio lleva `business_id`. Se refuerza el aislamiento con **RLS** de Supabase.
- **Offline-first (escritorio):** la caja sigue funcionando sin internet; la SQLite local sincroniza al volver la conexión. Usa UUIDs (seguros offline) y `updated_at` para resolver conflictos.
- **Módulo legal aislado:** `billing` (encadenamiento por hash + QR + AEAT) va separado, es de solo añadir, y es el código más testeado del proyecto. Nunca acoples la UI directamente a él.
- **Snapshots sobre referencias** para todo lo que se vende (nombre, precio, IVA copiados en la línea).
- Modelo de datos completo: **`docs/DATABASE-SCHEMA.md`** (léelo antes de tocar la BD).

### Design system (estricto — leer antes de tocar UI)
- **Todo estilo sale de un token** de `docs/DESIGN-SYSTEM.md`. **Prohibido** inventar valores: nada de `#hex` en componentes, ni espaciados/tamaños arbitrarios (`p-[13px]`, `text-[15px]`, `z-[9999]`).
- **Espaciado solo en la escala de 4px**; colores solo tokens (`bg-primary`, `text-muted-foreground`...); tipografía solo la escala definida; precios con `tabular-nums` + `formatCents`.
- Base **shadcn/ui** (estilo new-york, base slate, radio 0.5rem, fuente Inter). Si no existe un componente, se crea en `packages/ui` **imitando el patrón** de `packages/ui/src/components/button.tsx` (cva + `cn` + tokens).
- Objetivos táctiles **≥44px** en el TPV. Textos siempre por i18n. Los valores de color viven en `packages/ui/src/styles/tokens.css` (temeable para clientes premium).

---

## 8. Guardarraíles legales (Veri*factu — España, RD 1007/2023)

- Los registros de facturación son **inmutables y encadenados por hash**; las correcciones = nueva `cancellation` + registro nuevo, nunca ediciones.
- Los números de factura son **correlativos por serie, sin huecos** (generación atómica).
- Cada ticket necesita el **QR** legal y (en modo verifactu) la etiqueta `VERI*FACTU`.
- **No inventar el formato del hash/QR.** Al implementar (Fase 2), consulta la especificación técnica oficial de la AEAT vigente y síguela al pie de la letra.
- Somos el "fabricante del SIF" → el software tiene responsabilidad legal. Trata este módulo con el máximo cuidado y cobertura de tests.

---

## 9. Política de tests

Los tests son **obligatorios** en la lógica crítica, ligeros en el resto:
- **Hay que testear:** cálculo de totales e IVA, dividir/juntar comandas, el módulo Veri*factu, y la sincronización offline / resolución de conflictos.
- **Más ligero:** componentes de UI, pantallas CRUD.
- Un cambio en `packages/core` o `billing` no está terminado hasta que sus tests pasan.

---

## 10. Git y flujo de trabajo

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`. Cortos, en inglés, en imperativo.
- Commits pequeños y enfocados. Un cambio lógico por commit.
- Nunca commitees secretos, `node_modules`, salidas de build ni `.env`.

---

## 11. Definición de terminado

Una tarea está terminada cuando: hace lo que se pidió, los tipos compilan, Biome pasa, los tests requeridos pasan, no hay filtración entre negocios, el dinero se maneja en céntimos, y cualquier cambio estructural se refleja en `/docs` + este archivo.

---

## 12. Nunca hagas

- ❌ Floats para dinero.
- ❌ Consultas sin filtro por `business_id`.
- ❌ UPDATE/DELETE en tablas legales / de solo añadir.
- ❌ Strings en español fijos en los componentes (usa i18n).
- ❌ Nueva dependencia pesada sin preguntar.
- ❌ Inventar el formato del hash/QR de Veri*factu en vez de usar la especificación oficial.
- ❌ Reescribir un archivo entero por un cambio pequeño.

---

## 13. Índice de documentos

- `docs/PLANIFICACION-TPV.md` — visión, lista completa de funcionalidades, roadmap, resumen legal, flujo Opus/Sonnet.
- `docs/DATABASE-SCHEMA.md` — el modelo de datos (fuente de verdad).
- `docs/DESIGN-SYSTEM.md` — tokens, componentes y reglas estrictas de UI (fuente de verdad del diseño).
- `docs/PASOS-A-SEGUIR.md` — guía lineal: todos los pasos en orden (empieza aquí).
- `docs/CLAUDE-CODE-SETUP.md` — cómo continuar el desarrollo en Claude Code.
- `docs/ROADMAP-Y-PROMPTS.md` — fases, tareas ordenadas y prompts listos para Claude Code.
- `CLAUDE.md` — este archivo: stack, convenciones, guardarraíles.

*Mantén estos documentos sincronizados. Existen para que los agentes no tengan que re-deducir el contexto en cada sesión.*
