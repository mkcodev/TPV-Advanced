// Tests de verifyEmployeePin: lo comparten el login del TPV y la anulación con PIN de encargado.
// argon2, el rate-limit y los eventos se simulan; checkLockout/applyPinFailure son los reales.

import type { Database } from '@tpv/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyEmployeePin } from '../auth/verify-employee-pin';

const consumeRateLimit = vi.hoisted(() => vi.fn());
const verifyPin = vi.hoisted(() => vi.fn());
const logAuthEvent = vi.hoisted(() => vi.fn());
vi.mock('../auth/rate-limit-store', () => ({ consumeRateLimit }));
vi.mock('../auth/pin', () => ({ verifyPin, DUMMY_HASH_PROMISE: Promise.resolve('dummy-hash') }));
vi.mock('../auth/events', () => ({ logAuthEvent }));

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
  const db = { select: () => makeChain(), update: () => makeChain() } as unknown as Database;
  return { db, calls };
}

const BIZ_ID = 'biz-00000000-0000-0000-0000-000000000001';
const EMP_ID = 'cccccccc-0000-0000-0000-000000000001';
const NOW = new Date('2026-11-10T10:00:00Z');

const OPTS = {
  businessId: BIZ_ID,
  deviceId: 'dev-1',
  ip: '10.0.0.1',
  employeeId: EMP_ID,
  pin: '1234',
  now: NOW,
};

const employee = (over: Record<string, unknown> = {}) => ({
  id: EMP_ID,
  businessId: BIZ_ID,
  role: 'manager',
  pinHash: 'hash',
  failedPinAttempts: 0,
  lockedUntil: null,
  ...over,
});

beforeEach(() => {
  consumeRateLimit.mockReset().mockResolvedValue(true);
  verifyPin.mockReset().mockResolvedValue(true);
  logAuthEvent.mockReset().mockResolvedValue(undefined);
});

describe('verifyEmployeePin', () => {
  it('PIN correcto → devuelve el empleado y no escribe contadores', async () => {
    const { db, calls } = queuedDb([[employee()]]);
    const result = await verifyEmployeePin(db, OPTS);
    expect(result.id).toBe(EMP_ID);
    expect(calls.filter((c) => c.method === 'set')).toHaveLength(0);
    expect(logAuthEvent).not.toHaveBeenCalled();
  });

  it('usa la clave de rate-limit login:<ip>:<deviceId>', async () => {
    const { db } = queuedDb([[employee()]]);
    await verifyEmployeePin(db, OPTS);
    expect(consumeRateLimit).toHaveBeenCalledWith(db, 'login:10.0.0.1:dev-1', NOW);
  });

  it('rate-limit agotado → TOO_MANY_REQUESTS sin consultar al empleado', async () => {
    consumeRateLimit.mockResolvedValue(false);
    const { db } = queuedDb([[employee()]]);
    await expect(verifyEmployeePin(db, OPTS)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(verifyPin).not.toHaveBeenCalled();
  });

  it('empleado de otro negocio / inexistente / inactivo (el SELECT no lo devuelve) → UNAUTHORIZED y verifica contra el hash falso', async () => {
    const { db } = queuedDb([[]]);
    await expect(verifyEmployeePin(db, OPTS)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    });
    // Anti-timing: se ejecutó verifyPin igualmente, con el hash falso.
    expect(verifyPin).toHaveBeenCalledWith('dummy-hash', '1234');
  });

  it('empleado bloqueado → FORBIDDEN con la hora de desbloqueo', async () => {
    const until = new Date(NOW.getTime() + 5 * 60_000);
    const { db } = queuedDb([[employee({ lockedUntil: until })]]);
    await expect(verifyEmployeePin(db, OPTS)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: `Account locked until ${until.toISOString()}`,
    });
  });

  it('PIN mal → UNAUTHORIZED, sube el contador y registra employee_login_failed', async () => {
    verifyPin.mockResolvedValue(false);
    const { db, calls } = queuedDb([[employee({ failedPinAttempts: 1 })], [{}]]);
    await expect(verifyEmployeePin(db, OPTS)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const set = calls.find((c) => c.method === 'set')?.args[0] as Record<string, unknown>;
    expect(set).toMatchObject({ failedPinAttempts: 2 });
    expect(logAuthEvent).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        businessId: BIZ_ID,
        employeeId: EMP_ID,
        eventType: 'employee_login_failed',
      }),
    );
  });

  it('el fallo que alcanza el límite bloquea y registra employee_locked_out', async () => {
    verifyPin.mockResolvedValue(false);
    // Un intento antes del límite (5 en la política actual): este fallo lo bloquea.
    const { db, calls } = queuedDb([[employee({ failedPinAttempts: 4 })], [{}]]);
    await expect(verifyEmployeePin(db, OPTS)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const set = calls.find((c) => c.method === 'set')?.args[0] as Record<string, unknown>;
    expect(set.lockedUntil).toBeInstanceOf(Date);
    const types = logAuthEvent.mock.calls.map((c) => (c[1] as { eventType: string }).eventType);
    expect(types).toEqual(['employee_login_failed', 'employee_locked_out']);
  });
});
