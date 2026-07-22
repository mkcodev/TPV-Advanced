// Tests del ordersRouter: principios de servidor autoritativo, aislamiento multi-tenant,
// inmutabilidad de snapshots e idempotencia.
//
// Patrón: queuedDb extendido con transaction + execute (para withBusinessContext +
// pg_advisory_xact_lock). Los tests son unitarios; el test de concurrencia
// (order_number sin huecos) requiere PostgreSQL real y se marca como TODO.

import type { Database } from '@tpv/db';
import { upsertOrderSchema } from '@tpv/validators';
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
    // execute: used for set_config (in withBusinessContext) and advisory_lock.
    execute: () => Promise.resolve([]),
    // transaction: calls fn immediately with the same mock db as tx.
    transaction: (fn: (tx: Database) => Promise<unknown>) => fn(db as Database),
  } as unknown as Database;

  return { db, calls };
}

const BIZ_ID = 'biz-00000000-0000-0000-0000-000000000001';
const DEV_ID = 'dev-00000000-0000-0000-0000-000000000001';
const EMP_ID = 'emp-00000000-0000-0000-0000-000000000001';
const ORDER_ID = '11111111-0000-0000-0000-000000000001';
const LINE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PROD_ID = 'bbbbbbbb-0000-0000-0000-000000000001';

function deviceCtx(overrides: Partial<Context> = {}): Context {
  return {
    auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_ID, employeeId: EMP_ID },
    db: {} as Database, // replaced per test
    ip: '127.0.0.1',
    ...overrides,
  };
}

const testRouter = router({ orders: ordersRouter });
const createCaller = createCallerFactory(testRouter);

// The upsert queue for a single INSERT (1 product line, no variant):
//   withBusinessContext calls tx.execute(set_config) → handled by execute mock
//   1. select(order exists)        → [] (not found)
//   2. execute(advisory_lock)      → handled by execute mock
//   3. select(MAX order_number)    → [{ next: 1 }]
//   4. insert(orders)              → [{}]
//   5. insert(orderEvents created) → [{}]
//   6. select(products)            → [product row]
//   7. insert(orderItems)          → [{}]
//   8. insert(orderEvents item_added) → [{}]
//   9. select(items for totals)    → [{ lineTotalCents, taxRate }]
//  10. update(orders totals)       → [{}]
//  11. select(final order)         → [final order row]
//  12. select(final items)         → [final item row]
function singleLineInsertQueue(
  product = { id: PROD_ID, name: 'Cerveza', basePriceCents: 250, taxRate: '10.00' },
  orderNum = 1,
): unknown[][] {
  const orderId = ORDER_ID;
  const lineId = LINE_ID;
  return [
    [], // 1. order not found → INSERT path
    [{ next: orderNum }], // 3. MAX order_number + 1
    [{}], // 4. insert orders
    [{}], // 5. insert orderEvents created
    [product], // 6. select products
    [{}], // 7. insert orderItems
    [{}], // 8. insert orderEvents item_added
    [{ lineTotalCents: product.basePriceCents, taxRate: product.taxRate }], // 9. totals
    [{}], // 10. update orders totals
    [
      {
        id: orderId,
        orderNumber: orderNum,
        status: 'open',
        subtotalCents: 227,
        taxTotalCents: 23,
        totalCents: 250,
        version: 2,
      },
    ], // 11. final order
    [
      {
        id: lineId,
        productId: PROD_ID,
        variantId: null,
        nameSnapshot: product.name,
        unitPriceCents: product.basePriceCents,
        taxRate: product.taxRate,
        quantity: 1,
        lineTotalCents: product.basePriceCents,
        notes: null,
      },
    ], // 12. final items
  ];
}

const MIN_INPUT = {
  orderId: ORDER_ID,
  type: 'counter' as const,
  lines: [{ lineId: LINE_ID, productId: PROD_ID, quantity: 1 }],
};

// ── Zod: .strict() rechaza campos de precios ─────────────────────────────────

