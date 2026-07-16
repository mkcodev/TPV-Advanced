import {
  appRouter,
  createAuthResolver,
  createContextFactory,
  createSupabaseJwtVerifier,
  getServerEnv,
} from '@tpv/api';
import { createDb } from '@tpv/db';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

// argon2 (NAPI binaries) requires the Node.js runtime — not compatible with Edge.
export const runtime = 'nodejs';

// Singletons per process: one DB connection pool, one JWKS cache, one resolver.
const env = getServerEnv();
const db = createDb(env.DATABASE_URL);
const verifySupabaseJwt = createSupabaseJwtVerifier(env);
const resolver = createAuthResolver({
  db,
  sessionSecret: env.AUTH_SESSION_SECRET,
  verifySupabaseJwt,
});
const createContext = createContextFactory(resolver, db);

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: ({ req: r }) => createContext({ req: r }),
  });

export { handler as GET, handler as POST };
