// Tests del business router: getSettings / updateSettings (cierre ciego).
// Patrón queuedDb — mismo que cash-session-router.test.ts.
// managerProcedure hace primero SELECT del rol (device) o de la membresía (admin panel).

import type { Database } from '@tpv/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { Context } from '../context';
import { businessRouter } from '../routers/business';
import { createCallerFactory, router } from '../trpc';

// ── helpers ──────────────────────────────────────────────────────────────────

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
          if (['values', 'set', 'where', 'returning'].includes(method)) {
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
    execute: () => Promise.resolve([]),
    transaction: (fn: (tx: Database) => Promise<unknown>) => fn(db as Database),
  } as unknown as Database;

  return { db, calls };
}

const BIZ_A = 'aaa00000-0000-0000-0000-111111111111';
const BIZ_B = 'bbb00000-0000-0000-0000-111111111111';
const DEV_ID = 'dev00000-0000-0000-0000-111111111111';
const EMP_ID = 'emp00000-0000-0000-0000-111111111111';

function deviceCtx(db: Database): Context {
  return {
    auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_A, employeeId: EMP_ID },
    db,
    ip: '127.0.0.1',
  };
}

function adminCtx(db: Database): Context {
  return { auth: { kind: 'admin', userId: 'user-1', businessId: BIZ_A }, db, ip: '127.0.0.1' };
}

const testRouter = router({ business: businessRouter });
const createCaller = createCallerFactory(testRouter);

// Parámetros bind de un fragmento WHERE de Drizzle (para comprobar el business_id usado).
function whereParams(where: unknown): unknown[] {
  return new PgDialect().sqlToQuery(where as Parameters<PgDialect['sqlToQuery']>[0]).params;
}

// ── updateSettings ───────────────────────────────────────────────────────────

describe('business.updateSettings', () => {
  it('worker → FORBIDDEN y no escribe nada', async () => {
    const { db, calls } = queuedDb([[{ role: 'worker' }]]);
    const caller = createCaller(deviceCtx(db));

    await expect(caller.business.updateSettings({ blindCashClose: false })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(calls.find((c) => c.method === 'set')).toBeUndefined();
  });

  it.each([true, false])('manager: blindCashClose=%s llega al SET', async (value) => {
    const { db, calls } = queuedDb([[{ role: 'manager' }], [{ blindCashClose: value }]]);
    const caller = createCaller(deviceCtx(db));

    const result = await caller.business.updateSettings({ blindCashClose: value });

    expect(result).toEqual({ blindCashClose: value });
    const setRow = calls.find((c) => c.method === 'set')?.args[0] as Record<string, unknown>;
    expect(setRow?.blindCashClose).toBe(value);
    expect(setRow?.updatedAt).toBeInstanceOf(Date);
  });

  it('el WHERE usa el business_id del contexto (BIZ_A)', async () => {
    const { db, calls } = queuedDb([[{ role: 'manager' }], [{ blindCashClose: false }]]);
    const caller = createCaller(deviceCtx(db));
    await caller.business.updateSettings({ blindCashClose: false });

    // calls: where del SELECT de rol (manager), luego where del UPDATE.
    const wheres = calls.filter((c) => c.method === 'where');
    const updateWhere = wheres[wheres.length - 1]?.args[0];
    expect(whereParams(updateWhere)).toContain(BIZ_A);
  });

  it('un businessId en el input se rechaza (BAD_REQUEST) y no se escribe', async () => {
    const { db, calls } = queuedDb([[{ role: 'manager' }]]);
    const caller = createCaller(deviceCtx(db));

    await expect(
      caller.business.updateSettings({
        blindCashClose: false,
        businessId: BIZ_B,
      } as unknown as { blindCashClose: boolean }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(calls.find((c) => c.method === 'set')).toBeUndefined();
  });

  it('admin del panel con membresía owner → permitido', async () => {
    const { db, calls } = queuedDb([[{ role: 'owner' }], [{ blindCashClose: false }]]);
    const caller = createCaller(adminCtx(db));

    await caller.business.updateSettings({ blindCashClose: false });
    expect(calls.find((c) => c.method === 'set')).toBeDefined();
  });

  it('admin del panel con membresía staff → FORBIDDEN', async () => {
    const { db } = queuedDb([[{ role: 'staff' }]]);
    const caller = createCaller(adminCtx(db));

    await expect(caller.business.updateSettings({ blindCashClose: false })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

// ── getName ──────────────────────────────────────────────────────────────────

describe('business.getName', () => {
  it('devuelve el nombre del negocio del contexto', async () => {
    const { db } = queuedDb([[{ name: 'Bar Pepe' }]]);
    const caller = createCaller(deviceCtx(db));
    expect(await caller.business.getName()).toEqual({ name: 'Bar Pepe' });
  });

  it('el WHERE usa el business_id del contexto (BIZ_A), nunca otro', async () => {
    const { db, calls } = queuedDb([[{ name: 'Bar Pepe' }]]);
    const caller = createCaller(deviceCtx(db));
    await caller.business.getName();

    const where = calls.find((c) => c.method === 'where')?.args[0];
    const params = whereParams(where);
    expect(params).toContain(BIZ_A);
    expect(params).not.toContain(BIZ_B);
  });

  it('negocio no encontrado → NOT_FOUND', async () => {
    const { db } = queuedDb([[]]);
    const caller = createCaller(deviceCtx(db));
    await expect(caller.business.getName()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('un worker también puede leerlo (solo exige dispositivo)', async () => {
    const { db } = queuedDb([[{ name: 'Bar Pepe' }]]);
    const caller = createCaller(deviceCtx(db));
    await expect(caller.business.getName()).resolves.toEqual({ name: 'Bar Pepe' });
  });

  it('el panel admin (no dispositivo) recibe FORBIDDEN', async () => {
    const { db } = queuedDb([[{ name: 'Bar Pepe' }]]);
    const caller = createCaller(adminCtx(db));
    await expect(caller.business.getName()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ── getSettings ──────────────────────────────────────────────────────────────

describe('business.getSettings', () => {
  it('worker → FORBIDDEN', async () => {
    const { db } = queuedDb([[{ role: 'worker' }]]);
    const caller = createCaller(deviceCtx(db));
    await expect(caller.business.getSettings()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('manager → devuelve el ajuste', async () => {
    const { db } = queuedDb([[{ role: 'manager' }], [{ blindCashClose: true }]]);
    const caller = createCaller(deviceCtx(db));
    expect(await caller.business.getSettings()).toEqual({ blindCashClose: true });
  });
});
