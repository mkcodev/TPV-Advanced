import {
  applyPinFailure,
  applyPinSuccess,
  checkLockout,
  generatePairingCode,
  pairingCodeExpiresAt,
} from '@tpv/core';
import { devices, employees, pairingCodes } from '@tpv/db';
import type { DeviceType } from '@tpv/db';
import {
  createPairingCodeSchema,
  employeeLoginSchema,
  pairDeviceSchema,
  revokeDeviceSchema,
} from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logAuthEvent } from '../auth/events';
import { DUMMY_HASH_PROMISE, verifyPin } from '../auth/pin';
import { consumeRateLimit } from '../auth/rate-limit-store';
import { signEmployeeSession } from '../auth/session';
import { generateDeviceToken, sha256Base64Url } from '../auth/tokens';
import { getServerEnv } from '../env';
import { adminProcedure, deviceProcedure } from '../procedures';
import { publicProcedure, router } from '../trpc';

// Uses Web Crypto (available in Node.js 19+ and all Edge runtimes).
function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor(((buf[0] ?? 0) / 0x100000000) * max);
}

export const authRouter = router({
  // Admin generates a one-time pairing code that the terminal redeems.
  createPairingCode: adminProcedure
    .input(createPairingCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const code = generatePairingCode(secureRandomInt);
      const expiresAt = pairingCodeExpiresAt(new Date());

      // Only Supabase admin users can create pairing codes — employees.id is not a
      // valid FK to users.id and the device path has no stable users.id at all.
      if (ctx.auth.kind !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'device terminals cannot create pairing codes',
        });
      }

      await ctx.db.insert(pairingCodes).values({
        businessId: ctx.businessId,
        code,
        deviceName: input.name,
        deviceType: input.type,
        createdBy: ctx.auth.userId,
        expiresAt,
      });

      await logAuthEvent(ctx.db, {
        businessId: ctx.businessId,
        eventType: 'pairing_code_created',
        payload: { name: input.name, type: input.type },
      });

      return { code, expiresAt };
    }),

  // Terminal redeems a pairing code and receives a persistent device token.
  pairDevice: publicProcedure.input(pairDeviceSchema).mutation(async ({ ctx, input }) => {
    const ip = ctx.ip;
    const now = new Date();
    const allowed = await consumeRateLimit(ctx.db, `pair:${ip}`, now);
    if (!allowed) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many pairing attempts' });
    }

    // Atomic claim: UPDATE returns 0 rows if code is wrong, expired, or already used.
    // This prevents both double-redemption and SELECT+UPDATE race conditions.
    const claimed = (await ctx.db.execute(sql`
      UPDATE pairing_codes
      SET used_at = now()
      WHERE code = ${input.code}
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING business_id, device_name, device_type, created_by
    `)) as { business_id: string; device_name: string; device_type: string; created_by: string }[];

    if (claimed.length === 0) {
      // Intentionally vague — don't reveal whether the code ever existed.
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid or expired pairing code' });
    }

    const row = claimed[0];
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    const deviceToken = generateDeviceToken();
    const deviceTokenHash = sha256Base64Url(deviceToken);

    const [device] = await ctx.db
      .insert(devices)
      .values({
        businessId: row.business_id,
        name: row.device_name,
        type: row.device_type as DeviceType,
        deviceTokenHash,
        isActive: true,
        lastSeenAt: now,
      })
      .returning({ id: devices.id, name: devices.name, type: devices.type });

    if (!device) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    await logAuthEvent(ctx.db, {
      businessId: row.business_id,
      deviceId: device.id,
      eventType: 'device_paired',
      payload: { name: device.name, type: device.type, createdBy: row.created_by },
    });

    // deviceToken is returned in cleartext only here — never stored, never logged.
    return { deviceToken, device };
  }),

  // Employee authenticates with PIN and receives a short-lived session JWT.
  employeeLogin: deviceProcedure.input(employeeLoginSchema).mutation(async ({ ctx, input }) => {
    const now = new Date();
    const rateLimitKey = `login:${ctx.ip}:${ctx.deviceId}`;
    const allowed = await consumeRateLimit(ctx.db, rateLimitKey, now);
    if (!allowed) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts' });
    }

    // Load employee — must belong to this business and be active.
    const [employee] = await ctx.db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, input.employeeId),
          eq(employees.businessId, ctx.businessId),
          eq(employees.isActive, true),
        ),
      )
      .limit(1);

    // Anti-timing: run verifyPin against a dummy hash when the employee doesn't
    // exist, so response time is indistinguishable from a wrong-PIN failure.
    const pinHash = employee?.pinHash ?? (await DUMMY_HASH_PROMISE);
    const pinValid = await verifyPin(pinHash, input.pin);

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
      await ctx.db
        .update(employees)
        .set({ failedPinAttempts: failure.failedPinAttempts, lockedUntil: failure.lockedUntil })
        .where(eq(employees.id, employee.id));

      await logAuthEvent(ctx.db, {
        businessId: ctx.businessId,
        deviceId: ctx.deviceId ?? undefined,
        employeeId: employee.id,
        eventType: 'employee_login_failed',
      });

      if (failure.justLocked) {
        await logAuthEvent(ctx.db, {
          businessId: ctx.businessId,
          deviceId: ctx.deviceId ?? undefined,
          employeeId: employee.id,
          eventType: 'employee_locked_out',
          payload: { until: failure.lockedUntil },
        });
      }

      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    // Success: reset lockout counters.
    const reset = applyPinSuccess();
    await ctx.db.update(employees).set(reset).where(eq(employees.id, employee.id));

    const deviceId = ctx.deviceId;
    if (!deviceId) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const sessionToken = await signEmployeeSession(
      { employeeId: employee.id, deviceId },
      getServerEnv().AUTH_SESSION_SECRET,
    );

    await logAuthEvent(ctx.db, {
      businessId: ctx.businessId,
      deviceId: deviceId,
      employeeId: employee.id,
      eventType: 'employee_login_succeeded',
    });

    return {
      sessionToken,
      employee: {
        id: employee.id,
        name: employee.name,
        avatarUrl: employee.avatarUrl,
        role: employee.role,
      },
    };
  }),

  // Lists active employees for the PIN-pad avatar picker (no pinHash).
  listEmployees: deviceProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: employees.id,
        name: employees.name,
        avatarUrl: employees.avatarUrl,
        role: employees.role,
      })
      .from(employees)
      .where(and(eq(employees.businessId, ctx.businessId), eq(employees.isActive, true)));
  }),

  // Admin revokes a device — clears its token hash and marks it inactive.
  revokeDevice: adminProcedure.input(revokeDeviceSchema).mutation(async ({ ctx, input }) => {
    const [device] = await ctx.db
      .update(devices)
      .set({ deviceTokenHash: null, isActive: false })
      .where(and(eq(devices.id, input.deviceId), eq(devices.businessId, ctx.businessId)))
      .returning({ id: devices.id, name: devices.name });

    if (!device) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });
    }

    await logAuthEvent(ctx.db, {
      businessId: ctx.businessId,
      deviceId: device.id,
      eventType: 'device_revoked',
      payload: { name: device.name },
    });

    return { revoked: true };
  }),
});
