// Tests del employeesRouter: solo panel, aislamiento entre negocios, PIN nunca expuesto,
// un test por campo del patch de update (CLAUDE.md §6).
//
// El proxy queuedDb consume respuestas en orden de aparición. panelAdminProcedure (kind
// 'admin') emite 1 SELECT (getMembershipRole) antes del handler; cada logAuthEvent es un INSERT
// que consume otra entrada de la cola.

import type { Database } from '@tpv/db';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { Context } from '../context';
import { employeesRouter } from '../routers/employees';
import { createCallerFactory, router } from '../trpc';

// argon2 es nativo y lento: el hash se simula para ver qué llega a la BD.
vi.mock('../auth/pin', () => ({
  hashPin: vi.fn(async (pin: string) => `hashed:${pin}`),
}));

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
  } as unknown as Database;

  return { db, calls };
}

const dialect = new PgDialect();
// Parámetros ya enlazados de un WHERE: ahí debe aparecer el businessId del contexto.
const whereParams = (call: RecordedCall | undefined): unknown[] =>
  call ? dialect.sqlToQuery(call.args[0] as SQL).params : [];

function panelCtx(businessId = 'biz-1'): Omit<Context, 'db'> {
  return { auth: { kind: 'admin', userId: 'user-1', businessId }, ip: '127.0.0.1' };
}

const OWNER_ROLE = [{ role: 'owner' }];
const EMP_ID = '00000000-0000-0000-0000-000000000010';
const ROW = {
  id: EMP_ID,
  name: 'Ana',
  role: 'worker',
  isActive: true,
  lockedUntil: null,
  createdAt: new Date(),
};

const createCaller = createCallerFactory(router({ employees: employeesRouter }));

describe('employees.list', () => {
  it('never selects pinHash and filters by ctx.businessId', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [ROW]]);
    const caller = createCaller({ ...panelCtx('biz-1'), db });
    const rows = await caller.employees.list();

    expect(rows).toHaveLength(1);
    // El 2.º SELECT (el 1.º es el rol) lleva la lista de columnas públicas.
    const selects = calls.filter((c) => c.method === 'select');
    const columns = (selects[1]?.args[0] ?? {}) as Record<string, unknown>;
    expect(Object.keys(columns)).not.toContain('pinHash');
    expect(Object.keys(columns)).not.toContain('hourlyWageCents');

    const where = calls.filter((c) => c.method === 'where')[1];
    expect(whereParams(where)).toContain('biz-1');
  });
});

