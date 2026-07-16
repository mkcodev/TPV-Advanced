-- Table-level GRANTs para roles Supabase (anon, authenticated).
-- Cuando drizzle-kit crea las tablas por SQL directo (fuera del dashboard de
-- Supabase), los grants por defecto que Supabase aplica vía event triggers no
-- se disparan. Resultado: RLS aísla filas correctamente, pero el rol no llega
-- ni a leer la tabla ("permission denied for table X"). Este archivo repara.
--
-- Postura solo-lectura: solo SELECT. Ningún INSERT/UPDATE/DELETE.
-- El camino servidor usa el rol owner (postgres), que salta RLS y grants —
-- no afecta a tRPC.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--> statement-breakpoint
-- Re-aplicar la restricción column-level de employees: el GRANT SELECT anterior
-- habría reconcedido acceso a pin_hash y compañía.
REVOKE SELECT ON TABLE public.employees FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT (id, business_id, user_id, name, avatar_url, role, is_active, created_at, updated_at)
  ON public.employees TO authenticated;
