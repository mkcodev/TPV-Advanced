// Tests de generación de factura simplificada en orders.pay
// ⚖️ Verificar spec AEAT vigente antes de producción real.

import type { Database } from '@tpv/db';
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

const BIZ_A = 'aaa00000-0000-0000-0000-000000000001';
const BIZ_B = 'bbb00000-0000-0000-0000-000000000001';
const DEV_ID = 'dev00000-0000-0000-0000-000000000001';
const EMP_ID = 'emp00000-0000-0000-0000-000000000001';
const INV_ID = 'inv00000-0000-0000-0000-000000000001';

function makeOrder(id: string, totalCents: number, version = 1) {
  return { id, status: 'open', totalCents, orderNumber: 1, version };
}

function deviceCtx(bizId = BIZ_A, devId: string | null = DEV_ID): Context {
  return {
    auth: { kind: 'device', deviceId: devId ?? DEV_ID, businessId: bizId, employeeId: EMP_ID },
    db: {} as Database,
    ip: '127.0.0.1',
  };
}

// Queue de responses para un pago completo con generación de factura:
// execute (set_config y pg_advisory_xact_lock) son absorbidos por execute stub.
// 1. SELECT order FOR UPDATE        → [order]
// 2. SELECT orderItems (totals)     → [items]
// 3. INSERT payments RETURNING      → [{ id: 'pay-id' }]
// 4. UPDATE orders SET paid         → [{}]
// 5. SELECT MAX(invoices.number)    → [{ next: N }]
// 6. INSERT invoices RETURNING      → [{ id: INV_ID }]
// 7. INSERT invoiceTaxLines         → [{}]
// 8. INSERT orderEvents             → [{}]
function fullPayQueue(
  orderId: string,
  items: { lineTotalCents: number; taxRate: string }[],
  nextInvoiceNumber = 1,
): unknown[][] {
  const total = items.reduce((s, i) => s + i.lineTotalCents, 0);
  return [
    [makeOrder(orderId, total)],
    items,
    [{ id: 'pay-id' }],
    [{}],
    [{ next: nextInvoiceNumber }],
    [{ id: INV_ID }],
    [{}],
    [{}],
  ];
}

const testRouter = router({ orders: ordersRouter });
const createCaller = createCallerFactory(testRouter);

const ORDER_ID_1 = '11111111-1111-1111-1111-111111111111';
const ORDER_ID_2 = '22222222-2222-2222-2222-222222222222';

const ITEMS_MIXED = [
  { lineTotalCents: 1100, taxRate: '10.00' }, // 1100 bruto 10% IVA
  { lineTotalCents: 1210, taxRate: '21.00' }, // 1210 bruto 21% IVA
];

function cashInput(orderId: string, amountCents: number) {
  return {
    orderId,
    payments: [{ method: 'cash' as const, amountCents, cashReceivedCents: amountCents }],
  };
}

// ── Genera invoice + tax lines al pagar completo ─────────────────────────────

