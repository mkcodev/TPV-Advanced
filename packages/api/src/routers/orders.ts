// Router de comandas — deviceProcedure.
// Principios:
// - businessId, employeeId, deviceId SIEMPRE de ctx. NUNCA del input.
// - El input no lleva precios ni totales: el servidor los lee de products.
// - Los totales se calculan en servidor con @tpv/core.orderTaxBreakdown.
// - Idempotencia: orderId cliente-generado actúa como PK (upsert).

import { lineTotalCents, orderTaxBreakdown } from '@tpv/core';
import {
  type BusinessTransaction,
  orderEvents,
  orderItems,
  orders,
  productVariants,
  products,
  withBusinessContext,
} from '@tpv/db';
import { orderIdSchema, upsertOrderSchema } from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { deviceProcedure } from '../procedures';
import { router } from '../trpc';

// ── helpers ──────────────────────────────────────────────────────────────────

async function resolveProductSnapshot(
  tx: BusinessTransaction,
  businessId: string,
  productId: string,
  variantId: string | undefined,
): Promise<{ nameSnapshot: string; unitPriceCents: number; taxRate: number }> {
  const [prod] = await tx
    .select({
      id: products.id,
      name: products.name,
      basePriceCents: products.basePriceCents,
      taxRate: products.taxRate,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.businessId, businessId)))
    .limit(1);

  if (!prod) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Product does not belong to this business',
    });
  }

  if (!variantId) {
    return {
      nameSnapshot: prod.name,
      unitPriceCents: prod.basePriceCents,
      taxRate: Number(prod.taxRate),
    };
  }

  const [variant] = await tx
    .select({ name: productVariants.name, priceCents: productVariants.priceCents })
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .limit(1);

  if (!variant) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Variant does not belong to this product',
    });
  }

  return {
    nameSnapshot: `${prod.name} — ${variant.name}`,
    unitPriceCents: variant.priceCents,
    taxRate: Number(prod.taxRate),
  };
}

type InputLine = {
  lineId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
};

async function insertLines(
  tx: BusinessTransaction,
  orderId: string,
  businessId: string,
  employeeId: string,
  lines: InputLine[],
): Promise<void> {
  for (const line of lines) {
    const snap = await resolveProductSnapshot(tx, businessId, line.productId, line.variantId);
    const gross = lineTotalCents(snap.unitPriceCents, line.quantity);
    await tx.insert(orderItems).values({
      id: line.lineId,
      orderId,
      productId: line.productId,
      variantId: line.variantId ?? null,
      nameSnapshot: snap.nameSnapshot,
      unitPriceCents: snap.unitPriceCents,
      taxRate: String(snap.taxRate),
      quantity: line.quantity,
      lineTotalCents: gross,
      createdBy: employeeId,
      notes: line.notes ?? null,
    });
    await tx.insert(orderEvents).values({
      orderId,
      businessId,
      eventType: 'item_added',
      employeeId,
      payload: {
        lineId: line.lineId,
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
        unitPriceCents: snap.unitPriceCents,
        taxRate: snap.taxRate,
        lineTotalCents: gross,
      },
    });
  }
}

async function reconcileLines(
  tx: BusinessTransaction,
  orderId: string,
  businessId: string,
  employeeId: string,
  inputLines: InputLine[],
): Promise<void> {
  const existing = await tx
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      unitPriceCents: orderItems.unitPriceCents,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const existingMap = new Map(existing.map((e) => [e.id, e]));
  const inputIds = new Set(inputLines.map((l) => l.lineId));

  // Lines in DB but not in input → delete.
  const toDelete = existing.filter((e) => !inputIds.has(e.id));
  if (toDelete.length > 0) {
    await tx.delete(orderItems).where(
      and(
        inArray(
          orderItems.id,
          toDelete.map((e) => e.id),
        ),
        eq(orderItems.orderId, orderId),
      ),
    );
  }

  // Lines in input: update existing, insert new.
  const toInsert: InputLine[] = [];
  for (const line of inputLines) {
    const ex = existingMap.get(line.lineId);
    if (ex) {
      // Snapshot immutability: productId and variantId are frozen at line creation.
      if (ex.productId !== line.productId || ex.variantId !== (line.variantId ?? null)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Line snapshot cannot change product',
        });
      }
      const gross = lineTotalCents(ex.unitPriceCents, line.quantity);
      await tx
        .update(orderItems)
        .set({
          quantity: line.quantity,
          notes: line.notes ?? null,
          lineTotalCents: gross,
          updatedAt: new Date(),
        })
        .where(eq(orderItems.id, line.lineId));
    } else {
      toInsert.push(line);
    }
  }

  if (toInsert.length > 0) {
    await insertLines(tx, orderId, businessId, employeeId, toInsert);
  }
}

