// Router de comandas — deviceProcedure.
// Principios:
// - businessId, employeeId, deviceId SIEMPRE de ctx. NUNCA del input.
// - El input no lleva precios ni totales: el servidor los lee de products.
// - Los totales se calculan en servidor con @tpv/core.orderTaxBreakdown.
// - Idempotencia: orderId cliente-generado actúa como PK (upsert).
// ⚖️ Verificar spec AEAT vigente antes de producción real.

import {
  calculateChangeCents,
  lineTotalCents,
  orderTaxBreakdown,
  summarizePayments,
} from '@tpv/core';
import {
  type BusinessTransaction,
  businesses,
  invoiceTaxLines,
  invoices,
  orderEvents,
  orderItems,
  orders,
  payments,
  productCategories,
  productVariants,
  products,
  tables,
  withBusinessContext,
} from '@tpv/db';
import {
  markLinesSentSchema,
  orderIdSchema,
  payOrderSchema,
  tableIdSchema,
  upsertOrderSchema,
} from '@tpv/validators';
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

        // Resolve tableId ownership and derive zoneId.
        let resolvedTableId: string | null = null;
        let resolvedZoneId: string | null = null;
        if (input.tableId) {
          const [tableRow] = await tx
            .select({ id: tables.id, zoneId: tables.zoneId })
            .from(tables)
            .where(
              and(
                eq(tables.id, input.tableId),
                eq(tables.businessId, ctx.businessId),
                eq(tables.isActive, true),
              ),
            )
            .limit(1);
          if (!tableRow) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Table not found' });
          }
          resolvedTableId = tableRow.id;
          resolvedZoneId = tableRow.zoneId;
        }

        try {
          await tx.insert(orders).values({
            id: input.orderId,
            businessId: ctx.businessId,
            orderNumber: nextNum,
            type: input.type,
            tableId: resolvedTableId,
            zoneId: resolvedZoneId,
            employeeId,
            deviceId: ctx.deviceId ?? null,
            notes: input.notes ?? null,
          });
        } catch (e) {
          // Unique index orders_open_table_unique fires when the table already has an open order.
          if ((e as { code?: string }).code === '23505') {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Table already has an open order',
            });
          }
          throw e;
        }

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

  pay: deviceProcedure.input(payOrderSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const employeeId = ctx.employeeId;

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      // Lock the order row to prevent concurrent payments.
      const [order] = await tx
        .select({
          id: orders.id,
          status: orders.status,
          totalCents: orders.totalCents,
          orderNumber: orders.orderNumber,
          version: orders.version,
        })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
        .for('update');

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }
      if (order.status === 'paid') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order already paid' });
      }
      if (order.status === 'cancelled') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order is cancelled' });
      }

      // Recalculate total from items (defensive — server is authoritative).
      const items = await tx
        .select({ lineTotalCents: orderItems.lineTotalCents, taxRate: orderItems.taxRate })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const breakdown = orderTaxBreakdown(
        items.map((i) => ({ grossCents: i.lineTotalCents, taxRate: Number(i.taxRate) })),
      );
      const totalCents = breakdown.totalCents;

      if (totalCents !== order.totalCents) {
        console.error(
          `[orders.pay] total drift: persisted=${order.totalCents} recalculated=${totalCents} orderId=${order.id}`,
        );
      }

      // Validate payment sum against authoritative total.
      const summary = summarizePayments(input.payments);
      if (summary.totalPaidCents > totalCents) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Payment exceeds order total. Use cashReceivedCents for cash change, not amountCents.',
        });
      }

      const isFullyPaid = summary.totalPaidCents === totalCents;
      const remainingCents = totalCents - summary.totalPaidCents;

      // Insert one payment row per method.
      const inserted = await tx
        .insert(payments)
        .values(
          input.payments.map((p) => ({
            businessId: ctx.businessId,
            orderId: order.id,
            cashSessionId: null, // linked in task 1.11
            method: p.method,
            amountCents: p.amountCents,
            tipCents: p.tipCents ?? 0,
            cashReceivedCents: p.method === 'cash' ? (p.cashReceivedCents ?? null) : null,
            changeCents:
              p.method === 'cash' && p.cashReceivedCents !== undefined
                ? calculateChangeCents(p.amountCents, p.cashReceivedCents)
                : null,
            reference: p.reference ?? null,
            employeeId,
          })),
        )
        .returning({ id: payments.id });

      // Close the order when fully paid.
      let invoiceId: string | null = null;
      let invoiceSeries: string | null = null;
      let invoiceNumber: number | null = null;

      if (isFullyPaid) {
        const updated = await tx
          .update(orders)
          .set({
            status: 'paid',
            closedAt: sql`now()`,
            version: sql`${orders.version} + 1`,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, order.id), eq(orders.version, order.version)));

        // If rowsAffected is 0, a concurrent write changed version — conflict.
        if ((updated as unknown as { rowCount?: number }).rowCount === 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Order was modified concurrently. Please retry.',
          });
        }

        // ⚖️ Verificar spec AEAT vigente antes de producción real.
        // Generar factura simplificada atómica dentro de la misma transacción.
        // ctx.deviceId es siempre string aquí: deviceProcedure garantiza auth.kind === 'device'
        // y AuthContext.deviceId es string no-nullable para ese kind.
        const deviceIdForInvoice = ctx.deviceId as string;

        const now = new Date();
        // Serie incluye el año — el contador reinicia automáticamente en año nuevo.
        const series = `A${now.getUTCFullYear()}`;

        // Lock por (business, serie) — serializa cobros simultáneos del mismo negocio y año.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.businessId} || ':invoice:' || ${series}))`,
        );

        const [numRow] = await tx
          .select({ next: sql<number>`COALESCE(MAX(${invoices.number}), 0) + 1` })
          .from(invoices)
          .where(and(eq(invoices.businessId, ctx.businessId), eq(invoices.series, series)));
        const nextInvoiceNumber = numRow?.next ?? 1;

        const [invoiceRow] = await tx
          .insert(invoices)
          .values({
            businessId: ctx.businessId,
            orderId: order.id,
            invoiceType: 'simplified',
            series,
            number: nextInvoiceNumber,
            issueDate: now,
            subtotalCents: breakdown.subtotalCents,
            taxTotalCents: breakdown.taxTotalCents,
            totalCents: breakdown.totalCents,
            deviceId: deviceIdForInvoice,
            employeeId,
          })
          .returning({ id: invoices.id });

        if (invoiceRow && breakdown.buckets.length > 0) {
          await tx.insert(invoiceTaxLines).values(
            breakdown.buckets.map((b) => ({
              invoiceId: invoiceRow.id,
              taxRate: String(b.taxRate),
              baseCents: b.baseCents,
              taxCents: b.taxCents,
            })),
          );
        }

        invoiceId = invoiceRow?.id ?? null;
        invoiceSeries = series;
        invoiceNumber = nextInvoiceNumber;
      }

      await tx.insert(orderEvents).values({
        orderId: order.id,
        businessId: ctx.businessId,
        eventType: isFullyPaid ? 'paid' : 'payment_recorded',
        employeeId,
        payload: {
          paymentIds: inserted.map((r) => r.id),
          totalCents,
          paidCents: summary.totalPaidCents,
          tipCents: summary.totalTipCents,
          remainingCents,
          methods: input.payments.map((p) => p.method),
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: isFullyPaid ? ('paid' as const) : ('open' as const),
        totalCents,
        paidCents: summary.totalPaidCents,
        remainingCents,
        tipCents: summary.totalTipCents,
        changeCents: summary.totalChangeCents,
        invoiceId,
        invoiceSeries,
        invoiceNumber,
      };
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
        tableId: orders.tableId,
        zoneId: orders.zoneId,
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

  getByTable: deviceProcedure.input(tableIdSchema).query(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [order] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          tableId: orders.tableId,
          zoneId: orders.zoneId,
          subtotalCents: orders.subtotalCents,
          taxTotalCents: orders.taxTotalCents,
          totalCents: orders.totalCents,
          version: orders.version,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tableId, input.tableId),
            eq(orders.businessId, ctx.businessId),
            eq(orders.status, 'open'),
          ),
        )
        .limit(1);

      if (!order) return null;

      const items = await tx
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
        .where(eq(orderItems.orderId, order.id));

      return { ...order, lines: items.map(mapItem) };
    });
  }),

  // ── invoice ─────────────────────────────────────────────────────────────────

  // ⚖️ Verificar spec AEAT vigente antes de producción real.
  getInvoice: deviceProcedure.input(orderIdSchema).query(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.orderId, input.orderId), eq(invoices.businessId, ctx.businessId)))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND' });

      const taxLines = await tx
        .select()
        .from(invoiceTaxLines)
        .where(eq(invoiceTaxLines.invoiceId, invoice.id));

      const [order] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          tableId: orders.tableId,
          zoneId: orders.zoneId,
        })
        .from(orders)
        .where(eq(orders.id, invoice.orderId))
        .limit(1);

      const items = await tx
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
        .where(eq(orderItems.orderId, invoice.orderId));

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

      return {
        invoice,
        taxLines: taxLines.map((tl) => ({
          ...tl,
          taxRate: Number(tl.taxRate),
        })),
        order,
        items: items.map(mapItem),
        business: business ?? null,
      };
    });
  }),

  // ── kitchen ──────────────────────────────────────────────────────────────────

  markLinesSent: deviceProcedure.input(markLinesSentSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const employeeId = ctx.employeeId;

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [order] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
        .limit(1);
      if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

      await tx.insert(orderEvents).values({
        orderId: order.id,
        businessId: ctx.businessId,
        eventType: 'kitchen_sent',
        employeeId,
        payload: { itemIds: input.itemIds },
      });

      return { ok: true };
    });
  }),

  getKitchenPayload: deviceProcedure.input(orderIdSchema).query(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, orderNumber: orders.orderNumber, tableId: orders.tableId })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
        .limit(1);
      if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

      const rows = await tx
        .select({
          id: orderItems.id,
          nameSnapshot: orderItems.nameSnapshot,
          quantity: orderItems.quantity,
          notes: orderItems.notes,
          printDestination: productCategories.printDestination,
        })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
        .where(eq(orderItems.orderId, order.id));

      const sentEvents = await tx
        .select({ payload: orderEvents.payload })
        .from(orderEvents)
        .where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.eventType, 'kitchen_sent')));

      const sentIds = new Set<string>();
      for (const e of sentEvents) {
        const ids = (e.payload as { itemIds?: string[] } | null)?.itemIds ?? [];
        for (const id of ids) sentIds.add(id);
      }

      return {
        order,
        groups: {
          kitchen: rows.filter((r) => r.printDestination === 'kitchen'),
          bar: rows.filter((r) => r.printDestination === 'bar'),
        },
        pendingItemIds: rows
          .filter((r) => r.printDestination !== 'none' && !sentIds.has(r.id))
          .map((r) => r.id),
      };
    });
  }),
});
