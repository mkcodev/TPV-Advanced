# Pasos a seguir — EMPIEZA AQUÍ

Guía lineal y completa. Haz los pasos **en este orden, sin saltarte ninguno**. Cada casilla es
un paso. Los prompts exactos para Claude Code están en `docs/ROADMAP-Y-PROMPTS.md` (aquí solo
se indica cuál lanzar y en qué orden).

**Leyenda:** 🧠 = usar **Opus en modo plan** · ⚡ = usar **Sonnet** · 🖥️ = lo haces tú en el ordenador.

---

## PARTE A — Preparar el ordenador (una sola vez)

- [ ] **A1. 🖥️ Instala Node.js LTS (v20 o superior).** Comprueba en la terminal: `node -v` → debe decir v20.x o más.
- [ ] **A2. 🖥️ Instala pnpm:** `npm install -g pnpm`. Comprueba: `pnpm -v`.
- [ ] **A3. 🖥️ Instala git** (si no lo tienes) y configúralo:
  ```bash
  git config --global user.name "Tu Nombre"
  git config --global user.email "tu@email.com"
  ```
- [ ] **A4. 🖥️ Instala un editor** (recomendado VS Code) — opcional pero cómodo.
- [ ] **A5. 🖥️ Instala Claude Code** y accede con tu cuenta.
- [ ] **A6. 🖥️ Crea una cuenta en Supabase** y **dos proyectos**: uno para desarrollo (`tpv-dev`) y otro para producción (`tpv-prod`). Guarda de cada uno: la *Project URL*, la *anon key*, la *service_role key* y la *connection string* (`DATABASE_URL`).
- [ ] **A7. 🖥️ (Opcional) Crea una cuenta en Vercel** para desplegar la web más adelante.

---

## PARTE B — Preparar el proyecto (una sola vez)

- [ ] **B1. 🖥️ Abre una terminal en la carpeta `next-TPV`.**
- [ ] **B2. 🖥️ Crea el archivo `.env`** copiando `.env.example`, y pega tus credenciales de Supabase **de desarrollo** (del proyecto `tpv-dev`):
  ```bash
  cp .env.example .env   # en Windows PowerShell: copy .env.example .env
  ```
  Rellena `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL`.
  > **Importante:** el `.env` solo usa las credenciales de **desarrollo**. Las de producción van en Vercel / CI y nunca en el repo.
- [ ] **B3. 🖥️ Inicia git y haz el primer commit:**
  ```bash
  git init
  git add -A
  git commit -m "chore: initial skeleton, docs and design system"
  ```
- [ ] **B4. 🖥️ Instala las dependencias del monorepo:** `pnpm install`.
- [ ] **B5. 🖥️ Abre Claude Code en la carpeta** (`claude` en la terminal, o desde tu editor). Al arrancar leerá `CLAUDE.md` solo.

---

## Entornos y migraciones

> Lee esto antes de tocar la base de datos.

- **Dos entornos en Supabase:** `tpv-dev` (para desarrollar y probar) y `tpv-prod` (el bar real). Las credenciales de producción **nunca** van en el repo ni en `.env` local.
- **Migraciones solo vía comandos:** nunca editar tablas manualmente en el panel de Supabase. El flujo siempre es:
  1. Editar el esquema en `packages/db/src/schema/`.
  2. `pnpm db:generate` → genera el archivo de migración SQL.
  3. Revisar el SQL generado antes de aplicarlo.
  4. `pnpm db:migrate` → aplica la migración al entorno activo (el del `DATABASE_URL` del `.env`).
- **Seed de datos de ejemplo:** cuando esté disponible, `pnpm db:seed` crea categorías y productos de demo para que el bar del padre pueda probarlo sin picar todo a mano desde cero.
- **Antes de migrar en producción:** probar siempre la migración en `tpv-dev` primero.

---

## El bucle que repites en CADA tarea de código

1. Si la tarea es 🧠 → primero pide el **plan** (Opus, modo plan). Revísalo y apruébalo.
2. Ejecuta con el modelo indicado (⚡ Sonnet salvo que ponga 🧠).
3. **Revisa el diff** que te muestra.
4. Ejecuta las comprobaciones: `pnpm lint && pnpm typecheck && pnpm test`.
5. Si todo pasa, **commit pequeño** (`feat:`, `fix:`, `docs:`...).
6. Siguiente tarea.

> No pases a la siguiente tarea si la actual no compila o los tests fallan.

---

## PARTE C — Arranque en Claude Code (una vez)

- [ ] **C1. Lanza el mensaje de contexto** (bloque "Antes de empezar" de `ROADMAP-Y-PROMPTS.md`): que lea `CLAUDE.md` y `/docs` y confirme qué fase toca. No debe escribir código aún.

---

## PARTE D — FASE 0: Fundaciones (en este orden)

> Prompts en `ROADMAP-Y-PROMPTS.md`, sección FASE 0. Aplica el bucle de arriba en cada una.

