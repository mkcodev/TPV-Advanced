// Verificación de PIN de un empleado: rate-limit → empleado (negocio + activo) → hash →
// bloqueo → contador de fallos. La usan el login del TPV y la anulación con PIN de encargado,
// así los dos comparten rate-limit, lockout y eventos de auditoría.
//
// OJO: debe llamarse FUERA de cualquier transacción que pueda revertirse. Si el PIN falla se
// escribe el contador de intentos (y el bloqueo), y ese UPDATE tiene que sobrevivir al error.

import { applyPinFailure, checkLockout } from '@tpv/core';
import { employees } from '@tpv/db';
import type { Database } from '@tpv/db';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { logAuthEvent } from './events';
import { DUMMY_HASH_PROMISE, verifyPin } from './pin';
import { consumeRateLimit } from './rate-limit-store';

export interface VerifyEmployeePinOpts {
  businessId: string;
  deviceId: string | null;
  ip: string;
  employeeId: string;
  pin: string;
  now?: Date;
}

export type VerifiedEmployee = typeof employees.$inferSelect;

// Devuelve el empleado si el PIN es correcto. NO resetea los contadores: eso lo hace quien
// llama (applyPinSuccess), porque cada caso decide qué más registrar al tener éxito.
export async function verifyEmployeePin(
  db: Database,
  opts: VerifyEmployeePinOpts,
): Promise<VerifiedEmployee> {
  const now = opts.now ?? new Date();

  const allowed = await consumeRateLimit(db, `login:${opts.ip}:${opts.deviceId}`, now);
  if (!allowed) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts' });
  }

  // Load employee — must belong to this business and be active.
  const [employee] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, opts.employeeId),
        eq(employees.businessId, opts.businessId),
        eq(employees.isActive, true),
      ),
    )
    .limit(1);

  // Anti-timing: run verifyPin against a dummy hash when the employee doesn't
  // exist, so response time is indistinguishable from a wrong-PIN failure.
  const pinHash = employee?.pinHash ?? (await DUMMY_HASH_PROMISE);
  const pinValid = await verifyPin(pinHash, opts.pin);

  if (!employee) {
    // Don't reveal that the employee ID doesn't exist.
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
  }

  // Check lockout before returning success (after dummy-verify path is past).
  const lockout = checkLockout(employee, now);
  if (lockout.locked) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Account locked until ${lockout.until.toISOString()}`,
    });
  }

  if (!pinValid) {
    const failure = applyPinFailure(employee, now);
    await db
      .update(employees)
      .set({ failedPinAttempts: failure.failedPinAttempts, lockedUntil: failure.lockedUntil })
      .where(eq(employees.id, employee.id));

    await logAuthEvent(db, {
      businessId: opts.businessId,
      deviceId: opts.deviceId ?? undefined,
      employeeId: employee.id,
      eventType: 'employee_login_failed',
    });

    if (failure.justLocked) {
      await logAuthEvent(db, {
        businessId: opts.businessId,
        deviceId: opts.deviceId ?? undefined,
        employeeId: employee.id,
        eventType: 'employee_locked_out',
        payload: { until: failure.lockedUntil },
      });
    }

    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
  }

  return employee;
}
