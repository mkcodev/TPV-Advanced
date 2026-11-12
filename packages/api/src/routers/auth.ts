import {
  PAIRING_CODE_TTL_MS,
  applyPinSuccess,
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
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { logAuthEvent } from '../auth/events';
import { consumeRateLimit } from '../auth/rate-limit-store';
import { signEmployeeSession } from '../auth/session';
import { generateDeviceToken, sha256Base64Url } from '../auth/tokens';
import { verifyEmployeePin } from '../auth/verify-employee-pin';
import { getServerEnv } from '../env';
import { deviceProcedure, panelAdminProcedure } from '../procedures';
import { publicProcedure, router } from '../trpc';

const MAX_CODE_ATTEMPTS = 3;

// Uses Web Crypto (available in Node.js 19+ and all Edge runtimes).
function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor(((buf[0] ?? 0) / 0x100000000) * max);
}

export const authRouter = router({
  // Admin generates a one-time pairing code that the terminal redeems.
  // Solo el panel (panelAdminProcedure): pairing_codes.created_by es FK a users.id,
  // y un terminal no tiene users.id.
  createPairingCode: panelAdminProcedure
    .input(createPairingCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      // pairDevice busca el código SIN negocio (el terminal aún no tiene ninguno), así que dos
      // códigos activos iguales de negocios distintos serían ambiguos. Se regenera si choca.
      // (Comprobar+insertar no es atómico; con 10^8 códigos y pocos activos el riesgo es
      // despreciable, y pairDevice reclama una sola fila de todos modos.)
      let code = '';
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
        const candidate = generatePairingCode(secureRandomInt);
        const clash = await ctx.db
          .select({ id: pairingCodes.id })
          .from(pairingCodes)
          .where(
            and(
              eq(pairingCodes.code, candidate),
              isNull(pairingCodes.usedAt),
              gt(pairingCodes.expiresAt, now),
            ),
          )
          .limit(1);
        if (clash.length === 0) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const expiresAt = pairingCodeExpiresAt(now);

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

      // ttlMs permite al panel contar atrás con su propio reloj (sin depender de que el
      // reloj del navegador coincida con el del servidor).
      return { code, expiresAt, ttlMs: PAIRING_CODE_TTL_MS };
    }),

  // Admin lists the business terminals. Never exposes deviceTokenHash.
  listDevices: panelAdminProcedure.query(async ({ ctx }) =>
    ctx.db
      .select({
        id: devices.id,
        name: devices.name,
        type: devices.type,
        isActive: devices.isActive,
        lastSeenAt: devices.lastSeenAt,
        createdAt: devices.createdAt,
      })
      .from(devices)
      .where(eq(devices.businessId, ctx.businessId))
      .orderBy(desc(devices.createdAt)),
  ),

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
    // El subselect elige UNA sola fila (la más antigua) y la bloquea: aunque dos códigos
    // activos coincidieran, solo se consume uno y el terminal nunca queda ligado a dos negocios.
    const claimed = (await ctx.db.execute(sql`
      UPDATE pairing_codes
      SET used_at = now()
      WHERE id = (
        SELECT id FROM pairing_codes
        WHERE code = ${input.code}
          AND used_at IS NULL
          AND expires_at > now()
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
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
    // Rate-limit, lockout, contador de fallos y eventos viven en verifyEmployeePin
    // (compartido con la anulación de líneas con PIN de encargado).
    const employee = await verifyEmployeePin(ctx.db, {
      businessId: ctx.businessId,
      deviceId: ctx.deviceId,
      ip: ctx.ip,
      employeeId: input.employeeId,
      pin: input.pin,
    });

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
  revokeDevice: panelAdminProcedure.input(revokeDeviceSchema).mutation(async ({ ctx, input }) => {
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
