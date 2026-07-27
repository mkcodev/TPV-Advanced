// Tests del cashSession router: open, addMovement, close, getZReport.
// Patrón queuedDb — mismo que orders-invoice.test.ts.

import type { Database } from '@tpv/db';
import { describe, expect, it } from 'vitest';
import type { Context } from '../context';
import { cashSessionRouter } from '../routers/cash-session';
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
const SESSION_ID = '5e500000-0000-0000-0000-111111111111';
const MOV_ID = 'mov00000-0000-0000-0000-111111111111';

function deviceCtx(bizId = BIZ_A): Context {
  return {
    auth: { kind: 'device', deviceId: DEV_ID, businessId: bizId, employeeId: EMP_ID },
    db: {} as Database,
    ip: '127.0.0.1',
  };
}

const testRouter = router({ cashSession: cashSessionRouter });
const createCaller = createCallerFactory(testRouter);

// ── open ────────────────────────────────────────────────────────────────────

describe('cashSession.open', () => {
  it('inserta la sesión con openingAmountCents y status open', async () => {
    const { db, calls } = queuedDb([
      [{ id: SESSION_ID, status: 'open', openingAmountCents: 10000 }], // INSERT RETURNING
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.open({ openingAmountCents: 10000 });

    expect(result.id).toBe(SESSION_ID);

    const valuesCall = calls.find((c) => c.method === 'values' && !Array.isArray(c.args[0]));
    const row = valuesCall?.args[0] as Record<string, unknown>;
    expect(row?.openingAmountCents).toBe(10000);
    expect(row?.status).toBe('open');
    expect(row?.openedBy).toBe(EMP_ID);
    expect(row?.deviceId).toBe(DEV_ID);
    expect(row?.businessId).toBe(BIZ_A);
  });

  it('lanza CONFLICT cuando ya hay una sesión open (simula unique_violation)', async () => {
    // queuedDb no puede simular un INSERT que lanza error de DB directamente,
    // así que probamos la ruta de error con un db stub que lanza la excepción.
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
      insert: () => ({
        values: () => ({
          returning: () => {
            const err = Object.assign(new Error('unique'), { code: '23505' });
            return Promise.reject(err);
          },
        }),
      }),
      execute: () => Promise.resolve([]),
      transaction: (fn: (tx: Database) => Promise<unknown>) => fn(db as Database),
    } as unknown as Database;

    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.cashSession.open({ openingAmountCents: 5000 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

// ── addMovement ──────────────────────────────────────────────────────────────

describe('cashSession.addMovement', () => {
  it('lanza PRECONDITION_FAILED sin sesión open', async () => {
    const { db } = queuedDb([
      [], // SELECT cashSessions → vacío
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(
      caller.cashSession.addMovement({ type: 'pay_out', amountCents: 2000, reason: 'test' }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('inserta el movimiento cuando hay sesión open', async () => {
    const { db, calls } = queuedDb([
      [{ id: SESSION_ID }], // SELECT cashSessions → open
      [{ id: MOV_ID, type: 'pay_out', amountCents: 2000, reason: 'Pagar repartidor' }], // INSERT RETURNING
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.addMovement({
      type: 'pay_out',
      amountCents: 2000,
      reason: 'Pagar repartidor',
    });

    expect(result.id).toBe(MOV_ID);

    const valuesCall = calls.find((c) => c.method === 'values' && !Array.isArray(c.args[0]));
    const row = valuesCall?.args[0] as Record<string, unknown>;
    expect(row?.cashSessionId).toBe(SESSION_ID);
    expect(row?.type).toBe('pay_out');
    expect(row?.amountCents).toBe(2000);
    expect(row?.reason).toBe('Pagar repartidor');
    expect(row?.employeeId).toBe(EMP_ID);
  });
});

// ── close ────────────────────────────────────────────────────────────────────

describe('cashSession.close', () => {
  it('lanza PRECONDITION_FAILED sin sesión open', async () => {
    const { db } = queuedDb([
      [], // SELECT cashSessions FOR UPDATE → vacío
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.cashSession.close({ countedAmountCents: 10000 })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('calcula expected y diff correctamente y cierra la sesión', async () => {
    // fondo=10000, cashPayments=2500, payIn=500, payOut=1000 → expected=12000
    // counted=12010 → diff=10
    const { db, calls } = queuedDb([
      [{ id: SESSION_ID, openingAmountCents: 10000, status: 'open' }], // SELECT FOR UPDATE
      [{ total: 2500 }], // SUM payments cash
      [{ total: 500 }], // SUM cash_movements pay_in
      [{ total: 1000 }], // SUM cash_movements pay_out
      [{}], // UPDATE cashSessions
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.close({ countedAmountCents: 12010 });

    expect(result.expectedAmountCents).toBe(12000);
    expect(result.differenceCents).toBe(10);
    expect(result.sessionId).toBe(SESSION_ID);

    // El UPDATE debe llevar status='closed' y los valores calculados.
    const setCall = calls.find((c) => c.method === 'set');
    const setRow = setCall?.args[0] as Record<string, unknown>;
    expect(setRow?.status).toBe('closed');
    expect(setRow?.expectedAmountCents).toBe(12000);
    expect(setRow?.differenceCents).toBe(10);
    expect(setRow?.countedAmountCents).toBe(12010);
    expect(setRow?.closedBy).toBe(EMP_ID);
  });

  it('diff=0 cuando contado = esperado', async () => {
    const { db } = queuedDb([
      [{ id: SESSION_ID, openingAmountCents: 10000, status: 'open' }],
      [{ total: 0 }],
      [{ total: 0 }],
      [{ total: 0 }],
      [{}],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.close({ countedAmountCents: 10000 });

    expect(result.expectedAmountCents).toBe(10000);
    expect(result.differenceCents).toBe(0);
  });
});

// ── getZReport — multi-tenant ─────────────────────────────────────────────────

describe('cashSession.getZReport — aislamiento multi-tenant', () => {
  it('NOT_FOUND cuando la sesión no pertenece al businessId del ctx', async () => {
    const { db } = queuedDb([
      [], // SELECT cashSessions → vacío (WHERE businessId = BIZ_B excluye sesión de BIZ_A)
    ]);
    const caller = createCaller({ ...deviceCtx(BIZ_B), db });

    await expect(caller.cashSession.getZReport({ sessionId: SESSION_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
