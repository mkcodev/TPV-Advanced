import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { ServerEnv } from '../env';

export interface AdminJwtPayload {
  userId: string;
}

export type JwtVerifier = (jwt: string) => Promise<AdminJwtPayload | null>;

// JWKS endpoint is cached at module level: one fetch per process, not per request.
let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return _jwks;
}

// Returns a verifier that tries RS256 (standard Supabase JWKS) first, then
// falls back to HS256 if SUPABASE_JWT_SECRET is set (legacy projects).
export function createSupabaseJwtVerifier(
  env: Pick<ServerEnv, 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_JWT_SECRET'>,
): JwtVerifier {
  return async function verify(jwt: string): Promise<AdminJwtPayload | null> {
    // Try RS256 via JWKS
    try {
      const jwks = getJwks(env.NEXT_PUBLIC_SUPABASE_URL);
      const { payload } = await jwtVerify(jwt, jwks);
      if (typeof payload.sub !== 'string') return null;
      return { userId: payload.sub };
    } catch (err) {
      // Log en dev para diagnosticar fallos de JWKS/RS256.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[jwt] RS256 verification failed:', err);
      }
      // Fall through to HS256 fallback
    }

    // HS256 fallback for legacy Supabase projects that use a shared secret
    if (!env.SUPABASE_JWT_SECRET) return null;
    try {
      const key = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(jwt, key);
      if (typeof payload.sub !== 'string') return null;
      return { userId: payload.sub };
    } catch {
      return null;
    }
  };
}
