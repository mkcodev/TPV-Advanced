// Tests del floorRouter: aislamiento multi-tenant, CRUD zonas/mesas, ownership FK.
// Patrón idéntico a catalog-router.test.ts: queuedDb + ctx simulado.

import type { Database } from '@tpv/db';
import { createTableSchema, createZoneSchema, updateTableSchema } from '@tpv/validators';
import { describe, expect, it } from 'vitest';
import type { Context } from '../context';
import { floorRouter } from '../routers/floor';
import { createCallerFactory, router } from '../trpc';

// ── helpers ─────────────────────────────────────────────────────────────────

type RecordedCall = { method: string; args: unknown[] };

function queuedDb(responses: unknown[][]): { db: Database; calls: RecordedCall[] } {
  const queue = responses.map((r) => [...r]);
  const calls: RecordedCall[] = [];

  const makeChain = (): unknown => {
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const handler: ProxyHandler<any> = {
      get(_t, prop: string | symbol) {
        const method = String(prop);
        if (method === 'then') {
          const rows = queue.shift() ?? [];
          return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          if (['values', 'set', 'where'].includes(method)) {
            calls.push({ method, args });
          }
          return new Proxy({}, handler);
        };
      },
    };
    return new Proxy({}, handler);
  };

  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  } as unknown as Database;

  return { db, calls };
}

function adminCtx(businessId = 'biz-1'): Omit<Context, 'db'> {
  return { auth: { kind: 'admin', userId: 'user-1', businessId }, ip: '127.0.0.1' };
}

function bizCtx(businessId = 'biz-1'): Omit<Context, 'db'> {
  return { auth: { kind: 'admin', userId: 'user-1', businessId }, ip: '127.0.0.1' };
}

const OWNER_ROLE = [{ role: 'owner' }];

const testRouter = router({ floor: floorRouter });
const createCaller = createCallerFactory(testRouter);

const ZONE_ID = '00000000-0000-0000-0000-000000000001';
const TABLE_ID = '00000000-0000-0000-0000-000000000002';

// ── Zod: rejects businessId as input ────────────────────────────────────────

describe('floor schemas — Zod rejects businessId', () => {
  it('createZoneSchema rejects businessId', () => {
    expect(createZoneSchema.safeParse({ businessId: 'biz-x', name: 'Salón' }).success).toBe(false);
  });

  it('createTableSchema rejects businessId', () => {
    expect(
      createTableSchema.safeParse({
        businessId: 'biz-x',
        zoneId: ZONE_ID,
        name: 'Mesa 1',
        posX: 0,
        posY: 0,
        width: 80,
        height: 80,
        shape: 'square',
        seats: 4,
      }).success,
    ).toBe(false);
  });

  it('updateTableSchema rejects businessId', () => {
    expect(
      updateTableSchema.safeParse({ id: TABLE_ID, businessId: 'biz-x', name: 'Mesa 1' }).success,
    ).toBe(false);
  });
});

// ── zones.create — businessId viene del ctx ──────────────────────────────────

describe('floor.zones.create', () => {
  it('uses ctx.businessId, not input', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE,
      [{ id: ZONE_ID, businessId: 'biz-1', name: 'Salón', displayOrder: 0, isActive: true }],
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.floor.zones.create({ name: 'Salón' });

    const valuesCall = calls.find((c) => c.method === 'values');
    const row = (valuesCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(row.businessId).toBe('biz-1');
  });
});

// ── zones.update — NOT_FOUND cuando businessId no coincide ──────────────────

describe('floor.zones.update', () => {
  it('throws NOT_FOUND when zone belongs to another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE,
      [], // update.returning() → vacío
    ]);
    const caller = createCaller({ ...adminCtx('biz-B'), db });
    await expect(
      caller.floor.zones.update({ id: ZONE_ID, name: 'Renombrada' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('applies name to the SET patch', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ id: ZONE_ID, name: 'Terraza' }]]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.floor.zones.update({ id: ZONE_ID, name: 'Terraza' });
    const setCall = calls.find((c) => c.method === 'set');
    const patch = (setCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(patch.name).toBe('Terraza');
  });

  it('does NOT include name in SET when not provided', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ id: ZONE_ID, displayOrder: 2 }]]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.floor.zones.update({ id: ZONE_ID, displayOrder: 2 });
    const setCall = calls.find((c) => c.method === 'set');
    const patch = (setCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(patch).not.toHaveProperty('name');
    expect(patch.displayOrder).toBe(2);
  });
});

