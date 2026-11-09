// Router de sesión de caja (arqueo / cierre Z).
// businessId, employeeId, deviceId SIEMPRE de ctx — nunca del input.
// Los movimientos de caja son append-only: no hay endpoints update/delete.
// El esperado se calcula en servidor con @tpv/core.computeExpectedCashCents.
// Cierre ciego: el servidor decide quién ve el esperado (canSeeExpectedCash); el cliente
// nunca elige. El rol sale de ctx.employeeId (PIN) leído en BD, jamás del input.

import { canSeeExpectedCash, computeDifferenceCents, computeExpectedCashCents } from '@tpv/core';
import {
  type BusinessTransaction,
  type Database,
  businesses,
  cashMovements,
  cashSessions,
  employees,
  payments,
  withBusinessContext,
} from '@tpv/db';
import {
  addCashMovementSchema,
  closeCashSessionSchema,
  getZReportSchema,
  openCashSessionSchema,
} from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { deviceProcedure, getEmployeeRole } from '../procedures';
import { router } from '../trpc';

// Único sitio donde se agrega el efectivo de una sesión: lo usan close y getExpected,
// así el chip y el cierre nunca pueden divergir. Todas las sumas filtran por business_id.
async function loadExpectedCashCents(
  tx: BusinessTransaction,
  businessId: string,
  session: { id: string; openingAmountCents: number },
): Promise<number> {
  const [cashRow] = await tx
    .select({ total: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.businessId, businessId),
        eq(payments.cashSessionId, session.id),
        eq(payments.method, 'cash'),
        eq(payments.status, 'completed'),
      ),
    );

  const [payInRow] = await tx
    .select({ total: sql<number>`COALESCE(SUM(${cashMovements.amountCents}), 0)` })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.businessId, businessId),
        eq(cashMovements.cashSessionId, session.id),
        eq(cashMovements.type, 'pay_in'),
      ),
    );

  const [payOutRow] = await tx
    .select({ total: sql<number>`COALESCE(SUM(${cashMovements.amountCents}), 0)` })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.businessId, businessId),
        eq(cashMovements.cashSessionId, session.id),
        eq(cashMovements.type, 'pay_out'),
      ),
    );

  return computeExpectedCashCents({
    openingAmountCents: session.openingAmountCents,
    cashPaymentsCents: Number(cashRow?.total ?? 0),
    payInCents: Number(payInRow?.total ?? 0),
    payOutCents: Number(payOutRow?.total ?? 0),
  });
}

// ¿Puede quien llama ver el esperado? Solo recibe ctx (nunca input del cliente):
// ajuste del negocio (ctx.businessId) + rol del empleado que fichó con PIN (ctx.employeeId).
// Fail-closed: negocio no encontrado => ciego; sin empleado => rol null => no lo ve.
async function canCallerSeeExpected(
  tx: BusinessTransaction,
  ctx: { db: Database; businessId: string; employeeId: string | null },
): Promise<boolean> {
  const [biz] = await tx
    .select({ blindCashClose: businesses.blindCashClose })
    .from(businesses)
    .where(eq(businesses.id, ctx.businessId))
    .limit(1);
  const role = ctx.employeeId
    ? await getEmployeeRole(ctx.db, ctx.employeeId, ctx.businessId)
    : null;
  return canSeeExpectedCash(role, biz?.blindCashClose ?? true);
}

