// Router de sala y mesas — zonesRouter + tablesRouter.
// PATRÓN multi-tenant: businessId SIEMPRE de ctx.businessId, NUNCA del input.
// Reads (list): businessProcedure. Writes (create/update/setActive): managerProcedure.
// listWithOpenOrders: deviceProcedure (usado desde el TPV).

import { orders, tables, zones } from '@tpv/db';
import type { Database } from '@tpv/db';
import {
  createTableSchema,
  createZoneSchema,
  idOnlySchema,
  listByZoneSchema,
  listTablesWithOrdersSchema,
  reorderSchema,
  setActiveSchema,
  updateTableSchema,
  updateZoneSchema,
} from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { deviceProcedure, managerProcedure } from '../procedures';
import { businessProcedure, router } from '../trpc';

// Asserts a zone belongs to the business. Throws BAD_REQUEST if not.
async function assertZoneOwnership(
  db: Database,
  businessId: string,
  zoneId: string,
): Promise<void> {
  const [zone] = await db
    .select({ id: zones.id })
    .from(zones)
    .where(and(eq(zones.id, zoneId), eq(zones.businessId, businessId), eq(zones.isActive, true)))
    .limit(1);
  if (!zone) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Zone does not belong to this business' });
  }
}

// ──────────────────────────────── zones ──────────────────────────────────────

const listZonesSchema = z.object({ includeInactive: z.boolean().optional() }).strict();

const zonesRouter = router({
  list: businessProcedure.input(listZonesSchema).query(async ({ ctx, input }) =>
    ctx.db
      .select()
      .from(zones)
      .where(
        and(
          eq(zones.businessId, ctx.businessId),
          input.includeInactive ? undefined : eq(zones.isActive, true),
        ),
      ),
  ),

  getById: businessProcedure.input(idOnlySchema).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(zones)
      .where(and(eq(zones.id, input.id), eq(zones.businessId, ctx.businessId)))
      .limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  create: managerProcedure.input(createZoneSchema).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .insert(zones)
      .values({ ...input, businessId: ctx.businessId })
      .returning();
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return row;
  }),

  update: managerProcedure.input(updateZoneSchema).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    const setPatch = {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.displayOrder !== undefined && { displayOrder: patch.displayOrder }),
      ...(patch.backgroundUrl !== undefined && { backgroundUrl: patch.backgroundUrl }),
    };
    const [row] = await ctx.db
      .update(zones)
      .set(setPatch)
      .where(and(eq(zones.id, id), eq(zones.businessId, ctx.businessId)))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  setActive: managerProcedure.input(setActiveSchema).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .update(zones)
      .set({ isActive: input.isActive })
      .where(and(eq(zones.id, input.id), eq(zones.businessId, ctx.businessId)))
      .returning({ id: zones.id });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return { id: row.id, isActive: input.isActive };
  }),

  reorder: managerProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    await Promise.all(
      input.items.map(({ id, displayOrder }) =>
        ctx.db
          .update(zones)
          .set({ displayOrder })
          .where(and(eq(zones.id, id), eq(zones.businessId, ctx.businessId))),
      ),
    );
    return { ok: true };
  }),
});

// ──────────────────────────────── tables ─────────────────────────────────────

const tablesRouter = router({
  listByZone: businessProcedure.input(listByZoneSchema).query(async ({ ctx, input }) => {
    await assertZoneOwnership(ctx.db, ctx.businessId, input.zoneId);
    return ctx.db
      .select()
      .from(tables)
      .where(
        and(
          eq(tables.businessId, ctx.businessId),
          eq(tables.zoneId, input.zoneId),
          input.includeInactive ? undefined : eq(tables.isActive, true),
        ),
      );
  }),

  // Used by the TPV floor view. Returns active tables with open order id (null = free).
  // Ignores tables.status cache — queries orders directly for accuracy.
  listWithOpenOrders: deviceProcedure
    .input(listTablesWithOrdersSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: tables.id,
          zoneId: tables.zoneId,
          name: tables.name,
          posX: tables.posX,
          posY: tables.posY,
          width: tables.width,
          height: tables.height,
          shape: tables.shape,
          seats: tables.seats,
          openOrderId: orders.id,
        })
        .from(tables)
        .leftJoin(
          orders,
          and(
            eq(orders.tableId, tables.id),
            eq(orders.status, 'open'),
            eq(orders.businessId, ctx.businessId),
          ),
        )
        .where(
          and(
            eq(tables.businessId, ctx.businessId),
            eq(tables.isActive, true),
            input.zoneId !== undefined ? eq(tables.zoneId, input.zoneId) : undefined,
          ),
        );
      return rows;
    }),

  getById: businessProcedure.input(idOnlySchema).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(tables)
      .where(and(eq(tables.id, input.id), eq(tables.businessId, ctx.businessId)))
      .limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  create: managerProcedure.input(createTableSchema).mutation(async ({ ctx, input }) => {
    await assertZoneOwnership(ctx.db, ctx.businessId, input.zoneId);
    const [row] = await ctx.db
      .insert(tables)
      .values({ ...input, businessId: ctx.businessId })
      .returning();
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return row;
  }),

  update: managerProcedure.input(updateTableSchema).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    if (patch.zoneId !== undefined) {
      await assertZoneOwnership(ctx.db, ctx.businessId, patch.zoneId);
    }
    const setPatch = {
      ...(patch.zoneId !== undefined && { zoneId: patch.zoneId }),
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.posX !== undefined && { posX: patch.posX }),
      ...(patch.posY !== undefined && { posY: patch.posY }),
      ...(patch.width !== undefined && { width: patch.width }),
      ...(patch.height !== undefined && { height: patch.height }),
      ...(patch.shape !== undefined && { shape: patch.shape }),
      ...(patch.seats !== undefined && { seats: patch.seats }),
      updatedAt: new Date(),
    };
    const [row] = await ctx.db
      .update(tables)
      .set(setPatch)
      .where(and(eq(tables.id, id), eq(tables.businessId, ctx.businessId)))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  setActive: managerProcedure.input(setActiveSchema).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .update(tables)
      .set({ isActive: input.isActive })
      .where(and(eq(tables.id, input.id), eq(tables.businessId, ctx.businessId)))
      .returning({ id: tables.id });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return { id: row.id, isActive: input.isActive };
  }),
});

// ─────────────────────────────── root export ────────────────────────────────

export const floorRouter = router({
  zones: zonesRouter,
  tables: tablesRouter,
});
