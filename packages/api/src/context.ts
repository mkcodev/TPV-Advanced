import type { Database } from '@tpv/db';

// Unión discriminada: TypeScript obliga a tratar cada camino por separado.
export type AuthContext =
  // Petición sin credenciales (landing, carta pública).
  | { kind: 'anonymous' }
  // Panel admin (Supabase Auth). businessId = negocio activo elegido,
  // ya validado contra memberships; null = aún no ha elegido negocio.
  | { kind: 'admin'; userId: string; businessId: string | null }
  // TPV / tablet de camarero (token de dispositivo + sesión PIN). El businessId
  // sale de la fila devices — NUNCA del cliente. employeeId = quién fichó con PIN.
  | { kind: 'device'; deviceId: string; businessId: string; employeeId: string | null };

export interface Context {
  auth: AuthContext;
  db: Database;
  // Client IP for rate limiting. In production depends on the reverse proxy
  // forwarding x-forwarded-for; 'unknown' is used as a safe fallback.
  ip: string;
}

// Adaptador de cabeceras HTTP → AuthContext.
export interface AuthResolver {
  resolveAuth(opts: { headers: Headers }): Promise<AuthContext>;
}

// Fabrica el createContext que consume el adapter HTTP de tRPC.
export function createContextFactory(resolver: AuthResolver, db: Database) {
  return async function createContext(opts: { req: Request }): Promise<Context> {
    const ip = opts.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    return {
      auth: await resolver.resolveAuth({ headers: opts.req.headers }),
      db,
      ip,
    };
  };
}
