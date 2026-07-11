# Cómo continuar el desarrollo en Claude Code

Guía de traspaso: cuándo pasar a Claude Code, cómo hacerlo, y qué instrucciones darle.

---

## 1. ¿Cuándo pasar a Claude Code?

**Ahora.** La fase que acabamos de hacer aquí (pensar, decidir el stack, diseñar el esquema, escribir la documentación) es justo para lo que sirve este modo: razonar y planificar. Pero a partir de aquí el trabajo es **picar código de verdad**: instalar dependencias, generar las apps, ejecutar tests, hacer commits de git e iterar sobre muchos archivos. Eso es exactamente el terreno de **Claude Code** (funciona desde la terminal, junto a tu código, y ve el resultado de cada comando).

Regla simple: **planificar y documentar aquí → programar en Claude Code.**

---

## 2. ¿Hay que "pasar esta conversación" a un proyecto de Claude Code?

**No hace falta transferir el chat.** Y esta es la parte importante que ya hemos resuelto sin querer:

Todo el contexto de esta conversación **ya está guardado en los archivos del proyecto** (`CLAUDE.md` + `/docs`). Claude Code, al abrir la carpeta, **lee automáticamente el `CLAUDE.md`** y tiene ahí las reglas, el stack y los punteros a la documentación. Por eso escribimos esos documentos: para que el contexto viaje con el proyecto, no con el chat.

Es decir: "el proyecto de Claude Code" = **esta misma carpeta** (`next-TPV`) abierta en Claude Code. No copias nada; solo lo abres.

---

## 3. Puesta en marcha (una sola vez)

### Paso a paso en Windows (con PowerShell)

> Requisito: Claude Code necesita una suscripción **Claude Pro o Max** (el plan gratuito no lo incluye).

**Bloque 1 — Instalar las herramientas (una vez).** Abre PowerShell (menú Inicio → escribe "PowerShell" → Enter) y ejecuta, comprobando cada uno:

```powershell
# Node.js LTS (v20+). Instálalo desde nodejs.org o con winget:
winget install OpenJS.NodeJS.LTS
node -v

# pnpm
npm install -g pnpm
pnpm -v

# git
winget install Git.Git
git --version

# Claude Code (instalador nativo oficial para Windows)
irm https://claude.ai/install.ps1 | iex
```

Cierra y reabre PowerShell tras instalar Claude Code, y verifica: `claude --version`.

**Bloque 2 — Abrir la terminal EN la carpeta del proyecto.** En el Explorador de archivos ve a `C:\Users\mikel\Projects\Fast\next-TPV`, haz clic en la **barra de direcciones**, escribe `powershell` y pulsa Enter. Se abre PowerShell ya situado en esa carpeta. (Alternativa: en una PowerShell cualquiera, `cd "C:\Users\mikel\Projects\Fast\next-TPV"`.)

**Bloque 3 — Preparar el proyecto (una vez), en esa terminal:**

```powershell
copy .env.example .env      # luego abre .env y pega tus claves de Supabase
git init
git add -A
git commit -m "chore: initial skeleton, docs and design system"
pnpm install
```

**Bloque 4 — Arrancar Claude Code:** en esa MISMA terminal (dentro de la carpeta) escribe:

```powershell
claude
```

La primera vez abrirá el navegador para iniciar sesión. "Abrir Claude Code" = tener una terminal situada en la carpeta del proyecto y ejecutar `claude`. Al arrancar lee el `CLAUDE.md` solo.

> Alternativa con editor: instala VS Code, abre la carpeta del proyecto, menú Terminal → New Terminal, y ejecuta `claude` ahí. Hay extensión de Claude Code para VS Code si quieres una experiencia integrada.

> El `.env` con tus claves de Supabase nunca se sube a git (ya está en `.gitignore`).

---

## 4. El flujo Opus (planifica) → Sonnet (ejecuta) dentro de Claude Code

En Claude Code puedes elegir el modelo y usar el "modo plan". Aprovéchalo así:

1. **Opus + modo plan** para decisiones y desgloses (arquitectura, el módulo legal, planificar una fase). Opus piensa y **escribe el plan**, sin tocar código todavía. Tú lo revisas.
2. **Sonnet** para ejecutar ese plan: escribir componentes, pantallas CRUD, tests, el trabajo repetitivo. Más barato y rápido.
3. Vuelve a **Opus** solo cuando toque una decisión gorda nueva o el módulo Veri*factu.

Esto es lo que más tokens (y dinero) ahorra: pensar caro una vez, ejecutar barato muchas veces.

---

## 5. Primeros mensajes que darle a Claude Code (copia y pega)

**Mensaje 1 — comprobar que ha cargado el contexto (con cualquier modelo):**
```
Lee CLAUDE.md y todos los archivos de /docs. Resume en 5 líneas qué vamos a
construir y enumera las reglas de oro. No escribas código todavía.
```

**Mensaje 2 — planificar la Fase 1 (con Opus, en modo plan):**
```
Con el esquema de docs/DATABASE-SCHEMA.md y el roadmap de docs/PLANIFICACION-TPV.md,
planifica la Fase 1 (MVP usable en el bar). Desglósala en tareas pequeñas y cerradas,
en orden, indicando qué archivos toca cada una. No escribas código: solo el plan.
```

**Mensaje 3 — generar la app web (con Sonnet), siguiendo el README:**
```
Genera apps/web siguiendo las instrucciones de apps/web/README.md (create-next-app
con TypeScript, App Router y Tailwind). Conéctala a los paquetes del monorepo
(@tpv/ui, @tpv/core, @tpv/api, @tpv/validators). Deja la app arrancando con `pnpm dev`
y confírmame que compila.
```

**Mensaje 4 en adelante — construir por tareas:**
```
Implementa la tarea 1 del plan. Sigue las convenciones de CLAUDE.md (dinero en
céntimos, business_id en las consultas, textos de UI en español vía i18n).
Añade tests si toca lógica de packages/core. Cuando termines, muéstrame el diff.
```

---

## 6. Buenas costumbres para no perder tiempo ni tokens

- **Una tarea cada vez.** No pidas "hazme el TPV entero"; pide la tarea concreta del plan.
- **Revisa los diffs** antes de aceptar. Aprendes y evitas sorpresas.
- **Commits pequeños y frecuentes** (Conventional Commits: `feat:`, `fix:`, `docs:`...). Así siempre puedes volver atrás.
- **Deja que lea el `CLAUDE.md`**, no repitas el contexto en cada mensaje.
- **Cuando cambie algo estructural** (una tabla, una decisión), pídele que actualice `/docs` y `CLAUDE.md` en el mismo cambio.
- Si algo se desvía, recuérdale: *"revisa CLAUDE.md sección X"*.

---

## 7. Resumen en una frase

Abre esta carpeta en Claude Code, ejecuta `pnpm install`, y empieza por el **Mensaje 1**. El `CLAUDE.md` y los `/docs` hacen que Claude Code arranque ya sabiendo qué construir y cómo, sin re-explicar nada.
