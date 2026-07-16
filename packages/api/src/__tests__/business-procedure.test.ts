import type { Database } from '@tpv/db';
import { describe, expect, it } from 'vitest';
import type { Context } from '../context';
import { businessProcedure, createCallerFactory, router } from '../trpc';

// Router mínimo solo para el test: expone lo que el middleware inyecta en ctx.
const testRouter = router({
  whoami: businessProcedure.query(({ ctx }) => ({
    businessId: ctx.businessId,
    userId: ctx.userId,
    deviceId: ctx.deviceId,
    employeeId: ctx.employeeId,
  })),
});

const createCaller = createCallerFactory(testRouter);

// db e ip no son usados por businessProcedure, los falseamos para el test.
const MOCK_DB = {} as unknown as Database;
const callerWith = (auth: Context['auth']) => createCaller({ auth, db: MOCK_DB, ip: '127.0.0.1' });

describe('businessProcedure', () => {
  it('derives businessId from a device context', async () => {
    const result = await callerWith({
      kind: 'device',
      deviceId: 'dev-1',
      businessId: 'biz-1',
      employeeId: 'emp-1',
    }).whoami();

    expect(result).toEqual({
      businessId: 'biz-1',
      userId: null,
      deviceId: 'dev-1',
      employeeId: 'emp-1',
    });
  });

  it('derives businessId from an admin context with an active business', async () => {
    const result = await callerWith({
      kind: 'admin',
      userId: 'user-1',
      businessId: 'biz-1',
    }).whoami();

    expect(result).toEqual({
      businessId: 'biz-1',
      userId: 'user-1',
      deviceId: null,
      employeeId: null,
    });
  });

  it('rejects anonymous requests with UNAUTHORIZED', async () => {
    await expect(callerWith({ kind: 'anonymous' }).whoami()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects an admin without an active business with FORBIDDEN', async () => {
    await expect(
      callerWith({ kind: 'admin', userId: 'user-1', businessId: null }).whoami(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
