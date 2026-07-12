// Helpers internos del esquema. NO se re-exportan desde index.ts.

import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

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
