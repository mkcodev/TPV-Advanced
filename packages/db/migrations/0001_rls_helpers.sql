-- Custom migration: RLS helper functions + column-level grants on employees.
-- Las políticas SELECT que usan estas funciones llegan en 0002_rls_policies.

-- GUC transaccional del camino tRPC/Drizzle: withBusinessContext() ejecuta
-- set_config('app.business_id', <uuid>, true) al abrir la transacción.
-- current_setting(..., true) devuelve NULL (no error) si el GUC no está definido.
CREATE OR REPLACE FUNCTION public.request_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.business_id', true), '')::uuid;
$$;
--> statement-breakpoint
-- Organizaciones a las que pertenece el usuario autenticado (auth.uid()).
-- SECURITY DEFINER: lee memberships saltando su propia RLS (evita recursión).
-- search_path vacío: obliga a rutas cualificadas y evita hijack de search_path.
CREATE OR REPLACE FUNCTION public.user_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.organization_id
  FROM public.memberships m
  WHERE m.user_id = (SELECT auth.uid());
$$;
--> statement-breakpoint
-- ¿Puede el peticionario ver el negocio bid?
-- Camino 1 (GUC): la transacción declaró app.business_id (tRPC con rol runtime no-owner futuro).
-- Camino 2 (JWT): el usuario admin pertenece a la organización dueña del negocio.
CREATE OR REPLACE FUNCTION public.has_business_access(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT bid = public.request_business_id()
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      JOIN public.memberships m ON m.organization_id = b.organization_id
      WHERE b.id = bid
        AND m.user_id = (SELECT auth.uid())
    );
$$;
--> statement-breakpoint
-- RLS filtra filas, no columnas: pin_hash (y datos laborales sensibles) no deben
-- llegar NUNCA a un cliente supabase-js. Grants a nivel de columna.
REVOKE SELECT ON TABLE public.employees FROM anon, authenticated;
--> statement-breakpoint
-- Nota: con grants por columna, supabase-js debe pedir columnas explícitas en
-- employees — un select('*') fallará con permission denied.
-- Fuera de la lista: pin_hash, failed_pin_attempts, locked_until, hourly_wage_cents.
GRANT SELECT (id, business_id, user_id, name, avatar_url, role, is_active, created_at, updated_at)
  ON public.employees TO authenticated;
