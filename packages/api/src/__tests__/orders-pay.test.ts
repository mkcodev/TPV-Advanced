// Tests de orders.pay: total autoritativo del servidor, cálculo de cambio,
// pago mixto, parcial, idempotencia y aislamiento multi-tenant.

import type { Database } from '@tpv/db';
import { payOrderSchema } from '@tpv/validators';
import { describe, expect, it } from 'vitest';
import type { Context } from '../context';
import { ordersRouter } from '../routers/orders';
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

const BIZ_ID = 'biz-00000000-0000-0000-0000-000000000001';
const DEV_ID = 'dev-00000000-0000-0000-0000-000000000001';
const EMP_ID = 'emp-00000000-0000-0000-0000-000000000001';
const ORDER_ID = '11111111-0000-0000-0000-000000000001';
const PAY_ID = 'pay-00000000-0000-0000-0000-000000000001';

function deviceCtx(overrides: Partial<Context> = {}): Context {
  return {
    auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_ID, employeeId: EMP_ID },
    db: {} as Database,
    ip: '127.0.0.1',
    ...overrides,
  };
}

const testRouter = router({ orders: ordersRouter });
const createCaller = createCallerFactory(testRouter);

// Queue de responses para un pago simple que cierra la comanda:
// withBusinessContext → execute (set_config)
// 1. SELECT orders FOR UPDATE       → [order row]
// 2. SELECT orderItems (totals)     → [item row]
// 3. INSERT payments RETURNING      → [{ id: PAY_ID }]
// 4. UPDATE orders SET paid         → [{}]  (rowCount via raw length)
// 5. INSERT orderEvents             → [{}]
function payQueue(
  order = { id: ORDER_ID, status: 'open', totalCents: 1000, orderNumber: 42, version: 2 },
  items = [{ lineTotalCents: 1000, taxRate: '10.00' }],
  paymentRows = [{ id: PAY_ID }],
): unknown[][] {
  return [
    [order], // 1. SELECT order FOR UPDATE
    items, // 2. SELECT orderItems
    paymentRows, // 3. INSERT payments RETURNING
    [{}], // 4. UPDATE orders (rowCount = 1 via array length)
    [{}], // 5. INSERT orderEvents
  ];
}

const CASH_INPUT = {
  orderId: ORDER_ID,
  payments: [{ method: 'cash' as const, amountCents: 1000, cashReceivedCents: 2000 }],
};

// ── Zod rechaza campos prohibidos ────────────────────────────────────────────

