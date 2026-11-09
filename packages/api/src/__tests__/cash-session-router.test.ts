// Tests del cashSession router: open, addMovement, close, getExpected, getZReport.
// Patrón queuedDb — mismo que orders-invoice.test.ts.
// Cierre ciego: matriz rol × ajuste en getExpected, close y getZReport.

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
    select: (...args: unknown[]) => {
      calls.push({ method: 'select', args });
      return makeChain();
    },
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

    expect(result).toBeDefined();
    if (!result) throw new Error('expected open to return the session');
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

    expect(result).toBeDefined();
    if (!result) throw new Error('expected addMovement to return the movement');
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
      [{ blindCashClose: true }], // SELECT businesses.blind_cash_close
      [{ role: 'manager' }], // SELECT employees.role → manager ve el esperado aunque sea ciego
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
      [{ blindCashClose: true }],
      [{ role: 'manager' }],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.close({ countedAmountCents: 10000 });

    expect(result.expectedAmountCents).toBe(10000);
    expect(result.differenceCents).toBe(0);
  });
});

// ── close — cierre ciego (matriz rol × ajuste) ───────────────────────────────

// fondo=10000, efectivo=2500, pay_in=500, pay_out=1000 → expected=12000; contado=12010 → diff=10
function closeQueue(blind: boolean, role: string): unknown[][] {
  return [
    [{ id: SESSION_ID, openingAmountCents: 10000, status: 'open' }],
    [{ total: 2500 }],
    [{ total: 500 }],
    [{ total: 1000 }],
    [{}], // UPDATE
    [{ blindCashClose: blind }],
    [{ role }],
  ];
}

