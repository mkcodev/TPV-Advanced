import { businesses, employees, memberships, organizations } from '@tpv/db';
import type { Database, EmployeeRole, MembershipRole } from '@tpv/db';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { businessProcedure } from './trpc';

// Device-only procedure: rejects admin-panel requests.
// Use for TPV-only endpoints (employee login, order management).
export const deviceProcedure = businessProcedure.use(({ ctx, next }) => {
  if (ctx.auth.kind !== 'device') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Device authentication required' });
  }
  return next({ ctx });
});

// Reads employee role from DB — never trust role from JWT claims.
async function getEmployeeRole(
  db: Database,
  employeeId: string,
  businessId: string,
): Promise<EmployeeRole | null> {
  const [row] = await db
    .select({ role: employees.role })
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.businessId, businessId),
        eq(employees.isActive, true),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

// Reads membership role for admin-panel users.
async function getMembershipRole(
  db: Database,
  userId: string,
  businessId: string,
): Promise<MembershipRole | null> {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .innerJoin(
      businesses,
      and(eq(businesses.organizationId, organizations.id), eq(businesses.id, businessId)),
    )
    .where(eq(memberships.userId, userId))
    .limit(1);
  return row?.role ?? null;
}

// Manager-level: employee role manager|admin, or admin-panel owner|admin.
export const managerProcedure = businessProcedure.use(async ({ ctx, next }) => {
  if (ctx.auth.kind === 'device') {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const role = await getEmployeeRole(ctx.db, ctx.employeeId, ctx.businessId);
    if (role !== 'manager' && role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Manager role required' });
    }
  } else if (ctx.auth.kind === 'admin') {
    const role = await getMembershipRole(ctx.db, ctx.auth.userId, ctx.businessId);
    if (role !== 'owner' && role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin membership required' });
    }
  } else {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});

// Admin-level: employee role admin only, or admin-panel owner|admin.
export const adminProcedure = businessProcedure.use(async ({ ctx, next }) => {
  if (ctx.auth.kind === 'device') {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const role = await getEmployeeRole(ctx.db, ctx.employeeId, ctx.businessId);
    if (role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
    }
  } else if (ctx.auth.kind === 'admin') {
    const role = await getMembershipRole(ctx.db, ctx.auth.userId, ctx.businessId);
    if (role !== 'owner' && role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin membership required' });
    }
  } else {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});