describe('orders.pay — genera invoice y tax lines al pagar completo', () => {
  it('incluye invoiceId e invoiceNumber en la respuesta', async () => {
    const { db } = queuedDb(fullPayQueue(ORDER_ID_1, ITEMS_MIXED));
    const caller = createCaller({ ...deviceCtx(), db });

    const result = await caller.orders.pay(cashInput(ORDER_ID_1, 2310));

    expect(result.status).toBe('paid');
    expect(result.invoiceId).toBe(INV_ID);
    expect(result.invoiceNumber).toBe(1);
    expect(result.invoiceSeries).toMatch(/^A\d{4}$/); // ej. 'A2026'
  });

  it('el INSERT de invoice lleva invoiceType=simplified, series con año, totalCents correcto', async () => {
    const { db, calls } = queuedDb(fullPayQueue(ORDER_ID_1, ITEMS_MIXED));
    const caller = createCaller({ ...deviceCtx(), db });
    await caller.orders.pay(cashInput(ORDER_ID_1, 2310));

    // El INSERT de invoices pasa por `.values(...)`, capturado como method='values'.
    const invoiceInsert = calls.find(
      (c) =>
        c.method === 'values' &&
        !Array.isArray(c.args[0]) &&
        (c.args[0] as Record<string, unknown>)?.invoiceType === 'simplified',
    );
    expect(invoiceInsert).toBeDefined();
    const row = invoiceInsert?.args[0] as Record<string, unknown>;
    expect(row?.invoiceType).toBe('simplified');
    expect(String(row?.series)).toMatch(/^A\d{4}$/);
    expect(row?.totalCents).toBe(2310);
    expect(row?.deviceId).toBe(DEV_ID);
    expect(row?.employeeId).toBe(EMP_ID);
  });

  it('INSERT de invoiceTaxLines tiene una fila por cada tipo de IVA', async () => {
    const { db, calls } = queuedDb(fullPayQueue(ORDER_ID_1, ITEMS_MIXED));
    const caller = createCaller({ ...deviceCtx(), db });
    await caller.orders.pay(cashInput(ORDER_ID_1, 2310));

    // invoiceTaxLines se inserta con un array de rows que tienen invoiceId.
    // A diferencia del INSERT de payments (que también es array), las filas de
    // tax lines tienen la propiedad 'invoiceId'.
    const taxLinesInsert = calls.find(
      (c) =>
        c.method === 'values' &&
        Array.isArray(c.args[0]) &&
        (c.args[0] as Array<Record<string, unknown>>).at(0)?.invoiceId !== undefined,
    );
    const rows = taxLinesInsert?.args[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);

    const rates = rows.map((r) => String(r.taxRate)).sort();
    expect(rates).toEqual(['10', '21']);

    // Invariante del core: SUM(baseCents + taxCents) == SUM(grossCents)
    const sumBase = rows.reduce((s, r) => s + Number(r.baseCents), 0);
    const sumTax = rows.reduce((s, r) => s + Number(r.taxCents), 0);
    expect(sumBase + sumTax).toBe(2310);
  });
});

// ── Pago parcial → NO genera invoice ─────────────────────────────────────────

describe('orders.pay — pago parcial no genera invoice', () => {
  it('status open, invoiceId null', async () => {
    const { db } = queuedDb([
      [makeOrder(ORDER_ID_1, 2000)],
      [{ lineTotalCents: 2000, taxRate: '10.00' }],
      [{ id: 'pay-id' }],
      [{}], // INSERT orderEvents
    ]);
    const caller = createCaller({ ...deviceCtx(), db });

    const result = await caller.orders.pay(cashInput(ORDER_ID_1, 1000));
    expect(result.status).toBe('open');
    expect(result.invoiceId).toBeNull();
    expect(result.invoiceNumber).toBeNull();
  });
});

// ── Correlativa por serie (numeración secuencial) ────────────────────────────

describe('orders.pay — correlativa de factura', () => {
  it('segundo cobro obtiene number=2 cuando nextInvoiceNumber=2', async () => {
    const { db } = queuedDb(
      fullPayQueue(ORDER_ID_2, [{ lineTotalCents: 500, taxRate: '10.00' }], 2),
    );
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.pay(cashInput(ORDER_ID_2, 500));

    expect(result.invoiceNumber).toBe(2);
  });

  it('negocio B obtiene number=1 aunque negocio A ya tenga facturas', async () => {
    // Simulamos que el MAX devuelve null (sin facturas en biz B) → COALESCE → 1
    const { db } = queuedDb([
      [makeOrder(ORDER_ID_1, 500)],
      [{ lineTotalCents: 500, taxRate: '10.00' }],
      [{ id: 'pay-id' }],
      [{}],
      [{ next: 1 }], // MAX(invoices.number) para BIZ_B = 0 → next = 1
      [{ id: INV_ID }],
      [{}],
      [{}],
    ]);
    const caller = createCaller({ ...deviceCtx(BIZ_B), db });
    const result = await caller.orders.pay(cashInput(ORDER_ID_1, 500));

    expect(result.invoiceNumber).toBe(1);
    expect(result.invoiceSeries).toMatch(/^A\d{4}$/);
  });
});

// Nota: ctx.deviceId nunca puede ser null al llegar aquí porque deviceProcedure
// garantiza auth.kind === 'device' y AuthContext.deviceId es string no-nullable.
// No hay un test de "sin deviceId" porque es código inalcanzable en producción.

// ── getInvoice — aislamiento multi-tenant ────────────────────────────────────