describe('cashSession.close — cierre ciego', () => {
  it.each([
    ['worker', true, false],
    ['worker', false, true],
    ['manager', true, true],
    ['manager', false, true],
    ['admin', true, true],
  ] as const)('rol %s, ciego=%s → respuesta con esperado: %s', async (role, blind, shown) => {
    const { db, calls } = queuedDb(closeQueue(blind, role));
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.close({ countedAmountCents: 12010 });

    expect(result.expectedAmountCents).toBe(shown ? 12000 : null);
    expect(result.differenceCents).toBe(shown ? 10 : null);

    // La BD guarda SIEMPRE los valores reales, también cuando la respuesta se redacta.
    const setRow = calls.find((c) => c.method === 'set')?.args[0] as Record<string, unknown>;
    expect(setRow?.expectedAmountCents).toBe(12000);
    expect(setRow?.differenceCents).toBe(10);
  });

  it('negocio no encontrado → ciego (fail-closed): worker no ve el esperado', async () => {
    const queue = closeQueue(true, 'worker');
    queue[5] = []; // SELECT businesses → vacío
    const { db } = queuedDb(queue);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.close({ countedAmountCents: 12010 });
    expect(result.expectedAmountCents).toBeNull();
  });

  it('un role en el input se rechaza: el rol solo sale de ctx.employeeId + BD', async () => {
    const { db } = queuedDb(closeQueue(true, 'worker'));
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(
      caller.cashSession.close({
        countedAmountCents: 12010,
        role: 'manager',
      } as unknown as { countedAmountCents: number }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── getExpected ──────────────────────────────────────────────────────────────

// Cola de getExpected: sesión → ajuste del negocio → rol → (si visible) 3 SUM.
function expectedQueue(blind: boolean, role: string): unknown[][] {
  return [
    [{ id: SESSION_ID, openingAmountCents: 10000 }],
    [{ blindCashClose: blind }],
    [{ role }],
    [{ total: 2500 }],
    [{ total: 500 }],
    [{ total: 1000 }],
  ];
}

describe('cashSession.getExpected — matriz rol × ajuste', () => {
  it.each([
    ['worker', true, false],
    ['worker', false, true],
    ['manager', true, true],
    ['manager', false, true],
    ['admin', true, true],
  ] as const)('rol %s, ciego=%s → visible: %s', async (role, blind, visible) => {
    const { db } = queuedDb(expectedQueue(blind, role));
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.getExpected();

    expect(result?.visible).toBe(visible);
    expect(result?.expectedAmountCents).toBe(visible ? 12000 : null);
  });

  it('suma en céntimos enteros con cobros en efectivo, entradas y salidas', async () => {
    const { db } = queuedDb([
      [{ id: SESSION_ID, openingAmountCents: 10000 }],
      [{ blindCashClose: false }],
      [{ role: 'worker' }],
      [{ total: '2550' }], // SUM llega como string desde Postgres
      [{ total: '505' }],
      [{ total: '1001' }],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.getExpected();

    expect(result?.expectedAmountCents).toBe(12054); // 10000 + 2550 + 505 − 1001
    expect(Number.isInteger(result?.expectedAmountCents)).toBe(true);
  });

  it('sin sesión abierta → null', async () => {
    const { db } = queuedDb([[]]);
    const caller = createCaller({ ...deviceCtx(), db });
    expect(await caller.cashSession.getExpected()).toBeNull();
  });

  it('sin empleado con PIN → UNAUTHORIZED', async () => {
    const { db } = queuedDb([]);
    const ctx: Context = {
      auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_A, employeeId: null },
      db,
      ip: '127.0.0.1',
    };
    const caller = createCaller(ctx);
    await expect(caller.cashSession.getExpected()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

// ── getCurrent ───────────────────────────────────────────────────────────────

describe('cashSession.getCurrent', () => {
  it('el select es explícito y no incluye campos de cuadre', async () => {
    const { db, calls } = queuedDb([
      [{ id: SESSION_ID, openingAmountCents: 10000, status: 'open' }],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await caller.cashSession.getCurrent();

    const selectArg = calls.find((c) => c.method === 'select')?.args[0] as Record<string, unknown>;
    expect(Object.keys(selectArg)).toEqual(
      expect.arrayContaining(['id', 'openingAmountCents', 'openedAt', 'openedBy', 'status']),
    );
    expect(selectArg).not.toHaveProperty('expectedAmountCents');
    expect(selectArg).not.toHaveProperty('differenceCents');
    expect(selectArg).not.toHaveProperty('countedAmountCents');
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

// ── getZReport — cierre ciego ────────────────────────────────────────────────

function zReportQueue(status: 'open' | 'closed', blind: boolean, role: string): unknown[][] {
  const closed = status === 'closed';
  return [
    [
      {
        id: SESSION_ID,
        status,
        openingAmountCents: 10000,
        openedBy: EMP_ID,
        closedBy: closed ? EMP_ID : null,
        countedAmountCents: closed ? 12010 : null,
        expectedAmountCents: closed ? 12000 : null,
        differenceCents: closed ? 10 : null,
      },
    ],
    [{ blindCashClose: blind }], // visibilidad
    [{ role }],
    [{ name: 'Bar Demo' }], // cabecera del informe
    [], // payments
    [], // movements
    [{ id: EMP_ID, name: 'Empleado' }], // nombres
  ];
}

describe('cashSession.getZReport — cierre ciego', () => {
  it('informe X (abierta) + worker + ciego → FORBIDDEN', async () => {
    const { db } = queuedDb(zReportQueue('open', true, 'worker'));
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.cashSession.getZReport({ sessionId: SESSION_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('informe X (abierta) + worker + NO ciego → completo', async () => {
    const { db } = queuedDb(zReportQueue('open', false, 'worker'));
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.getZReport({ sessionId: SESSION_ID });
    expect(result.session.id).toBe(SESSION_ID);
  });

  it('informe X (abierta) + manager + ciego → completo', async () => {
    const { db } = queuedDb(zReportQueue('open', true, 'manager'));
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.cashSession.getZReport({ sessionId: SESSION_ID });
    expect(result.session.id).toBe(SESSION_ID);
  });

  it('informe Z (cerrada) + worker + ciego → esperado y descuadre a null, recuento intacto', async () => {
    const { db } = queuedDb(zReportQueue('closed', true, 'worker'));
    const caller = createCaller({ ...deviceCtx(), db });
    const { session } = await caller.cashSession.getZReport({ sessionId: SESSION_ID });

    expect(session.expectedAmountCents).toBeNull();
    expect(session.differenceCents).toBeNull();
    expect(session.countedAmountCents).toBe(12010);
  });

  it('informe Z (cerrada) + manager + ciego → completo', async () => {
    const { db } = queuedDb(zReportQueue('closed', true, 'manager'));
    const caller = createCaller({ ...deviceCtx(), db });
    const { session } = await caller.cashSession.getZReport({ sessionId: SESSION_ID });

    expect(session.expectedAmountCents).toBe(12000);
    expect(session.differenceCents).toBe(10);
  });

  it('informe Z (cerrada) + worker + NO ciego → completo', async () => {
    const { db } = queuedDb(zReportQueue('closed', false, 'worker'));
    const caller = createCaller({ ...deviceCtx(), db });
    const { session } = await caller.cashSession.getZReport({ sessionId: SESSION_ID });

    expect(session.expectedAmountCents).toBe(12000);
  });
});