- [ ] **D1. ⚡ Tarea 0.1** — Generar la app web (`apps/web`).
- [ ] **D2. 🧠 Tarea 0.2** — Materializar el esquema completo en Drizzle con todos los constraints UNIQUE (plan → código → migración, sin aplicar).
- [ ] **D3. 🖥️ Aplica la migración a Supabase:** con `DATABASE_URL` del entorno dev en el `.env`, ejecuta `pnpm db:migrate`. Verifica en el panel de Supabase que aparecen las tablas.
- [ ] **D4. 🧠 Tarea 0.3** — Conexión a Supabase + doble defensa multi-tenant (businessProcedure + RLS con auth.jwt()).
- [ ] **D5. 🧠 Tarea 0.4** — Autenticación en dos niveles (panel admin + emparejamiento de dispositivo + PIN empleado con lockout). Ver `docs/AUTH-DEVICES.md`.
- [ ] **D6. 🧠 Tarea 0.5** — Design system (shadcn con nuestros tokens). *Antes de cualquier pantalla.*
- [ ] **D7. ⚡ Tarea 0.6** — Armazón de UI + next-intl i18n (solo estructura, con `@tpv/ui`).
- [ ] **D8. 🧠 Tarea 0.7** — Storybook en `packages/ui` (Button + story de tokens + story de Motion).
- [ ] **D9. ⚡ Tarea 0.8** — CI GitHub Actions (lint + typecheck + test en cada PR).
- [ ] **D10. ✅ Checkpoint Fase 0:** el proyecto arranca (`pnpm dev`), la BD existe con RLS y doble defensa, puedes iniciar sesión y emparejar dispositivos, ves el armazón del TPV, Storybook funciona y CI pasa en verde. Commit.

---

## PARTE E — FASE 1: MVP usable en el bar (en este orden)

> Prompts en `ROADMAP-Y-PROMPTS.md`, sección FASE 1. **Cada componente nuevo de UI llega con su story** y debe pasar el checklist de `DESIGN-SYSTEM.md`.

- [ ] **E0. 🧠 Tarea 1.0** — Política de redondeo de IVA por bloques en `@tpv/core` con property-tests. **Hacer ANTES de cualquier pantalla con precios.**
- [ ] **E1. ⚡ Tarea 1.1** — Backend del catálogo (tRPC + Drizzle), incluyendo alérgenos y print_destination.
- [ ] **E2. ⚡ Tarea 1.2** — Panel admin del catálogo + subida de fotos.
- [ ] **E3. ⚡ Tarea 1.3** — Pantalla del TPV: tocar producto → total en vivo (S3 + S10).
- [ ] **E4. ⚡ Tarea 1.4** — Variantes, modificadores y menús.
- [ ] **E5. ⚡ Tarea 1.5** — Plano visual de sala y mesas (S5). Sin current_order_id — usar índice parcial.
- [ ] **E6. 🧠 Tarea 1.6** — Persistir comandas y aparcarlas en mesas.
- [ ] **E7. 🧠 Tarea 1.7** — Dividir cuenta, juntar mesas, transferir.
- [ ] **E8. 🧠 Tarea 1.8** — Cobro (efectivo/tarjeta/Bizum/mixto) con S2 (billetes rápidos + cambio grande).
- [ ] **E9. ⚡ Tarea 1.9** — Ticket y comanda de cocina imprimibles (navegador, con hueco QR).
- [ ] **E10. ⚡ Tarea 1.10** — Empleados, login por PIN (S8 chip en líneas), ventas por empleado.
- [ ] **E11. ⚡ Tarea 1.11** — Sesión de caja, cash_movements y cierre Z (con opción de cierre ciego).
- [ ] **E12. ✅ Checkpoint Fase 1:** **instálalo en el bar de tu padre y úsalo unos días.** Apunta lo que falle o incomode y corrígelo antes de seguir. Este uso real es la validación más valiosa.
  > ⚠️ Antes de la primera venta real, verifica con tu gestor los requisitos del RD 1619/2012 (tickets correlativos, conservación).

---

## PARTE F — FASE 2 en adelante (cuando el MVP esté rodado)

Sigue `ROADMAP-Y-PROMPTS.md` con el mismo bucle:

- [ ] **F1. FASE 2** — Veri*factu (🧠, lo más crítico — usar ventana de pruebas AEAT 2026, verificar spec con AEAT) → tiempo real con canales privados → app de camareros PWA → cocina KDS dark → empaquetado Electron → offline (operaciones append-only, NO LWW para dinero). *Cierra el checkpoint antes de la Fase 3.*
- [ ] **F2. FASE 3** — SaaS: onboarding multi-negocio → informes + export gestoría → inventario → suscripciones Stripe → multi-local → registro de jornada (verificar con gestor).
- [ ] **F3. FASE 4** — Diferenciadores: carta QR → pago en mesa → fidelización/fiado → reservas → delivery → Expo nativa (solo si hay necesidad probada).

---

## Reglas que no se saltan nunca (resumen)

- Una tarea cada vez → revisar diff → `lint`/`typecheck`/`test` → commit.
- No saltar de fase sin cerrar su checkpoint.
- 🧠 Opus para arquitectura, esquema, lo legal (Veri*factu, jornada) y todo lo que reparte dinero.
- Dinero en céntimos, `business_id` SIEMPRE del contexto de auth (nunca del input), tablas legales solo-añadir, textos por i18n.
- UI: solo tokens del `DESIGN-SYSTEM.md`; nada inventado. Interacciones del TPV (S1–S10) son parte del sistema.
- Todo lo legal lleva coletilla "verificar con gestor/AEAT vigente". No inventar formatos.

---

## Orden de referencia de documentos

1. `CLAUDE.md` — las reglas (Claude Code lo lee solo).
2. `docs/PASOS-A-SEGUIR.md` — este archivo: el orden.
3. `docs/ROADMAP-Y-PROMPTS.md` — los prompts de cada tarea.
4. `docs/DATABASE-SCHEMA.md` — el modelo de datos.
5. `docs/DESIGN-SYSTEM.md` — los tokens y reglas de UI.
6. `docs/AUTH-DEVICES.md` — autenticación de dispositivos y PIN.
7. `docs/PRINTING.md` — especificación de impresión.
8. `docs/PLANIFICACION-TPV.md` — la visión y el "porqué".
9. `docs/CLAUDE-CODE-SETUP.md` — detalle de la puesta en marcha de Claude Code.
