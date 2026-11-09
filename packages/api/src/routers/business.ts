// Ajustes del negocio (hoy: cierre ciego de caja).
// businessId SIEMPRE de ctx — nunca del input. Solo manager/admin pueden leer o editar.

import { businesses, withBusinessContext } from '@tpv/db';
import { updateBusinessSettingsSchema } from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { managerProcedure } from '../procedures';
import { router } from '../trpc';

export const businessRouter = router({
  getSettings: managerProcedure.query(async ({ ctx }) => {
    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [row] = await tx
        .select({ blindCashClose: businesses.blindCashClose })
        .from(businesses)
        .where(eq(businesses.id, ctx.businessId))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Business not found' });
      return row;
    });
  }),

  // Parche campo a campo (regla CLAUDE.md §6): cada campo del schema tiene su test del SET.
  updateSettings: managerProcedure
    .input(updateBusinessSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
        const [row] = await tx
          .update(businesses)
          .set({
            ...(input.blindCashClose !== undefined && { blindCashClose: input.blindCashClose }),
            updatedAt: new Date(),
          })
          .where(eq(businesses.id, ctx.businessId))
          .returning({ blindCashClose: businesses.blindCashClose });
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Business not found' });
        return row;
      });
    }),
});