async function applyTotals(
  tx: BusinessTransaction,
  orderId: string,
  businessId: string,
): Promise<void> {
  const items = await tx
    .select({ lineTotalCents: orderItems.lineTotalCents, taxRate: orderItems.taxRate })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const breakdown = orderTaxBreakdown(
    items.map((i) => ({ grossCents: i.lineTotalCents, taxRate: Number(i.taxRate) })),
  );

  await tx
    .update(orders)
    .set({
      subtotalCents: breakdown.subtotalCents,
      taxTotalCents: breakdown.taxTotalCents,
      totalCents: breakdown.totalCents,
      version: sql`${orders.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)));
}

function mapItem(item: {
  id: string;
  productId: string | null;
  variantId: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  taxRate: string;
  quantity: number;
  lineTotalCents: number;
  notes: string | null;
}) {
  return {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    nameSnapshot: item.nameSnapshot,
    unitPriceCents: item.unitPriceCents,
    taxRate: Number(item.taxRate),
    quantity: item.quantity,
    lineTotalCents: item.lineTotalCents,
    notes: item.notes,
  };
}

// ── router ────────────────────────────────────────────────────────────────────

export const ordersRouter = router({
  upsert: deviceProcedure.input(upsertOrderSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const employeeId = ctx.employeeId;

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [existing] = await tx
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
        .limit(1);

      if (!existing) {
        // INSERT path: advisory lock → next order_number → insert order + lines + events.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.businessId}))`);

        const [numRow] = await tx
          .select({ next: sql<number>`COALESCE(MAX(${orders.orderNumber}), 0) + 1` })
          .from(orders)
          .where(eq(orders.businessId, ctx.businessId));
        const nextNum = numRow?.next ?? 1;

        await tx.insert(orders).values({
          id: input.orderId,
          businessId: ctx.businessId,
          orderNumber: nextNum,
          type: input.type,
          employeeId,
          deviceId: ctx.deviceId ?? null,
          notes: input.notes ?? null,
        });

        await tx.insert(orderEvents).values({
          orderId: input.orderId,
          businessId: ctx.businessId,
          eventType: 'created',
          employeeId,
          payload: { orderNumber: nextNum, itemCount: input.lines.length },
        });

        await insertLines(tx, input.orderId, ctx.businessId, employeeId, input.lines);
      } else {
        // UPDATE path: reconcile lines, then update header.
        if (existing.status !== 'open') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order is not open' });
        }
        await reconcileLines(tx, input.orderId, ctx.businessId, employeeId, input.lines);
        await tx
          .update(orders)
          .set({ notes: input.notes ?? null, updatedAt: new Date() })
          .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)));
      }

      await applyTotals(tx, input.orderId, ctx.businessId);

      const [finalOrder] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          subtotalCents: orders.subtotalCents,
          taxTotalCents: orders.taxTotalCents,
          totalCents: orders.totalCents,
          version: orders.version,
        })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
        .limit(1);

      if (!finalOrder) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const finalItems = await tx
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          variantId: orderItems.variantId,
          nameSnapshot: orderItems.nameSnapshot,
          unitPriceCents: orderItems.unitPriceCents,
          taxRate: orderItems.taxRate,
          quantity: orderItems.quantity,
          lineTotalCents: orderItems.lineTotalCents,
          notes: orderItems.notes,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      return { ...finalOrder, lines: finalItems.map(mapItem) };
    });
  }),

  getById: deviceProcedure.input(orderIdSchema).query(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }

    const [order] = await ctx.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        subtotalCents: orders.subtotalCents,
        taxTotalCents: orders.taxTotalCents,
        totalCents: orders.totalCents,
        version: orders.version,
      })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
      .limit(1);

    if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

    const items = await ctx.db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        nameSnapshot: orderItems.nameSnapshot,
        unitPriceCents: orderItems.unitPriceCents,
        taxRate: orderItems.taxRate,
        quantity: orderItems.quantity,
        lineTotalCents: orderItems.lineTotalCents,
        notes: orderItems.notes,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, input.orderId));

    return { ...order, lines: items.map(mapItem) };
  }),
});
