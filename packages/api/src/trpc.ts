import { TRPCError, initTRPC } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

// Endpoints sin auth (salud, carta pública...).
export const publicProcedure = t.procedure;

// REGLA DE ORO: business_id JAMÁS es input de un endpoint — siempre sale del
// contexto de auth. Este middleware es la defensa PRIMARIA multi-tenant: toda
// consulta de dominio se construye sobre ctx.businessId, nunca sobre el cliente.
export const businessProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.auth.kind === 'anonymous') {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.auth.businessId === null) {
    // Admin autenticado pero sin negocio activo elegido todavía.
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No active business selected' });
  }
  return next({
    ctx: {
      ...ctx,
      businessId: ctx.auth.businessId,
      userId: ctx.auth.kind === 'admin' ? ctx.auth.userId : null,
      deviceId: ctx.auth.kind === 'device' ? ctx.auth.deviceId : null,
      employeeId: ctx.auth.kind === 'device' ? ctx.auth.employeeId : null,
    },
  });
});