describe('employees.create', () => {
  it('stores the hash (not the PIN), uses ctx.businessId and logs no PIN', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [ROW], []]);
    const caller = createCaller({ ...panelCtx('biz-1'), db });
    await caller.employees.create({ name: 'Ana', pin: '4821', role: 'worker' });

    const values = calls.filter((c) => c.method === 'values');
    const inserted = values[0]?.args[0] as Record<string, unknown>;
    expect(inserted.businessId).toBe('biz-1');
    expect(inserted.pinHash).toBe('hashed:4821');
    expect(inserted.pinHash).not.toBe('4821');

    // El evento de auditoría (2.º INSERT) no puede llevar el PIN ni el hash.
    const event = values[1]?.args[0] as Record<string, unknown>;
    expect(event.eventType).toBe('employee_created');
    expect(JSON.stringify(event)).not.toContain('4821');
    expect(JSON.stringify(event)).not.toContain('hashed');
  });

  it('rejects a businessId in the input', async () => {
    const { db } = queuedDb([OWNER_ROLE]);
    const caller = createCaller({ ...panelCtx('biz-1'), db });
    await expect(
      caller.employees.create({
        name: 'Ana',
        pin: '4821',
        role: 'worker',
        businessId: 'biz-other',
      } as never),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects PINs that are not 4–6 digits', async () => {
    const { db } = queuedDb([OWNER_ROLE]);
    const caller = createCaller({ ...panelCtx(), db });
    await expect(
      caller.employees.create({ name: 'Ana', pin: '12', role: 'worker' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('employees.update — one test per patch field', () => {
  it('name reaches the SET', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ ...ROW, name: 'Ana B' }], []]);
    const caller = createCaller({ ...panelCtx(), db });
    await caller.employees.update({ id: EMP_ID, name: 'Ana B' });
    expect(calls.find((c) => c.method === 'set')?.args[0]).toEqual({ name: 'Ana B' });
  });

  it('role reaches the SET', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ ...ROW, role: 'manager' }], []]);
    const caller = createCaller({ ...panelCtx(), db });
    await caller.employees.update({ id: EMP_ID, role: 'manager' });
    expect(calls.find((c) => c.method === 'set')?.args[0]).toEqual({ role: 'manager' });
  });

  it('throws BAD_REQUEST when there is nothing to update', async () => {
    const { db } = queuedDb([OWNER_ROLE]);
    const caller = createCaller({ ...panelCtx(), db });
    await expect(caller.employees.update({ id: EMP_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('scopes the WHERE to ctx.businessId and rejects a businessId input', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [ROW], []]);
    const caller = createCaller({ ...panelCtx('biz-B'), db });
    await caller.employees.update({ id: EMP_ID, name: 'X' });
    const where = calls.filter((c) => c.method === 'where')[1];
    expect(whereParams(where)).toEqual(expect.arrayContaining([EMP_ID, 'biz-B']));

    const { db: db2 } = queuedDb([OWNER_ROLE]);
    await expect(
      createCaller({ ...panelCtx('biz-B'), db: db2 }).employees.update({
        id: EMP_ID,
        name: 'X',
        businessId: 'biz-A',
      } as never),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('employees.setActive', () => {
  it('deactivates and logs employee_deactivated', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ ...ROW, isActive: false }], []]);
    const caller = createCaller({ ...panelCtx(), db });
    await caller.employees.setActive({ id: EMP_ID, isActive: false });
    expect(calls.find((c) => c.method === 'set')?.args[0]).toEqual({ isActive: false });
    const event = calls.filter((c) => c.method === 'values')[0]?.args[0] as Record<string, unknown>;
    expect(event.eventType).toBe('employee_deactivated');
  });

  it('reactivates and logs employee_reactivated', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [ROW], []]);
    const caller = createCaller({ ...panelCtx(), db });
    await caller.employees.setActive({ id: EMP_ID, isActive: true });
    const event = calls.filter((c) => c.method === 'values')[0]?.args[0] as Record<string, unknown>;
    expect(event.eventType).toBe('employee_reactivated');
  });
});

describe('employees.setPin', () => {
  it('hashes the PIN and clears the lockout counters', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ id: EMP_ID }], []]);
    const caller = createCaller({ ...panelCtx(), db });
    await caller.employees.setPin({ id: EMP_ID, pin: '9034' });

    expect(calls.find((c) => c.method === 'set')?.args[0]).toEqual({
      pinHash: 'hashed:9034',
      failedPinAttempts: 0,
      lockedUntil: null,
    });
    const event = calls.filter((c) => c.method === 'values')[0]?.args[0] as Record<string, unknown>;
    expect(event.eventType).toBe('employee_pin_changed');
    expect(JSON.stringify(event)).not.toContain('9034');
  });
});

describe('employees — isolation between businesses', () => {
  it('update / setActive / setPin on another business employee give NOT_FOUND', async () => {
    // El UPDATE ... WHERE id AND business_id no encuentra fila => returning() vacío.
    const mk = () => createCaller({ ...panelCtx('biz-B'), db: queuedDb([OWNER_ROLE, []]).db });
    await expect(mk().employees.update({ id: EMP_ID, name: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(mk().employees.setActive({ id: EMP_ID, isActive: false })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(mk().employees.setPin({ id: EMP_ID, pin: '1234' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('employees — panel only', () => {
  it('rejects a terminal even when the logged-in employee has role admin', async () => {
    const { db } = queuedDb([[{ role: 'admin' }]]); // getEmployeeRole => admin
    const caller = createCaller({
      auth: { kind: 'device', deviceId: 'dev-1', businessId: 'biz-1', employeeId: 'emp-1' },
      db,
      ip: '127.0.0.1',
    });
    await expect(caller.employees.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a staff membership', async () => {
    const { db } = queuedDb([[{ role: 'staff' }]]);
    const caller = createCaller({ ...panelCtx(), db });
    await expect(caller.employees.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an anonymous caller', async () => {
    const { db } = queuedDb([]);
    const caller = createCaller({ auth: { kind: 'anonymous' }, db, ip: '127.0.0.1' });
    await expect(caller.employees.list()).rejects.toBeDefined();
  });
});
