// Invariante de seguridad: NINGUNA tabla del esquema sin RLS + ≥1 política
// SELECT, y ninguna política de escritura (postura solo-lectura). Se valida
// leyendo los .sql de migraciones — sin base de datos.
//
// Excepción: tablas server-only (pairing_codes, auth_rate_limits) tienen
// RLS activado (deny-all por defecto) pero SIN política SELECT — son accedidas
// únicamente por la conexión owner del servidor, que salta RLS.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from '../schema/index';

const migrationsDir = resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'migrations');
const migrationsSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
  .join('\n');

// Derivado del esquema real: si mañana se añade una tabla sin política, falla.
const tableNames = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => getTableName(table));

// Tables accessed only by the server (owner connection, which bypasses RLS).
// RLS is enabled for deny-all, but no SELECT policy is needed.
const SERVER_ONLY_TABLES = new Set(['pairing_codes', 'auth_rate_limits']);

describe('RLS migration invariants', () => {
  it('covers the 34 tables of the schema', () => {
    expect(tableNames).toHaveLength(34);
  });

  it('enables row level security on every table', () => {
    for (const name of tableNames) {
      expect(migrationsSql).toContain(`ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('defines at least one SELECT policy per non-server-only table', () => {
    for (const name of tableNames) {
      if (SERVER_ONLY_TABLES.has(name)) continue;
      const policy = new RegExp(`CREATE POLICY "[a-z_]+" ON "${name}" AS PERMISSIVE FOR SELECT`);
      expect(migrationsSql).toMatch(policy);
    }
  });

  it('contains no write policies (read-only posture)', () => {
    expect(migrationsSql).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/i);
  });
});
