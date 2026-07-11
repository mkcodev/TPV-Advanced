# apps/web — Next.js (TPV + panel admin + landing)

Aún sin generar. Genera la app aquí con el scaffolder oficial (última versión):

```bash
cd apps/web
pnpm create next-app@latest . --ts --app --tailwind --eslint=false --src-dir --import-alias "@/*"
```

Después:
- Añade las dependencias del monorepo: `@tpv/ui`, `@tpv/core`, `@tpv/api`, `@tpv/validators`.
- Configura Biome (ya está en la raíz) y quita ESLint.
- Conecta Supabase con las variables de `.env` (ver `.env.example`).
