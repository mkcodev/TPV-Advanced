// Helpers internos del esquema. NO se re-exportan desde index.ts.

import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { pgPolicy, timestamp, uuid } from 'drizzle-orm/pg-core';

// PK estándar: uuid generado por la BD (mejor que autoincremental para offline/distribuido).
export const id = {
  id: uuid('id').defaultRandom().primaryKey(),
};

// created_at + updated_at para tablas mutables.
// $onUpdate refresca updated_at automáticamente en cada UPDATE hecho vía Drizzle.
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// Solo created_at: tablas append-only y junctions (sus filas no se actualizan).
export const createdAt = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
};

// CHECK de enum: genera `columna IN ('a', 'b', ...)`.
// Los valores salen de constantes propias (sin riesgo de inyección) y van como
// texto SQL literal porque un CHECK constraint no admite parámetros.
export const inEnum = (column: SQLWrapper, values: readonly string[]): SQL =>
  sql`${column} in ${sql.raw(`('${values.join("', '")}')`)}`;

// --- RLS (defensa en profundidad; la primaria es businessProcedure en tRPC) ---
// Postura solo-lectura: SOLO políticas SELECT. Sin políticas de INSERT/UPDATE/
// DELETE, Postgres deniega la escritura ⇒ los clientes supabase-js no pueden
// escribir nada; toda escritura pasa por tRPC (rol owner de la BD, salta RLS).
// has_business_access() cubre los dos caminos: GUC app.business_id y membership
// del JWT de Supabase Auth (ver migración 0001_rls_helpers).

// Política SELECT estándar para tablas con columna business_id propia.
export const tenantSelectPolicy = (tableName: string) =>
  pgPolicy(`${tableName}_tenant_select`, {
    for: 'select',
    using: sql`public.has_business_access(business_id)`,
  });

// Política SELECT con predicado a medida (tablas hijas vía EXISTS al padre, etc.).
export const selectPolicy = (tableName: string, using: SQL) =>
  pgPolicy(`${tableName}_tenant_select`, { for: 'select', using });