describe('payOrderSchema — Zod rechaza campos del servidor', () => {
  it('rechaza totalCents en el input (strict)', () => {
    const result = payOrderSchema.safeParse({
      orderId: ORDER_ID,
      payments: [{ method: 'cash', amountCents: 1000, cashReceivedCents: 1000 }],
      totalCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza businessId en el input (strict)', () => {
    const result = payOrderSchema.safeParse({
      orderId: ORDER_ID,
      businessId: BIZ_ID,
      payments: [{ method: 'cash', amountCents: 1000, cashReceivedCents: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza cash sin cashReceivedCents', () => {
    const result = payOrderSchema.safeParse({
      orderId: ORDER_ID,
      payments: [{ method: 'cash', amountCents: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza card con cashReceivedCents', () => {
    const result = payOrderSchema.safeParse({
      orderId: ORDER_ID,
      payments: [{ method: 'card', amountCents: 1000, cashReceivedCents: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza cashReceivedCents < amountCents', () => {
    const result = payOrderSchema.safeParse({
      orderId: ORDER_ID,
      payments: [{ method: 'cash', amountCents: 1000, cashReceivedCents: 500 }],
    });
    expect(result.success).toBe(false);
  });
});

// ── Sin employeeId → UNAUTHORIZED ────────────────────────────────────────────

describe('orders.pay — sin employeeId', () => {
  it('lanza UNAUTHORIZED si employeeId es null', async () => {
    const { db } = queuedDb([]);
    const caller = createCaller({
      ...deviceCtx(),
      auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_ID, employeeId: null },
      db,
    });
    await expect(caller.orders.pay(CASH_INPUT)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ── Order no encontrada / otro negocio → NOT_FOUND ───────────────────────────

describe('orders.pay — aislamiento multi-tenant', () => {
  it('lanza NOT_FOUND cuando la comanda no pertenece al business del ctx', async () => {
    const { db } = queuedDb([
      [], // SELECT order → empty (cross-business exclusion)
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.orders.pay(CASH_INPUT)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ── Comanda ya pagada → BAD_REQUEST (idempotencia) ───────────────────────────

describe('orders.pay — idempotencia', () => {
  it('lanza BAD_REQUEST si la comanda ya está paid', async () => {
    const { db } = queuedDb([
      [{ id: ORDER_ID, status: 'paid', totalCents: 1000, orderNumber: 42, version: 2 }],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.orders.pay(CASH_INPUT)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('lanza BAD_REQUEST si la comanda está cancelled', async () => {
    const { db } = queuedDb([
      [{ id: ORDER_ID, status: 'cancelled', totalCents: 1000, orderNumber: 42, version: 2 }],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.orders.pay(CASH_INPUT)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── Efectivo simple → cambio correcto, comanda paid ─────────────────────────

describe('orders.pay — efectivo simple', () => {
  it('calcula change_cents en servidor y cierra la comanda', async () => {
    const { db, calls } = queuedDb(payQueue());
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.pay(CASH_INPUT);

    expect(result.status).toBe('paid');
    expect(result.totalCents).toBe(1000);
    expect(result.paidCents).toBe(1000);
    expect(result.remainingCents).toBe(0);
    expect(result.changeCents).toBe(1000); // 2000 - 1000

    // El INSERT de payments debe llevar changeCents=1000 calculado en servidor.
    const valuesCall = calls.find((c) => c.method === 'values' && Array.isArray(c.args[0]));
    const insertedRow = (valuesCall?.args[0] as unknown[])?.at(0) as Record<string, unknown>;
    expect(insertedRow?.changeCents).toBe(1000);
    expect(insertedRow?.cashReceivedCents).toBe(2000);
  });

  it('change_cents = 0 cuando cashReceivedCents === amountCents', async () => {
    const { db } = queuedDb(payQueue());
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.pay({
      orderId: ORDER_ID,
      payments: [{ method: 'cash', amountCents: 1000, cashReceivedCents: 1000 }],
    });
    expect(result.changeCents).toBe(0);
  });
});

// ── Pago mixto → cierra cuando suma cubre total ───────────────────────────────

describe('orders.pay — mixto', () => {
  it('card + cash que juntos cubren el total → status paid, remainingCents 0', async () => {
    const { db } = queuedDb(
      payQueue(
        { id: ORDER_ID, status: 'open', totalCents: 1500, orderNumber: 7, version: 1 },
        [{ lineTotalCents: 1500, taxRate: '10.00' }],
        [{ id: PAY_ID }, { id: 'pay-00000000-0000-0000-0000-000000000002' }],
      ),
    );
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.pay({
      orderId: ORDER_ID,
      payments: [
        { method: 'card', amountCents: 500 },
        { method: 'cash', amountCents: 1000, cashReceivedCents: 1000 },
      ],
    });
    expect(result.status).toBe('paid');
    expect(result.paidCents).toBe(1500);
    expect(result.remainingCents).toBe(0);
    expect(result.changeCents).toBe(0);
  });
});

// ── Pago parcial → comanda sigue open ────────────────────────────────────────

describe('orders.pay — parcial', () => {
  it('pago de 500 sobre total 2000 → status open, remainingCents 1500', async () => {
    // Pago parcial: no hay UPDATE de orders ni step 4.
    const { db } = queuedDb([
      [{ id: ORDER_ID, status: 'open', totalCents: 2000, orderNumber: 3, version: 1 }], // 1. SELECT order
      [{ lineTotalCents: 2000, taxRate: '21.00' }], // 2. SELECT items
      [{ id: PAY_ID }], // 3. INSERT payments RETURNING
      // no step 4 (UPDATE) para pago parcial
      [{}], // 4. INSERT orderEvents
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.pay({
      orderId: ORDER_ID,
      payments: [{ method: 'card', amountCents: 500 }],
    });
    expect(result.status).toBe('open');
    expect(result.remainingCents).toBe(1500);
    expect(result.paidCents).toBe(500);
  });
});

// ── Overpayment (amountCents > total sin efectivo) → BAD_REQUEST ─────────────

describe('orders.pay — overpayment', () => {
  it('lanza BAD_REQUEST si sum(amountCents) > totalCents', async () => {
    const { db } = queuedDb([
      [{ id: ORDER_ID, status: 'open', totalCents: 1000, orderNumber: 1, version: 1 }],
      [{ lineTotalCents: 1000, taxRate: '10.00' }],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(
      caller.orders.pay({
        orderId: ORDER_ID,
        payments: [{ method: 'card', amountCents: 1200 }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── Atribución de employeeId ─────────────────────────────────────────────────

describe('orders.pay — atribución de empleado', () => {
  it('el INSERT de payments usa employeeId de ctx, no del input', async () => {
    const { db, calls } = queuedDb(payQueue());
    const caller = createCaller({ ...deviceCtx(), db });
    await caller.orders.pay(CASH_INPUT);

    const valuesCall = calls.find((c) => c.method === 'values' && Array.isArray(c.args[0]));
    const row = (valuesCall?.args[0] as unknown[])?.at(0) as Record<string, unknown>;
    expect(row?.employeeId).toBe(EMP_ID);
    // El input no tiene employeeId — la línea anterior lo verifica implícitamente.
    expect(row).not.toHaveProperty('businessId', 'other-business');
    expect(row?.businessId).toBe(BIZ_ID);
  });
});
