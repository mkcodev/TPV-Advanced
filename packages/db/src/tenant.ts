import { sql } from 'drizzle-orm';
import type { Database } from './client';

// Tipo de la transacción que Drizzle pasa al callback de db.transaction().
export type BusinessTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

// Ejecuta fn dentro de una transacción con el GUC app.business_id fijado, que es
// lo que lee public.request_business_id() en las políticas RLS (migración 0001).
// set_config(..., true) equivale a SET LOCAL: el valor muere al cerrar la
// transacción y no contamina otras consultas que reusen la conexión del pool.
//
// Nota honesta: la conexión Drizzle actual entra como rol owner (postgres), que
// SALTA RLS — en este camino la defensa real es businessProcedure (tRPC). Este
// helper deja el contrato preparado para un futuro rol runtime no-owner
// (mínimo privilegio), donde RLS aplicaría también a las consultas del servidor.
export async function withBusinessContext<T>(
  db: Database,
  businessId: string,
  fn: (tx: BusinessTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.business_id', ${businessId}, true)`);
    return fn(tx);
  });
}