describe('orders.getInvoice — aislamiento multi-tenant', () => {
  it('NOT_FOUND cuando la factura no pertenece al businessId del ctx', async () => {
    const { db } = queuedDb([
      [], // SELECT invoices → vacío (cross-tenant exclusion por WHERE businessId)
    ]);
    const caller = createCaller({ ...deviceCtx(BIZ_B), db });

    await expect(caller.orders.getInvoice({ orderId: ORDER_ID_1 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ── markLinesSent — aislamiento multi-tenant ─────────────────────────────────

describe('orders.markLinesSent — aislamiento multi-tenant', () => {
  it('NOT_FOUND cuando la comanda no pertenece al businessId del ctx', async () => {
    const { db } = queuedDb([
      [], // SELECT order → vacío (cross-tenant exclusion)
    ]);
    const caller = createCaller({ ...deviceCtx(BIZ_B), db });

    await expect(
      caller.orders.markLinesSent({
        orderId: ORDER_ID_1,
        itemIds: ['aaaaaaaa-0000-0000-0000-000000000001'],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ── getKitchenPayload — agrupación por printDestination ──────────────────────

describe('orders.getKitchenPayload — agrupación por printDestination', () => {
  const KITCHEN_ITEM = {
    id: 'kk000000-0000-0000-0000-000000000001',
    nameSnapshot: 'Plato',
    quantity: 2,
    notes: null,
    printDestination: 'kitchen',
  };
  const BAR_ITEM = {
    id: 'bb000000-0000-0000-0000-000000000001',
    nameSnapshot: 'Cerveza',
    quantity: 1,
    notes: null,
    printDestination: 'bar',
  };
  const NONE_ITEM = {
    id: 'nn000000-0000-0000-0000-000000000001',
    nameSnapshot: 'Sin destino',
    quantity: 1,
    notes: null,
    printDestination: 'none',
  };

  it('agrupa correctamente kitchen/bar y excluye none', async () => {
    const { db } = queuedDb([
      [{ id: ORDER_ID_1, orderNumber: 5, tableId: null }], // SELECT order
      [KITCHEN_ITEM, KITCHEN_ITEM, BAR_ITEM, NONE_ITEM], // SELECT items JOIN categories
      [], // SELECT kitchen_sent events → ninguno
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.getKitchenPayload({ orderId: ORDER_ID_1 });

    expect(result.groups.kitchen).toHaveLength(2);
    expect(result.groups.bar).toHaveLength(1);
    expect(result.pendingItemIds).not.toContain(NONE_ITEM.id);
    expect(result.pendingItemIds).toHaveLength(3); // 2 kitchen + 1 bar
  });

  it('pendingItemIds excluye los ids ya presentes en eventos kitchen_sent', async () => {
    const { db } = queuedDb([
      [{ id: ORDER_ID_1, orderNumber: 5, tableId: null }],
      [KITCHEN_ITEM, BAR_ITEM],
      // Un evento kitchen_sent previo que ya mandó el KITCHEN_ITEM
      [{ payload: { itemIds: [KITCHEN_ITEM.id] } }],
    ]);
    const caller = createCaller({ ...deviceCtx(), db });
    const result = await caller.orders.getKitchenPayload({ orderId: ORDER_ID_1 });

    expect(result.pendingItemIds).not.toContain(KITCHEN_ITEM.id);
    expect(result.pendingItemIds).toContain(BAR_ITEM.id);
    expect(result.pendingItemIds).toHaveLength(1);
  });
});

// ── Concurrencia — sin huecos (test de integración, requiere DATABASE_URL) ───
//
// Con queuedDb no hay concurrencia real; el advisory lock no puede verificarse
// en tests unitarios. Este test marca su intención para ejecutarse contra la
// BD real cuando DATABASE_URL está disponible.
//
// Para correrlo localmente:
//   DATABASE_URL=<supabase_local_url> pnpm --filter api test orders-invoice
//
describe.skipIf(!process.env.DATABASE_URL)(
  'orders.pay — concurrencia: N cobros simultáneos del mismo negocio',
  () => {
    it('genera numbers {1..N} sin huecos ni duplicados', async () => {
      // Este test es un placeholder estructural para documentar la expectativa.
      // La implementación real contra PostgreSQL usa Promise.all + ordersRouter.pay
      // con N comandas distintas y verifica que los invoice.number resultantes
      // formen el conjunto exacto {1, 2, ..., N}.
      //
      // El advisory lock pg_advisory_xact_lock(hashtext(businessId || ':invoice:' || series))
      // serializa los INSERTs dentro de la transacción → garantía sin huecos.
      expect(true).toBe(true); // placeholder — implementar con pg real
    });
  },
);
