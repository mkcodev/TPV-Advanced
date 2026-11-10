// Tests del authRouter (terminales): solo panel, aislamiento entre negocios, códigos de un
// solo uso y sin colisiones. Patrón: createCallerFactory + ctx simulado + proxy grabador.
//
// queuedDb consume una respuesta por cada `await db.*`. panelAdminProcedure (kind 'admin')
// emite 1 SELECT (rol de membership) antes del handler; cada logAuthEvent es un INSERT.

import type { Database } from '@tpv/db';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context';
import { authRouter } from '../routers/auth';
import { createCallerFactory, router } from '../trpc';

// Aleatoriedad controlada para forzar colisiones; el resto de @tpv/core es el real.
const generatePairingCode = vi.hoisted(() => vi.fn());
vi.mock('@tpv/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tpv/core')>()),
  generatePairingCode,
}));

const consumeRateLimit = vi.hoisted(() => vi.fn());
vi.mock('../auth/rate-limit-store', () => ({ consumeRateLimit }));

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

  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return makeChain();
    };

  const db = {
    select: record('select'),
    insert: record('insert'),
    update: record('update'),
    execute: record('execute'),
  } as unknown as Database;

  return { db, calls };
}

const dialect = new PgDialect();
const whereParams = (call: RecordedCall | undefined): unknown[] =>
  call ? dialect.sqlToQuery(call.args[0] as SQL).params : [];

const OWNER_ROLE = [{ role: 'owner' }];
const panelCtx = (businessId = 'biz-1'): Omit<Context, 'db'> => ({
  auth: { kind: 'admin', userId: 'user-1', businessId },
  ip: '127.0.0.1',
});

const createCaller = createCallerFactory(router({ auth: authRouter }));

beforeEach(() => {
  generatePairingCode.mockReset();
  consumeRateLimit.mockReset();
  consumeRateLimit.mockResolvedValue(true);
});

