// Tests de orders.voidLine: anular una línea guardada con PIN de encargado.
// Cubre permisos (solicitante vs aprobador), aislamiento entre negocios, auditoría en
// order_events y que la fila nunca se borra.
//
// verifyEmployeePin se simula: su propio comportamiento (rate-limit, lockout, contador de fallos,
// aislamiento por negocio) se prueba en verify-employee-pin.test.ts.

import type { Database } from '@tpv/db';
import { voidLineSchema } from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context';
import { ordersRouter } from '../routers/orders';
import { createCallerFactory, router } from '../trpc';

const verifyEmployeePin = vi.hoisted(() => vi.fn());
vi.mock('../auth/verify-employee-pin', () => ({ verifyEmployeePin }));

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
          if (['values', 'set', 'where'].includes(method)) calls.push({ method, args });
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
const EMP_ID = 'emp-00000000-0000-0000-0000-000000000001'; // quien pide (logueado)
const ORDER_ID = '11111111-0000-0000-0000-000000000001';
const LINE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const APPROVER_ID = 'cccccccc-0000-0000-0000-000000000001';

function ctxFor(db: Database): Context {
  return {
    auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_ID, employeeId: EMP_ID },
    db,
    ip: '127.0.0.1',
  };
}

const createCaller = createCallerFactory(router({ orders: ordersRouter }));

const WITH_APPROVER = {
  orderId: ORDER_ID,
  lineId: LINE_ID,
  reason: 'Error del camarero',
  approverEmployeeId: APPROVER_ID,
  approverPin: '1234',
};

const lineRow = (status = 'pending') => ({
  id: LINE_ID,
  status,
  nameSnapshot: 'Caña',
  quantity: 2,
  lineTotalCents: 500,
});

// Cola del tramo transaccional de un voidLine que termina bien.
function txQueue(line = lineRow()): unknown[][] {
  return [
    [{ id: ORDER_ID, status: 'open' }], // SELECT order FOR UPDATE
    [line], // SELECT line
    [{}], // UPDATE order_items (cancelled)
    [{}], // INSERT order_events (item_voided)
    [{ lineTotalCents: 0, taxRate: '10.00' }], // applyTotals: SELECT items
    [{}], // applyTotals: UPDATE orders
    [
      {
        id: ORDER_ID,
        orderNumber: 1,
        status: 'open',
        subtotalCents: 0,
        taxTotalCents: 0,
        totalCents: 0,
        version: 4,
      },
    ], // loadOrderResponse: order
    [
      {
        id: LINE_ID,
        productId: null,
        variantId: null,
        nameSnapshot: 'Caña',
        unitPriceCents: 250,
        taxRate: '10.00',
        quantity: 2,
        lineTotalCents: 500,
        notes: null,
        status: 'cancelled',
        voidedReason: 'Error del camarero',
      },
    ], // loadOrderResponse: items
  ];
}

function setsOf(calls: RecordedCall[]): Record<string, unknown>[] {
  return calls.filter((c) => c.method === 'set').map((c) => c.args[0] as Record<string, unknown>);
}
function valuesOf(calls: RecordedCall[]): Record<string, unknown>[] {
  return calls
    .filter((c) => c.method === 'values')
    .map((c) => c.args[0] as Record<string, unknown>);
}

beforeEach(() => {
  verifyEmployeePin.mockReset();
});

describe('voidLineSchema', () => {
  it('rechaza businessId en el input (strict)', () => {
    expect(voidLineSchema.safeParse({ ...WITH_APPROVER, businessId: BIZ_ID }).success).toBe(false);
  });
  it('exige motivo no vacío', () => {
    expect(voidLineSchema.safeParse({ ...WITH_APPROVER, reason: '   ' }).success).toBe(false);
  });
  it('PIN sin aprobador (o al revés) se rechaza', () => {
    const { approverEmployeeId: _a, ...onlyPin } = WITH_APPROVER;
    const { approverPin: _p, ...onlyId } = WITH_APPROVER;
    expect(voidLineSchema.safeParse(onlyPin).success).toBe(false);
    expect(voidLineSchema.safeParse(onlyId).success).toBe(false);
  });
});

