import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

// Factoría en lugar de singleton: cada consumidor (API, tests, scripts) controla
// el ciclo de vida de su conexión. Cierra con db.$client.end() al terminar.
export function createDb(url: string) {
  // prepare: false — el pooler de Supabase en modo transacción (puerto 6543)
  // no soporta prepared statements.
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