describe('auth.createPairingCode', () => {
  it('rejects a terminal even when the logged-in employee has role admin', async () => {
    const { db } = queuedDb([[{ role: 'admin' }]]); // getEmployeeRole => admin
    const caller = createCaller({
      auth: { kind: 'device', deviceId: 'dev-1', businessId: 'biz-1', employeeId: 'emp-1' },
      db,
      ip: '127.0.0.1',
    });
    await expect(
      caller.auth.createPairingCode({ name: 'Terminal 1', type: 'pos_terminal' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Admin panel access required' });
  });

  it('stores ctx.businessId and the admin user id, and returns a 15 min ttl', async () => {
    generatePairingCode.mockReturnValue('12345678');
    const { db, calls } = queuedDb([OWNER_ROLE, [], [], []]); // rol, sin choque, insert, evento
    const caller = createCaller({ ...panelCtx('biz-1'), db });
    const result = await caller.auth.createPairingCode({ name: 'Caja', type: 'pos_terminal' });

    const inserted = calls.filter((c) => c.method === 'values')[0]?.args[0] as Record<
      string,
      unknown
    >;
    expect(inserted).toMatchObject({
      businessId: 'biz-1',
      code: '12345678',
      createdBy: 'user-1',
      deviceName: 'Caja',
    });
    expect(result).toMatchObject({ code: '12345678', ttlMs: 15 * 60 * 1000 });
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('regenerates the code when it clashes with an active one', async () => {
    generatePairingCode.mockReturnValueOnce('11111111').mockReturnValueOnce('22222222');
    // rol, choque con el 1.º, libre el 2.º, insert, evento
    const { db, calls } = queuedDb([OWNER_ROLE, [{ id: 'other' }], [], [], []]);
    const caller = createCaller({ ...panelCtx(), db });
    const result = await caller.auth.createPairingCode({ name: 'Caja', type: 'pos_terminal' });

    expect(result.code).toBe('22222222');
    const inserted = calls.filter((c) => c.method === 'values')[0]?.args[0] as Record<
      string,
      unknown
    >;
    expect(inserted.code).toBe('22222222');
  });

  it('fails after 3 clashes without inserting anything', async () => {
    generatePairingCode.mockReturnValue('11111111');
    const { db, calls } = queuedDb([OWNER_ROLE, [{ id: 'a' }], [{ id: 'b' }], [{ id: 'c' }]]);
    const caller = createCaller({ ...panelCtx(), db });
    await expect(
      caller.auth.createPairingCode({ name: 'Caja', type: 'pos_terminal' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(calls.filter((c) => c.method === 'insert')).toHaveLength(0);
  });
});

describe('auth.listDevices', () => {
  it('never selects deviceTokenHash and filters by ctx.businessId', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE,
      [{ id: 'd1', name: 'Caja', type: 'pos_terminal', isActive: true }],
    ]);
    const caller = createCaller({ ...panelCtx('biz-1'), db });
    await caller.auth.listDevices();

    const columns = (calls.filter((c) => c.method === 'select')[1]?.args[0] ?? {}) as Record<
      string,
      unknown
    >;
    expect(Object.keys(columns)).not.toContain('deviceTokenHash');
    expect(whereParams(calls.filter((c) => c.method === 'where')[1])).toContain('biz-1');
  });

  it('rejects a terminal and a staff membership', async () => {
    const asDevice = createCaller({
      auth: { kind: 'device', deviceId: 'dev-1', businessId: 'biz-1', employeeId: 'emp-1' },
      db: queuedDb([[{ role: 'admin' }]]).db,
      ip: '127.0.0.1',
    });
    await expect(asDevice.auth.listDevices()).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const asStaff = createCaller({ ...panelCtx(), db: queuedDb([[{ role: 'staff' }]]).db });
    await expect(asStaff.auth.listDevices()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('auth.revokeDevice', () => {
  const DEVICE_ID = '00000000-0000-0000-0000-000000000020';

  it('clears the token hash and deactivates, scoped to ctx.businessId', async () => {
    const { db, calls } = queuedDb([OWNER_ROLE, [{ id: DEVICE_ID, name: 'Caja' }], []]);
    const caller = createCaller({ ...panelCtx('biz-B'), db });
    await caller.auth.revokeDevice({ deviceId: DEVICE_ID });

    expect(calls.find((c) => c.method === 'set')?.args[0]).toEqual({
      deviceTokenHash: null,
      isActive: false,
    });
    expect(whereParams(calls.filter((c) => c.method === 'where')[1])).toEqual(
      expect.arrayContaining([DEVICE_ID, 'biz-B']),
    );
  });

  it('gives NOT_FOUND for a device of another business', async () => {
    const { db } = queuedDb([OWNER_ROLE, []]); // UPDATE ... WHERE id AND business_id => 0 filas
    const caller = createCaller({ ...panelCtx('biz-B'), db });
    await expect(caller.auth.revokeDevice({ deviceId: DEVICE_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a terminal', async () => {
    const caller = createCaller({
      auth: { kind: 'device', deviceId: 'dev-1', businessId: 'biz-1', employeeId: 'emp-1' },
      db: queuedDb([[{ role: 'admin' }]]).db,
      ip: '127.0.0.1',
    });
    await expect(caller.auth.revokeDevice({ deviceId: DEVICE_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('auth.pairDevice', () => {
  const anon = (db: Database) => createCaller({ auth: { kind: 'anonymous' }, db, ip: '10.0.0.1' });

  it('is rate limited per IP', async () => {
    consumeRateLimit.mockResolvedValue(false);
    const { db } = queuedDb([]);
    await expect(anon(db).auth.pairDevice({ code: '12345678' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(consumeRateLimit).toHaveBeenCalledWith(db, 'pair:10.0.0.1', expect.any(Date));
  });

  it('gives NOT_FOUND for a used, expired or unknown code', async () => {
    const { db } = queuedDb([[]]); // el UPDATE ... RETURNING no devuelve filas
    await expect(anon(db).auth.pairDevice({ code: '12345678' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('claims exactly one row: single-row subselect locked with SKIP LOCKED', async () => {
    const { db, calls } = queuedDb([[]]);
    await anon(db)
      .auth.pairDevice({ code: '12345678' })
      .catch(() => undefined);

    const query = dialect.sqlToQuery(calls.find((c) => c.method === 'execute')?.args[0] as SQL);
    expect(query.sql).toMatch(/LIMIT 1/);
    expect(query.sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(query.sql).toMatch(/used_at IS NULL/);
    expect(query.sql).toMatch(/expires_at > now\(\)/);
    expect(query.params).toContain('12345678');
  });

  it('creates the device in the business of the claimed code', async () => {
    const { db, calls } = queuedDb([
      [
        {
          business_id: 'biz-9',
          device_name: 'Caja',
          device_type: 'pos_terminal',
          created_by: 'u1',
        },
      ],
      [{ id: 'dev-9', name: 'Caja', type: 'pos_terminal' }], // insert device returning
      [], // evento
    ]);
    const result = await anon(db).auth.pairDevice({ code: '12345678' });

    const inserted = calls.filter((c) => c.method === 'values')[0]?.args[0] as Record<
      string,
      unknown
    >;
    expect(inserted.businessId).toBe('biz-9');
    // Se guarda solo el hash del token; el token en claro se devuelve una vez.
    expect(inserted.deviceTokenHash).not.toBe(result.deviceToken);
    expect(result.device).toMatchObject({ id: 'dev-9' });
  });
});
