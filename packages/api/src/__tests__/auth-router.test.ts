import type { Database } from '@tpv/db';
import { describe, expect, it } from 'vitest';
import type { Context } from '../context';
import { authRouter } from '../routers/auth';
import { createCallerFactory, router } from '../trpc';

const testRouter = router({ auth: authRouter });
const createCaller = createCallerFactory(testRouter);

// Builds a Drizzle-like chainable stub that resolves to `rows` at the end of
// any chain (select/from/where/limit/innerJoin/returning/etc.).
function drizzleChain(rows: unknown[]): unknown {
  // biome-ignore lint/suspicious/noExplicitAny: stub
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject);
      }
      // Every method in the chain returns another proxy.
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

// Mock DB that makes getEmployeeRole return 'admin' so adminProcedure passes.
// The FORBIDDEN check in createPairingCode fires before any INSERT.
function makeDb(employeeRole: string): Database {
  return { select: () => drizzleChain([{ role: employeeRole }]) } as unknown as Database;
}

const callerWith = (auth: Context['auth'], db: Database) =>
  createCaller({ auth, db, ip: '127.0.0.1' });

describe('auth.createPairingCode', () => {
  it('throws FORBIDDEN when called from a device context (even with admin role)', async () => {
    // adminProcedure passes (role = 'admin'), then our handler check fires.
    const caller = callerWith(
      { kind: 'device', deviceId: 'dev-1', businessId: 'biz-1', employeeId: 'emp-1' },
      makeDb('admin'),
    );

    await expect(
      caller.auth.createPairingCode({ name: 'Terminal 1', type: 'pos_terminal' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'device terminals cannot create pairing codes',
    });
  });
});
