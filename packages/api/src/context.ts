// Contexto de autenticación de la API — el CONTRATO de la doble defensa.
// La resolución real (verificar JWT de Supabase / token de dispositivo) llega
// en la tarea 0.4; aquí solo se fija la forma que el resto del código consume.

// Unión discriminada: TypeScript obliga a tratar cada camino por separado.
export type AuthContext =
  // Petición sin credenciales (landing, carta pública).
  | { kind: 'anonymous' }
  // Panel admin (Supabase Auth). businessId = negocio activo elegido,
  // ya validado contra memberships; null = aún no ha elegido negocio.
  | { kind: 'admin'; userId: string; businessId: string | null }
  // TPV / tablet de camarero (token de dispositivo + PIN). El businessId sale
  // de la fila devices — NUNCA del cliente. employeeId = quién fichó con PIN.
  | { kind: 'device'; deviceId: string; businessId: string; employeeId: string | null };

export interface Context {
  auth: AuthContext;
}

// Adaptador que la 0.4 implementará: de las cabeceras HTTP al AuthContext.
export interface AuthResolver {
  resolveAuth(opts: { headers: Headers }): Promise<AuthContext>;
}

// Fabrica el createContext que consume el adapter HTTP de tRPC.
export function createContextFactory(resolver: AuthResolver) {
  return async function createContext(opts: { headers: Headers }): Promise<Context> {
    return { auth: await resolver.resolveAuth(opts) };
  };
}
