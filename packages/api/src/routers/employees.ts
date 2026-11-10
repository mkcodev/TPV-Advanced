// Gestión de empleados desde el panel admin (alta, edición, desactivar, cambio de PIN).
// Principios:
// - Solo owner/admin del panel (panelAdminProcedure): un terminal nunca gestiona personal.
// - business_id SIEMPRE de ctx; el input no lo lleva y todo WHERE lo incluye.
// - Nunca se borra un empleado: hay ventas y system_events que lo referencian.
// - El PIN solo se hashea aquí y NUNCA se devuelve ni se registra en eventos.
// - No se impone PIN único por negocio: el login es "elige empleado + PIN" y el hash
//   lleva sal, así que dos empleados con el mismo PIN no se pisan.

import { employees } from '@tpv/db';
import {
  createEmployeeSchema,
  setEmployeeActiveSchema,
  setEmployeePinSchema,
  updateEmployeeSchema,
} from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { and, asc, eq } from 'drizzle-orm';
import { logAuthEvent } from '../auth/events';
import { hashPin } from '../auth/pin';
import { panelAdminProcedure } from '../procedures';
import { router } from '../trpc';

// Columnas que salen al panel. Sin pinHash ni datos laborales (hourlyWageCents).
const publicColumns = {
  id: employees.id,
  name: employees.name,
  role: employees.role,
  isActive: employees.isActive,
  lockedUntil: employees.lockedUntil,
  createdAt: employees.createdAt,
};

export const employeesRouter = router({
  list: panelAdminProcedure.query(async ({ ctx }) =>
    ctx.db
      .select(publicColumns)
      .from(employees)
      .where(eq(employees.businessId, ctx.businessId))
      .orderBy(asc(employees.name)),
  ),

  create: panelAdminProcedure.input(createEmployeeSchema).mutation(async ({ ctx, input }) => {
    const pinHash = await hashPin(input.pin);
    const [row] = await ctx.db
      .insert(employees)
      .values({
        businessId: ctx.businessId,
        name: input.name,
        role: input.role,
        pinHash,
      })
      .returning(publicColumns);
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    await logAuthEvent(ctx.db, {
      businessId: ctx.businessId,
      employeeId: row.id,
      eventType: 'employee_created',
      payload: { name: row.name, role: row.role },
    });
    return row;
  }),

  // Patch campo a campo: cada campo del schema tiene su test (CLAUDE.md §6).
  update: panelAdminProcedure.input(updateEmployeeSchema).mutation(async ({ ctx, input }) => {
    const patch = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.role !== undefined && { role: input.role }),
    };
    // Sin campos que cambiar: no se lanza un UPDATE vacío (Drizzle lo rechaza).
    if (Object.keys(patch).length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nothing to update' });
    }

    const [row] = await ctx.db
      .update(employees)
      .set(patch)
      .where(and(eq(employees.id, input.id), eq(employees.businessId, ctx.businessId)))
      .returning(publicColumns);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

    await logAuthEvent(ctx.db, {
      businessId: ctx.businessId,
      employeeId: row.id,
      eventType: 'employee_updated',
      payload: patch,
    });
    return row;
  }),

  // Desactivar en vez de borrar. Su sesión PIN deja de valer en la siguiente petición
  // (el resolver comprueba is_active).
  setActive: panelAdminProcedure.input(setEmployeeActiveSchema).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .update(employees)
      .set({ isActive: input.isActive })
      .where(and(eq(employees.id, input.id), eq(employees.businessId, ctx.businessId)))
      .returning(publicColumns);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

    await logAuthEvent(ctx.db, {
      businessId: ctx.businessId,
      employeeId: row.id,
      eventType: input.isActive ? 'employee_reactivated' : 'employee_deactivated',
    });
    return row;
  }),

  // Cambiar el PIN también desbloquea: pone a cero los intentos fallidos y el bloqueo.
  setPin: panelAdminProcedure.input(setEmployeePinSchema).mutation(async ({ ctx, input }) => {
    const pinHash = await hashPin(input.pin);
    const [row] = await ctx.db
      .update(employees)
      .set({ pinHash, failedPinAttempts: 0, lockedUntil: null })
      .where(and(eq(employees.id, input.id), eq(employees.businessId, ctx.businessId)))
      .returning({ id: employees.id });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });

    // El payload no lleva el PIN ni el hash.
    await logAuthEvent(ctx.db, {
      businessId: ctx.businessId,
      employeeId: row.id,
      eventType: 'employee_pin_changed',
    });
    return { id: row.id };
  }),
});