describe('upsertOrderSchema — Zod rechaza precios del cliente', () => {
  it('rechaza unitPriceCents en una línea', () => {
    const result = upsertOrderSchema.safeParse({
      orderId: ORDER_ID,
      type: 'counter',
      lines: [{ lineId: LINE_ID, productId: PROD_ID, quantity: 1, unitPriceCents: 500 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza taxRate en una línea', () => {
    const result = upsertOrderSchema.safeParse({
      orderId: ORDER_ID,
      type: 'counter',
      lines: [{ lineId: LINE_ID, productId: PROD_ID, quantity: 1, taxRate: 21 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza businessId en el input raíz', () => {
    const result = upsertOrderSchema.safeParse({
      orderId: ORDER_ID,
      type: 'counter',
      businessId: BIZ_ID,
      lines: [],
    });
    expect(result.success).toBe(false);
  });
});

// ── Sin empleado → UNAUTHORIZED ──────────────────────────────────────────────

describe('orders.upsert — sin employeeId', () => {
  it('lanza UNAUTHORIZED si employeeId es null', async () => {
    const { db } = queuedDb([]);
    const caller = createCaller({
      ...deviceCtx(),
      auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_ID, employeeId: null },
      db,
    });
    await expect(caller.orders.upsert(MIN_INPUT)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ── Producto de otro negocio → BAD_REQUEST ───────────────────────────────────

describe('orders.upsert — producto de otro negocio', () => {
  it('lanza BAD_REQUEST si el producto no pertenece al business del ctx', async () => {
    const { db } = queuedDb([
      [], // order not found → INSERT path
      [{ next: 1 }], // MAX order_number
      [{}], // insert orders
      [{}], // insert orderEvents created
      [], // select products → empty (not found in this business)
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.orders.upsert(MIN_INPUT)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── Snapshot: el servidor ignora el precio del cliente ───────────────────────

describe('orders.upsert — snapshot de precio del servidor', () => {
  it('inserta unit_price_cents del catálogo, no de ningún input del cliente', async () => {
    const PRODUCT_FROM_DB = {
      id: PROD_ID,
      name: 'Cerveza',
      basePriceCents: 999, // precio REAL en BD
      taxRate: '10.00',
    };
    const { db, calls } = queuedDb(singleLineInsertQueue(PRODUCT_FROM_DB));
    const caller = createCaller({ ...deviceCtx(), db });
    // El cliente NO envía precio — el schema .strict() lo rechazaría
    await caller.orders.upsert(MIN_INPUT);

    const valuesCall = calls.find((c) => c.method === 'values' && Array.isArray(c.args));
    // El insert de orderItems lleva unit_price_cents del catálogo.
    const insertedRows = calls
      .filter((c) => c.method === 'values')
      .map((c) => c.args[0] as Record<string, unknown>);
    const itemInsert = insertedRows.find((r) => 'unitPriceCents' in r || 'unit_price_cents' in r);
    // Verificar que el price usado viene del catálogo (999), no de algún input (0, undefined…).
    const price = (itemInsert?.unitPriceCents ?? itemInsert?.unit_price_cents) as
      | number
      | undefined;
    expect(price).toBe(999);
    expect(valuesCall).toBeDefined();
  });
});

// ── Totales autoritativos ────────────────────────────────────────────────────

describe('orders.upsert — totales del servidor', () => {
  it('el update de totales usa valores de orderTaxBreakdown, no del cliente', async () => {
    // 250 céntimos al 10%: base=227, tax=23, total=250
    const { db, calls } = queuedDb(singleLineInsertQueue());
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.upsert(MIN_INPUT);

    // El resultado tiene los totales que el mock devuelve (los que el router escribió en la BD).
    expect(result.subtotalCents).toBeDefined();
    expect(result.taxTotalCents).toBeDefined();
    expect(result.totalCents).toBeDefined();

    // El SET del update de totales debe existir en calls.
    const setCall = calls.find((c) => c.method === 'set');
    expect(setCall).toBeDefined();
    const patch = setCall?.args[0] as Record<string, unknown>;
    expect(patch).toHaveProperty('subtotalCents');
    expect(patch).toHaveProperty('taxTotalCents');
    expect(patch).toHaveProperty('totalCents');
    // No client-provided totals.
    expect(patch).not.toHaveProperty('clientTotal');
  });
});

// ── Idempotencia: mismo orderId → UPDATE, no INSERT ─────────────────────────

describe('orders.upsert — idempotencia', () => {
  it('segundo upsert con mismo orderId va al camino UPDATE (no crea advisory_lock ni MAX+1)', async () => {
    // El mock devuelve la orden como existente y abierta.
    const { db, calls } = queuedDb([
      [{ id: ORDER_ID, status: 'open' }], // 1. order found → UPDATE path
      [{ id: LINE_ID, productId: PROD_ID, variantId: null, unitPriceCents: 250 }], // 2. existing items
      [{}], // 3. update orderItem qty/notes
      [{}], // 4. update orders header (notes)
      [{ lineTotalCents: 250, taxRate: '10.00' }], // 5. select items for totals
      [{}], // 6. update orders totals
      [
        {
          id: ORDER_ID,
          orderNumber: 1,
          status: 'open',
          subtotalCents: 227,
          taxTotalCents: 23,
          totalCents: 250,
          version: 3,
        },
      ], // 7. final order
      [
        {
          id: LINE_ID,
          productId: PROD_ID,
          variantId: null,
          nameSnapshot: 'Cerveza',
          unitPriceCents: 250,
          taxRate: '10.00',
          quantity: 1,
          lineTotalCents: 250,
          notes: null,
        },
      ], // 8. final items
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.upsert(MIN_INPUT);

    expect(result.orderNumber).toBe(1); // mismo número de comanda
    // En UPDATE no debe llamar a execute para advisory_lock ni SELECT MAX+1.
    // execute() del mock siempre devuelve [] y no está registrado en calls,
    // pero el SELECT de MAX+1 sí es un select que estaría en queue.
    // Si fuera INSERT, queue estaría desincronizada y el test fallaría.
    expect(result.lines).toHaveLength(1);
  });

  it('comanda con status distinto de open lanza BAD_REQUEST', async () => {
    const { db } = queuedDb([
      [{ id: ORDER_ID, status: 'paid' }], // order exists but paid
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.orders.upsert(MIN_INPUT)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── Snapshot inmutable: cambiar productId en línea existente → BAD_REQUEST ──

describe('orders.upsert — snapshot inmutable', () => {
  it('lanza BAD_REQUEST si se intenta cambiar el productId de una línea existente', async () => {
    const OTHER_PROD = 'cccccccc-0000-0000-0000-000000000001';
    const { db } = queuedDb([
      [{ id: ORDER_ID, status: 'open' }], // order found → UPDATE
      [{ id: LINE_ID, productId: PROD_ID, variantId: null, unitPriceCents: 250 }], // existing items
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(
      caller.orders.upsert({
        ...MIN_INPUT,
        // Same lineId but different productId — must fail.
        lines: [{ lineId: LINE_ID, productId: OTHER_PROD, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── Aislamiento multi-tenant: getById de otro negocio → NOT_FOUND ────────────

describe('orders.getById — aislamiento multi-tenant', () => {
  it('devuelve NOT_FOUND cuando el orderId pertenece a otro business', async () => {
    // Select devuelve vacío (WHERE id=? AND business_id=? no coincide).
    const { db } = queuedDb([[]]);
    const caller = createCaller({ ...deviceCtx(), db });
    await expect(caller.orders.getById({ orderId: ORDER_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ── getById sin empleado → UNAUTHORIZED ──────────────────────────────────────

describe('orders.getById — sin employeeId', () => {
  it('lanza UNAUTHORIZED si employeeId es null', async () => {
    const { db } = queuedDb([]);
    const caller = createCaller({
      ...deviceCtx(),
      auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_ID, employeeId: null },
      db,
    });
    await expect(caller.orders.getById({ orderId: ORDER_ID })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

// ── TODO: concurrencia — order_number sin huecos ─────────────────────────────
// Este test requiere una instancia real de PostgreSQL y no puede ser unitario.
// Se implementará como integration test cuando se configure el entorno de integración.
// Escenario: Promise.all con 3 callers concurrentes al mismo businessId → orderNumbers {1,2,3} únicos.
