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

  // E2E con login real vía supabase-js — implementado en 0.4.
  // Requiere NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
  it('E2E via supabase-js with real login on both paths', async (ctx) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceKey || !url) {
      return ctx.skip();
    }

    const { createClient } = await import('@supabase/supabase-js');

    // Admin client to create and clean up test users.
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Unique email suffix prevents collisions between parallel runs.
    const suffix = crypto.randomUUID();
    const emailA = `tpv-e2e+a-${suffix}@test.local`;
    const emailB = `tpv-e2e+b-${suffix}@test.local`;
    const password = `TPV-e2e-${suffix.slice(0, 8)}!`;

    // Pre-clean any orphaned users from previous runs (best-effort).
    const { data: orphans } = await adminClient.auth.admin.listUsers();
    await Promise.all(
      (orphans?.users ?? [])
        .filter((u) => u.email?.startsWith('tpv-e2e+'))
        .map((u) => adminClient.auth.admin.deleteUser(u.id)),
    );

    // Create two independent users in Supabase Auth.
    const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });

    if (errA || errB || !authA.user || !authB.user) {
      ctx.skip();
      return;
    }

    const userAId = authA.user.id;
    const userBId = authB.user.id;

    try {
      // Seed orgs + memberships + businesses using the owner connection.
      const ownerDb = createDb(url);
      let bizAId: string;
      let bizBId: string;

      try {
        // Insert profile rows (users table mirrors auth.users).
        await ownerDb.insert(users).values([
          { id: userAId, email: emailA },
          { id: userBId, email: emailB },
        ]);

        const orgARow = first(
          await ownerDb
            .insert(organizations)
            .values({ name: 'E2E Org A', ownerUserId: userAId })
            .returning({ id: organizations.id }),
        );
        const orgBRow = first(
          await ownerDb
            .insert(organizations)
            .values({ name: 'E2E Org B', ownerUserId: userBId })
            .returning({ id: organizations.id }),
        );

        await ownerDb.insert(memberships).values([
          { userId: userAId, organizationId: orgARow.id, role: 'owner' },
          { userId: userBId, organizationId: orgBRow.id, role: 'owner' },
        ]);

        const bizARow = first(
          await ownerDb
            .insert(businesses)
            .values({ organizationId: orgARow.id, name: 'E2E Bar A' })
            .returning({ id: businesses.id }),
        );
        const bizBRow = first(
          await ownerDb
            .insert(businesses)
            .values({ organizationId: orgBRow.id, name: 'E2E Bar B' })
            .returning({ id: businesses.id }),
        );

        bizAId = bizARow.id;
        bizBId = bizBRow.id;

        // Path 1 — real Supabase JWT: user A logs in, should only see Biz A.
        const clientA = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: loginErr } = await clientA.auth.signInWithPassword({
          email: emailA,
          password,
        });
        expect(loginErr).toBeNull();

        const { data: bizList, error: bizErr } = await clientA
          .from('businesses')
          .select('id')
          .in('id', [bizAId, bizBId]);
        expect(bizErr).toBeNull();
        expect(bizList).toHaveLength(1);
        expect(bizList?.[0]?.id).toBe(bizAId);

        // Path 2 — user B sees only Biz B.
        const clientB = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await clientB.auth.signInWithPassword({ email: emailB, password });

        const { data: bizListB } = await clientB
          .from('businesses')
          .select('id')
          .in('id', [bizAId, bizBId]);
        expect(bizListB).toHaveLength(1);
        expect(bizListB?.[0]?.id).toBe(bizBId);
      } finally {
        await ownerDb.$client.end();
      }
    } finally {
      // Clean up: remove seeded data and auth users.
      await Promise.all([
        adminClient.auth.admin.deleteUser(userAId),
        adminClient.auth.admin.deleteUser(userBId),
      ]);
    }
  });
});