describe('orders.voidLine — permisos', () => {
  it('sin empleado logueado → UNAUTHORIZED', async () => {
    const { db } = queuedDb([]);
    const caller = createCaller({
      ...ctxFor(db),
      auth: { kind: 'device', deviceId: DEV_ID, businessId: BIZ_ID, employeeId: null },
    });
    await expect(caller.orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('solicitante desactivado (sin rol en BD) → UNAUTHORIZED', async () => {
    const { db } = queuedDb([[]]); // getEmployeeRole no encuentra empleado activo
    await expect(createCaller(ctxFor(db)).orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('worker sin aprobador → FORBIDDEN y no se verifica ningún PIN', async () => {
    const { db, calls } = queuedDb([[{ role: 'worker' }]]);
    const { approverEmployeeId: _a, approverPin: _p, ...noApprover } = WITH_APPROVER;
    await expect(createCaller(ctxFor(db)).orders.voidLine(noApprover)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(verifyEmployeePin).not.toHaveBeenCalled();
    expect(setsOf(calls)).toHaveLength(0);
  });

  it('aprobador con rol worker → FORBIDDEN y no escribe', async () => {
    verifyEmployeePin.mockResolvedValue({ id: APPROVER_ID, role: 'worker' });
    const { db, calls } = queuedDb([[{ role: 'worker' }]]);
    await expect(createCaller(ctxFor(db)).orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(setsOf(calls)).toHaveLength(0);
    expect(valuesOf(calls)).toHaveLength(0);
  });

  it('PIN mal → el error de verifyEmployeePin llega tal cual y no se escribe nada', async () => {
    verifyEmployeePin.mockRejectedValue(
      new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' }),
    );
    const { db, calls } = queuedDb([[{ role: 'worker' }]]);
    await expect(createCaller(ctxFor(db)).orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(setsOf(calls)).toHaveLength(0);
  });

  it('aprobador bloqueado → FORBIDDEN (lo lanza verifyEmployeePin)', async () => {
    verifyEmployeePin.mockRejectedValue(
      new TRPCError({
        code: 'FORBIDDEN',
        message: 'Account locked until 2026-11-10T12:00:00.000Z',
      }),
    );
    const { db } = queuedDb([[{ role: 'worker' }]]);
    await expect(createCaller(ctxFor(db)).orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('verifica al aprobador con el negocio, dispositivo e ip del ctx (no del input)', async () => {
    verifyEmployeePin.mockResolvedValue({ id: APPROVER_ID, role: 'manager' });
    const { db } = queuedDb([[{ role: 'worker' }], [{}], ...txQueue()]);
    await createCaller(ctxFor(db)).orders.voidLine(WITH_APPROVER);
    expect(verifyEmployeePin).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        businessId: BIZ_ID,
        deviceId: DEV_ID,
        ip: '127.0.0.1',
        employeeId: APPROVER_ID,
        pin: '1234',
      }),
    );
  });
});

describe('orders.voidLine — comanda y línea', () => {
  async function asManager(responses: unknown[][]) {
    const { db, calls } = queuedDb([[{ role: 'manager' }], ...responses]);
    return { caller: createCaller(ctxFor(db)), calls };
  }

  it('comanda de otro negocio (no aparece con el business_id del ctx) → NOT_FOUND', async () => {
    const { caller, calls } = await asManager([[]]);
    await expect(caller.orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(setsOf(calls)).toHaveLength(0);
  });

  it('comanda no abierta → PRECONDITION_FAILED', async () => {
    const { caller } = await asManager([[{ id: ORDER_ID, status: 'paid' }]]);
    await expect(caller.orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('línea que no es de esa comanda → NOT_FOUND', async () => {
    const { caller } = await asManager([[{ id: ORDER_ID, status: 'open' }], []]);
    await expect(caller.orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('línea ya anulada → BAD_REQUEST', async () => {
    const { caller, calls } = await asManager([
      [{ id: ORDER_ID, status: 'open' }],
      [lineRow('cancelled')],
    ]);
    await expect(caller.orders.voidLine(WITH_APPROVER)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(setsOf(calls)).toHaveLength(0);
  });
});

describe('orders.voidLine — éxito', () => {
  it('worker + encargado con PIN: marca cancelled con voided_by = aprobador y audita a ambos', async () => {
    verifyEmployeePin.mockResolvedValue({ id: APPROVER_ID, role: 'manager' });
    const deleteSpy = vi.fn();
    const { db, calls } = queuedDb([[{ role: 'worker' }], [{}], ...txQueue()]);
    (db as unknown as { delete: unknown }).delete = deleteSpy;

    const result = await createCaller(ctxFor(db)).orders.voidLine(WITH_APPROVER);

    const lineSet = setsOf(calls).find((s) => s.status === 'cancelled');
    expect(lineSet).toMatchObject({
      status: 'cancelled',
      voidedReason: 'Error del camarero',
      voidedBy: APPROVER_ID,
    });
    // Evento: employeeId = quien pide (ctx), approvedBy + reason en el payload.
    const event = valuesOf(calls).find((v) => v.eventType === 'item_voided');
    expect(event).toMatchObject({
      orderId: ORDER_ID,
      businessId: BIZ_ID,
      employeeId: EMP_ID,
      payload: {
        lineId: LINE_ID,
        reason: 'Error del camarero',
        approvedBy: APPROVER_ID,
        nameSnapshot: 'Caña',
        quantity: 2,
        lineTotalCents: 500,
        wasSent: false,
      },
    });
    expect(deleteSpy).not.toHaveBeenCalled(); // la fila se conserva
    // La respuesta trae la línea anulada para pintarla tachada.
    expect(result.lines[0]).toMatchObject({
      status: 'cancelled',
      voidedReason: 'Error del camarero',
    });
    // El total se recalcula (SET de totales presente).
    expect(setsOf(calls).some((s) => 'totalCents' in s)).toBe(true);
  });

  it('encargado logueado: no pide PIN y él mismo es el aprobador', async () => {
    const { db, calls } = queuedDb([[{ role: 'manager' }], ...txQueue(lineRow('sent'))]);
    const { approverEmployeeId: _a, approverPin: _p, ...noApprover } = WITH_APPROVER;
    await createCaller(ctxFor(db)).orders.voidLine(noApprover);

    expect(verifyEmployeePin).not.toHaveBeenCalled();
    expect(setsOf(calls).find((s) => s.status === 'cancelled')).toMatchObject({
      voidedBy: EMP_ID,
    });
    const event = valuesOf(calls).find((v) => v.eventType === 'item_voided');
    expect(event).toMatchObject({
      employeeId: EMP_ID,
      payload: { approvedBy: EMP_ID, wasSent: true },
    });
  });

  it('un aprobador correcto resetea sus contadores de PIN', async () => {
    verifyEmployeePin.mockResolvedValue({ id: APPROVER_ID, role: 'admin' });
    const { db, calls } = queuedDb([[{ role: 'worker' }], [{}], ...txQueue()]);
    await createCaller(ctxFor(db)).orders.voidLine(WITH_APPROVER);
    expect(setsOf(calls)[0]).toMatchObject({ failedPinAttempts: 0, lockedUntil: null });
  });
});