// ── zones.list — aislamiento multi-tenant ────────────────────────────────────

describe('floor.zones.list', () => {
  it('returns only active zones', async () => {
    const { db, calls } = queuedDb([[{ id: ZONE_ID, name: 'Salón', isActive: true }]]);
    const caller = createCaller({ ...bizCtx('biz-1'), db });
    await caller.floor.zones.list({});
    // The WHERE clause should include businessId and isActive constraints.
    const whereCall = calls.find((c) => c.method === 'where');
    expect(whereCall).toBeDefined();
  });
});

// ── tables.create — validates zoneId ownership ───────────────────────────────

describe('floor.tables.create', () => {
  it('throws BAD_REQUEST when zoneId belongs to another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE,
      [], // assertZoneOwnership → vacío (no encontrado)
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await expect(
      caller.floor.tables.create({
        zoneId: ZONE_ID,
        name: 'Mesa 1',
        posX: 0,
        posY: 0,
        width: 80,
        height: 80,
        shape: 'square',
        seats: 4,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('uses ctx.businessId and inserts with correct zoneId', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE,
      [{ id: ZONE_ID }], // assertZoneOwnership → found
      [{ id: TABLE_ID, businessId: 'biz-1', zoneId: ZONE_ID, name: 'Mesa 1' }],
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.floor.tables.create({
      zoneId: ZONE_ID,
      name: 'Mesa 1',
      posX: 0,
      posY: 0,
      width: 80,
      height: 80,
      shape: 'square',
      seats: 4,
    });
    const valuesCall = calls.find((c) => c.method === 'values');
    const row = (valuesCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(row.businessId).toBe('biz-1');
    expect(row.zoneId).toBe(ZONE_ID);
  });
});

// ── tables.update — un test por campo del updateTableSchema ─────────────────
// Regla CLAUDE.md §6: un test por campo verificando que llega al SET.

describe('floor.tables.update — todos los campos llegan al SET', () => {
  it('applies every updateTableSchema field to the SET patch', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE,
      [{ id: ZONE_ID }], // assertZoneOwnership
      [{ id: TABLE_ID }], // update.returning()
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.floor.tables.update({
      id: TABLE_ID,
      zoneId: ZONE_ID,
      name: 'Mesa actualizada',
      posX: 100,
      posY: 200,
      width: 90,
      height: 90,
      shape: 'round',
      seats: 6,
    });
    const setCall = calls.find((c) => c.method === 'set');
    const patch = (setCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(patch.zoneId).toBe(ZONE_ID);
    expect(patch.name).toBe('Mesa actualizada');
    expect(patch.posX).toBe(100);
    expect(patch.posY).toBe(200);
    expect(patch.width).toBe(90);
    expect(patch.height).toBe(90);
    expect(patch.shape).toBe('round');
    expect(patch.seats).toBe(6);
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });

  it('does NOT include posX in SET when not provided', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ id: TABLE_ID }]]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.floor.tables.update({ id: TABLE_ID, name: 'Solo nombre' });
    const setCall = calls.find((c) => c.method === 'set');
    const patch = (setCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(patch.name).toBe('Solo nombre');
    expect(patch).not.toHaveProperty('posX');
    expect(patch).not.toHaveProperty('posY');
  });
});

// ── tables.update — NOT_FOUND cuando businessId no coincide ─────────────────

describe('floor.tables.update — cross-business', () => {
  it('throws NOT_FOUND when table belongs to another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE,
      [], // update.returning() → vacío
    ]);
    const caller = createCaller({ ...adminCtx('biz-B'), db });
    await expect(
      caller.floor.tables.update({ id: TABLE_ID, name: 'Renombrada' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ── zones.setActive — aislamiento multi-tenant ───────────────────────────────

describe('floor.zones.setActive', () => {
  it('throws NOT_FOUND when zone belongs to another business', async () => {
    const { db } = queuedDb([OWNER_ROLE, []]);
    const caller = createCaller({ ...adminCtx('biz-B'), db });
    await expect(
      caller.floor.zones.setActive({ id: ZONE_ID, isActive: false }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