export const cashSessionRouter = router({
  // Devuelve la sesión 'open' del device actual, o null si no hay ninguna.
  // Select explícito: así un campo de cuadre nuevo en la tabla no se filtra por accidente.
  getCurrent: deviceProcedure.query(async ({ ctx }) => {
    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [session] = await tx
        .select({
          id: cashSessions.id,
          openingAmountCents: cashSessions.openingAmountCents,
          openedAt: cashSessions.openedAt,
          openedBy: cashSessions.openedBy,
          status: cashSessions.status,
        })
        .from(cashSessions)
        .where(
          and(
            eq(cashSessions.businessId, ctx.businessId),
            eq(cashSessions.deviceId, ctx.deviceId as string),
            eq(cashSessions.status, 'open'),
          ),
        )
        .limit(1);
      return session ?? null;
    });
  }),

  // Abre una sesión con fondo inicial. Falla si ya hay una open en este device.
  open: deviceProcedure.input(openCashSessionSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const employeeId = ctx.employeeId;

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      try {
        const [session] = await tx
          .insert(cashSessions)
          .values({
            businessId: ctx.businessId,
            deviceId: ctx.deviceId as string,
            openedBy: employeeId,
            openingAmountCents: input.openingAmountCents,
            status: 'open',
          })
          .returning();
        return session;
      } catch (err) {
        // Postgres unique_violation = code 23505
        if (
          err != null &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Session already open on this device',
          });
        }
        throw err;
      }
    });
  }),

  // Registra una entrada o salida manual de efectivo (append-only).
  addMovement: deviceProcedure.input(addCashMovementSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const employeeId = ctx.employeeId;

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [session] = await tx
        .select({ id: cashSessions.id })
        .from(cashSessions)
        .where(
          and(
            eq(cashSessions.businessId, ctx.businessId),
            eq(cashSessions.deviceId, ctx.deviceId as string),
            eq(cashSessions.status, 'open'),
          ),
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Open cash session required',
        });
      }

      const [movement] = await tx
        .insert(cashMovements)
        .values({
          businessId: ctx.businessId,
          cashSessionId: session.id,
          type: input.type,
          amountCents: input.amountCents,
          reason: input.reason,
          employeeId,
        })
        .returning();

      return movement;
    });
  }),

  // Cierra la sesión: el servidor calcula el esperado y el descuadre.
  close: deviceProcedure.input(closeCashSessionSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const employeeId = ctx.employeeId;

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      // Lock the session row to prevent concurrent closes.
      const [session] = await tx
        .select({
          id: cashSessions.id,
          openingAmountCents: cashSessions.openingAmountCents,
          status: cashSessions.status,
        })
        .from(cashSessions)
        .where(
          and(
            eq(cashSessions.businessId, ctx.businessId),
            eq(cashSessions.deviceId, ctx.deviceId as string),
            eq(cashSessions.status, 'open'),
          ),
        )
        .for('update')
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No open cash session found on this device',
        });
      }

      const expectedAmountCents = await loadExpectedCashCents(tx, ctx.businessId, session);
      const differenceCents = computeDifferenceCents(input.countedAmountCents, expectedAmountCents);

      const now = new Date();
      await tx
        .update(cashSessions)
        .set({
          closedBy: employeeId,
          closedAt: now,
          countedAmountCents: input.countedAmountCents,
          expectedAmountCents,
          differenceCents,
          status: 'closed',
          updatedAt: now,
        })
        .where(and(eq(cashSessions.id, session.id), eq(cashSessions.status, 'open')));

      // La BD guarda siempre los valores reales (auditoría). Solo la RESPUESTA se redacta:
      // con cierre ciego, un worker no recibe esperado ni descuadre (ambos delatan el esperado).
      const canSee = await canCallerSeeExpected(tx, ctx);
      return {
        sessionId: session.id,
        expectedAmountCents: canSee ? expectedAmountCents : null,
        differenceCents: canSee ? differenceCents : null,
      };
    });
  }),

  // Efectivo esperado ahora mismo (fondo + cobros en efectivo + entradas − salidas) para el chip.
  // null = no hay caja abierta. visible:false = cierre ciego para este rol (no se calcula nada).
  getExpected: deviceProcedure.query(async ({ ctx }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [session] = await tx
        .select({ id: cashSessions.id, openingAmountCents: cashSessions.openingAmountCents })
        .from(cashSessions)
        .where(
          and(
            eq(cashSessions.businessId, ctx.businessId),
            eq(cashSessions.deviceId, ctx.deviceId as string),
            eq(cashSessions.status, 'open'),
          ),
        )
        .limit(1);

      if (!session) return null;

      if (!(await canCallerSeeExpected(tx, ctx))) {
        return { visible: false as const, expectedAmountCents: null };
      }
      return {
        visible: true as const,
        expectedAmountCents: await loadExpectedCashCents(tx, ctx.businessId, session),
      };
    });
  }),

  // Devuelve el informe Z (o X si la sesión aún está open).
  // Válido para cualquier sesión del negocio — multi-tenant via businessId.
  getZReport: deviceProcedure.input(getZReportSchema).query(async ({ ctx, input }) => {
    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [session] = await tx
        .select()
        .from(cashSessions)
        .where(
          and(eq(cashSessions.id, input.sessionId), eq(cashSessions.businessId, ctx.businessId)),
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cash session not found' });
      }

      // Cierre ciego. Informe X (sesión abierta): con totales por método + movimientos se
      // deduce el esperado, así que se bloquea entero. Informe Z (cerrada): el recuento ya
      // está fijado, solo se ocultan esperado y descuadre.
      const canSee = await canCallerSeeExpected(tx, ctx);
      if (!canSee && session.status === 'open') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Expected cash is hidden (blind close)',
        });
      }

      // Business info for the report header.
      const [business] = await tx
        .select({
          name: businesses.name,
          legalName: businesses.legalName,
          taxId: businesses.taxId,
          address: businesses.address,
        })
        .from(businesses)
        .where(eq(businesses.id, ctx.businessId))
        .limit(1);

      // Payments grouped by method.
      const allPayments = await tx
        .select({
          method: payments.method,
          employeeId: payments.employeeId,
          amountCents: payments.amountCents,
          tipCents: payments.tipCents,
        })
        .from(payments)
        .where(and(eq(payments.cashSessionId, session.id), eq(payments.status, 'completed')));

      // Aggregate by method.
      const byMethod: Record<string, { amountCents: number; tipCents: number; count: number }> = {};
      for (const p of allPayments) {
        const key = p.method;
        if (!byMethod[key]) byMethod[key] = { amountCents: 0, tipCents: 0, count: 0 };
        byMethod[key].amountCents += p.amountCents;
        byMethod[key].tipCents += p.tipCents;
        byMethod[key].count += 1;
      }

      // Aggregate by employee.
      const byEmployee: Record<string, { amountCents: number; tipCents: number }> = {};
      for (const p of allPayments) {
        const key = p.employeeId;
        if (!byEmployee[key]) byEmployee[key] = { amountCents: 0, tipCents: 0 };
        byEmployee[key].amountCents += p.amountCents;
        byEmployee[key].tipCents += p.tipCents;
      }

      // Movements in chronological order.
      const movements = await tx
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.cashSessionId, session.id))
        .orderBy(asc(cashMovements.createdAt));

      // Employee names for opener/closer/payment employees.
      const employeeIds = [session.openedBy, session.closedBy, ...Object.keys(byEmployee)].filter(
        (id): id is string => id != null,
      );
      const uniqueIds = [...new Set(employeeIds)];

      const employeeRows = uniqueIds.length
        ? await tx
            .select({ id: employees.id, name: employees.name })
            .from(employees)
            .where(and(eq(employees.businessId, ctx.businessId), inArray(employees.id, uniqueIds)))
        : [];

      const employeeMap = Object.fromEntries(employeeRows.map((e) => [e.id, e.name]));

      return {
        session: canSee
          ? session
          : { ...session, expectedAmountCents: null, differenceCents: null },
        business: business ?? null,
        byMethod,
        byEmployee,
        movements,
        employeeMap,
      };
    });
  }),
});
