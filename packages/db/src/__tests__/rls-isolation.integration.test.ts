// Test de integración RLS contra la BD real (requiere migraciones aplicadas).
// Se lanza con `pnpm --filter @tpv/db test:integration` — excluido del test normal.
// Todo ocurre en transacciones con rollback: no deja datos en la BD.
//
// Truco: en vez de login real (llega en la 0.4), simulamos los dos caminos como
// hace PostgREST/Supabase por dentro: SET LOCAL ROLE authenticated + GUC
// request.jwt.claims (camino admin JWT) o GUC app.business_id (camino tRPC).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { TransactionRollbackError, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, createDb } from '../client';
import { businesses, memberships, organizations, users, zones } from '../schema/index';
import type { BusinessTransaction } from '../tenant';

const envDir = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
config({ path: resolve(envDir, '.env.local'), override: false });
config({ path: resolve(envDir, '.env'), override: false });

const url = process.env.DATABASE_URL;

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('expected at least one row');
  return row;
}

// Siembra 2 negocios independientes (userA→orgA→bizA, userB→orgB→bizB) + 1 zona cada uno.
async function seedTwoBusinesses(tx: BusinessTransaction) {
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  await tx.insert(users).values([
    { id: userA, email: 'rls-a@test.local' },
    { id: userB, email: 'rls-b@test.local' },
  ]);
  const orgA = first(
    await tx
      .insert(organizations)
      .values({ name: 'RLS Org A', ownerUserId: userA })
      .returning({ id: organizations.id }),
  );
  const orgB = first(
    await tx
      .insert(organizations)
      .values({ name: 'RLS Org B', ownerUserId: userB })
      .returning({ id: organizations.id }),
  );
  await tx.insert(memberships).values([
    { userId: userA, organizationId: orgA.id, role: 'owner' },
    { userId: userB, organizationId: orgB.id, role: 'owner' },
  ]);
  const bizA = first(
    await tx
      .insert(businesses)
      .values({ organizationId: orgA.id, name: 'RLS Bar A' })
      .returning({ id: businesses.id }),
  );
  const bizB = first(
    await tx
      .insert(businesses)
      .values({ organizationId: orgB.id, name: 'RLS Bar B' })
      .returning({ id: businesses.id }),
  );
  await tx.insert(zones).values([
    { businessId: bizA.id, name: 'RLS Zone A' },
    { businessId: bizB.id, name: 'RLS Zone B' },
  ]);
  return { userA, userB, bizA: bizA.id, bizB: bizB.id };
}

describe.skipIf(!url)('RLS isolation (integration)', () => {
  let db: Database;
  let canSetRole = false;

  beforeAll(async () => {
    if (!url) throw new Error('unreachable: describe is skipped without DATABASE_URL');
    db = createDb(url);
    try {
      // El rol de la conexión debe poder ponerse el sombrero de `authenticated`
      // (miembro por defecto en Supabase). Si no, saltamos estos tests.
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local role authenticated`);
      });
      canSetRole = true;
    } catch {
      canSetRole = false;
    }
  });

  afterAll(async () => {
    await db.$client.end();
  });

  // Ejecuta fn en una transacción que SIEMPRE se revierte.
  async function withRollback(fn: (tx: BusinessTransaction) => Promise<void>) {
    await db
      .transaction(async (tx) => {
        await fn(tx);
        tx.rollback();
      })
      .catch((error: unknown) => {
        if (error instanceof TransactionRollbackError) return;
        throw error;
      });
  }

  it('admin JWT path: a member of business A cannot read rows of business B', async (ctx) => {
    if (!canSetRole) return ctx.skip();
    await withRollback(async (tx) => {
      const seeded = await seedTwoBusinesses(tx);
      const claims = JSON.stringify({ sub: seeded.userA, role: 'authenticated' });
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);

      const visibleZones = (await tx.execute(
        sql`select business_id from public.zones where business_id in (${seeded.bizA}, ${seeded.bizB})`,
      )) as { business_id: string }[];
      expect(visibleZones).toHaveLength(1);
      expect(first(visibleZones).business_id).toBe(seeded.bizA);

      const visibleBusinesses = (await tx.execute(
        sql`select id from public.businesses where id in (${seeded.bizA}, ${seeded.bizB})`,
      )) as { id: string }[];
      expect(visibleBusinesses).toHaveLength(1);
      expect(first(visibleBusinesses).id).toBe(seeded.bizA);
    });
  });

  it('anonymous (no JWT, no GUC) sees zero rows', async (ctx) => {
    if (!canSetRole) return ctx.skip();
    await withRollback(async (tx) => {
      const seeded = await seedTwoBusinesses(tx);
      await tx.execute(sql`set local role authenticated`);

      const visible = (await tx.execute(
        sql`select business_id from public.zones where business_id in (${seeded.bizA}, ${seeded.bizB})`,
      )) as { business_id: string }[];
      expect(visible).toHaveLength(0);
    });
  });

  it('GUC path: app.business_id grants access to that business only', async (ctx) => {
    if (!canSetRole) return ctx.skip();
    await withRollback(async (tx) => {
      const seeded = await seedTwoBusinesses(tx);
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`select set_config('app.business_id', ${seeded.bizA}, true)`);

      const visible = (await tx.execute(
        sql`select business_id from public.zones where business_id in (${seeded.bizA}, ${seeded.bizB})`,
      )) as { business_id: string }[];
      expect(visible).toHaveLength(1);
      expect(first(visible).business_id).toBe(seeded.bizA);
    });
  });

  it('read-only posture: direct INSERT is denied even for your own business', async (ctx) => {
    if (!canSetRole) return ctx.skip();
    await withRollback(async (tx) => {
      const seeded = await seedTwoBusinesses(tx);
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`select set_config('app.business_id', ${seeded.bizA}, true)`);

      await expect(
        tx.execute(
          sql`insert into public.zones (business_id, name) values (${seeded.bizA}, 'Forged')`,
        ),
        // Postura solo-lectura: no hay GRANT INSERT ⇒ denegado por privilegios
        // antes de que RLS lo evalúe. Cualquier denegación (permission denied o
        // row-level security) confirma la invariante "cliente no puede escribir".
        // Drizzle envuelve el PostgresError en cause; comprobamos ambos niveles.
      ).rejects.toMatchObject({
        cause: expect.objectContaining({
          message: expect.stringMatching(/permission denied|row-level security/),
        }),
      });
    });
  });

  it.todo('E2E via supabase-js with real login on both paths (after task 0.4)');
});
