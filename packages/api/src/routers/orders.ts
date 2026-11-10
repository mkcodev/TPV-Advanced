// Router de comandas — deviceProcedure.
// Principios:
// - businessId, employeeId, deviceId SIEMPRE de ctx. NUNCA del input.
// - El input no lleva precios ni totales: el servidor los lee de products.
// - Los totales se calculan en servidor con @tpv/core.orderTaxBreakdown.
// - Idempotencia: orderId cliente-generado actúa como PK (upsert).
// ⚖️ Verificar spec AEAT vigente antes de producción real.

import {
  applyPinSuccess,
  calculateChangeCents,
  isManagerOrAbove,
  lineTotalCents,
  orderTaxBreakdown,
  summarizePayments,
} from '@tpv/core';
import {
  type BusinessTransaction,
  businesses,
  cashSessions,
  employees,
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
  voidLineSchema,
} from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { verifyEmployeePin } from '../auth/verify-employee-pin';
import { deviceProcedure, getEmployeeRole } from '../procedures';
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

// Una línea queda FIJADA en cuanto existe en BD (guardada = 'pending', o enviada = 'sent'...),
// tenga o no destino de impresión. Ya no se puede quitar ni bajar desde el upsert: solo con
// orders.voidLine (motivo + PIN de encargado). Así las cañas de barra, que nunca "se envían",
// tampoco se pueden borrar sin control.
// Códigos de error que el cliente reconoce para explicar el rechazo.
export const LINE_LOCKED_MESSAGE = 'LINE_LOCKED_USE_VOID';
export const LINE_SENT_NO_GROW_MESSAGE = 'LINE_SENT_CANNOT_GROW';

// Devuelve true si la comanda "creció": hay líneas nuevas o alguna cantidad sube.
// Solo crecer anula el "pedir cuenta".
async function reconcileLines(
  tx: BusinessTransaction,
  orderId: string,
  businessId: string,
  employeeId: string,
  inputLines: InputLine[],
): Promise<boolean> {
  const existing = await tx
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      unitPriceCents: orderItems.unitPriceCents,
      quantity: orderItems.quantity,
      status: orderItems.status,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const existingMap = new Map(existing.map((e) => [e.id, e]));
  const inputMap = new Map(inputLines.map((l) => [l.lineId, l]));

  // 1) Validar TODO antes de escribir nada: si una regla falla, no se toca la BD.
  for (const ex of existing) {
    // Las anuladas son auditoría: se ignoran venga o no en el input.
    if (ex.status === 'cancelled') continue;
    const line = inputMap.get(ex.id);
    if (!line) {
      throw new TRPCError({ code: 'FORBIDDEN', message: LINE_LOCKED_MESSAGE });
    }
    // Snapshot immutability: productId and variantId are frozen at line creation.
    if (ex.productId !== line.productId || ex.variantId !== (line.variantId ?? null)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Line snapshot cannot change product',
      });
    }
    if (line.quantity < ex.quantity) {
      throw new TRPCError({ code: 'FORBIDDEN', message: LINE_LOCKED_MESSAGE });
    }
    // Lo ya enviado a cocina no crece: lo añadido va en una línea nueva.
    if (ex.status !== 'pending' && line.quantity > ex.quantity) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: LINE_SENT_NO_GROW_MESSAGE });
    }
  }

  // 2) Escribir: actualizar las 'pending' existentes e insertar las nuevas.
  const toInsert: InputLine[] = [];
  let grew = false;
  for (const line of inputLines) {
    const ex = existingMap.get(line.lineId);
    if (ex) {
      // Anuladas y ya enviadas: nada que actualizar (la validación ya garantizó que no cambian).
      if (ex.status !== 'pending') continue;
      if (line.quantity > ex.quantity) grew = true;
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
    grew = true;
  }
  return grew;
}

async function applyTotals(
  tx: BusinessTransaction,
  orderId: string,
  businessId: string,
): Promise<void> {
  // Las líneas anuladas no cuentan: se conservan solo como auditoría.
  const items = await tx
    .select({ lineTotalCents: orderItems.lineTotalCents, taxRate: orderItems.taxRate })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, 'cancelled')));

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

// Columnas de línea que se devuelven al cliente (una sola definición para todos los endpoints).
const itemColumns = {
  id: orderItems.id,
  productId: orderItems.productId,
  variantId: orderItems.variantId,
  nameSnapshot: orderItems.nameSnapshot,
  unitPriceCents: orderItems.unitPriceCents,
  taxRate: orderItems.taxRate,
  quantity: orderItems.quantity,
  lineTotalCents: orderItems.lineTotalCents,
  notes: orderItems.notes,
  status: orderItems.status,
  voidedReason: orderItems.voidedReason,
};

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
  status: string;
  voidedReason: string | null;
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
    status: item.status,
    voidedReason: item.voidedReason,
  };
}

// Respuesta común de upsert y voidLine: cabecera + TODAS las líneas (también las anuladas,
// para que el cliente las pinte tachadas). Usa el mismo tx, así ve lo recién escrito.
async function loadOrderResponse(tx: BusinessTransaction, orderId: string, businessId: string) {
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
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)))
    .limit(1);

  if (!finalOrder) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

  const finalItems = await tx
    .select(itemColumns)
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  return { ...finalOrder, lines: finalItems.map(mapItem) };
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
        const grew = await reconcileLines(
          tx,
          input.orderId,
          ctx.businessId,
          employeeId,
          input.lines,
        );
        await tx
          .update(orders)
          .set({
            notes: input.notes ?? null,
            updatedAt: new Date(),
            // Añadir líneas o subir cantidades anula "pedir cuenta": la mesa vuelve a "ocupada".
            ...(grew && { billRequestedAt: null }),
          })
          .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)));
      }

      await applyTotals(tx, input.orderId, ctx.businessId);

      return loadOrderResponse(tx, input.orderId, ctx.businessId);
    });
  }),

  // Anular una línea YA GUARDADA (pending o sent). La pide cualquier empleado logueado, pero la
  // autoriza un encargado: o es el propio solicitante (manager/admin) o aporta el PIN de uno.
  // Queda en order_events quién la pidió, quién la autorizó y el motivo. La fila nunca se borra.
  voidLine: deviceProcedure.input(voidLineSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const requesterId = ctx.employeeId;

    const requesterRole = await getEmployeeRole(ctx.db, requesterId, ctx.businessId);
    if (!requesterRole) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }

    // El aprobador se resuelve ANTES de abrir la transacción: si el PIN falla se escribe el
    // contador de intentos/bloqueo, y ese UPDATE no debe revertirse con el error.
    let approverId: string;
    if (isManagerOrAbove(requesterRole)) {
      approverId = requesterId;
    } else {
      if (!input.approverEmployeeId || !input.approverPin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Manager approval required' });
      }
      const approver = await verifyEmployeePin(ctx.db, {
        businessId: ctx.businessId,
        deviceId: ctx.deviceId,
        ip: ctx.ip,
        employeeId: input.approverEmployeeId,
        pin: input.approverPin,
      });
      if (!isManagerOrAbove(approver.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Approver must be manager or above' });
      }
      await ctx.db.update(employees).set(applyPinSuccess()).where(eq(employees.id, approver.id));
      approverId = approver.id;
    }

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      // Bloqueo de la fila: evita carreras con un cobro o un upsert simultáneo.
      const [order] = await tx
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
        .for('update');
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      if (order.status !== 'open') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Order is not open' });
      }

      const [line] = await tx
        .select({
          id: orderItems.id,
          status: orderItems.status,
          nameSnapshot: orderItems.nameSnapshot,
          quantity: orderItems.quantity,
          lineTotalCents: orderItems.lineTotalCents,
        })
        .from(orderItems)
        .where(and(eq(orderItems.id, input.lineId), eq(orderItems.orderId, order.id)))
        .limit(1);
      if (!line) throw new TRPCError({ code: 'NOT_FOUND', message: 'Line not found' });
      if (line.status === 'cancelled') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Line already voided' });
      }

      await tx
        .update(orderItems)
        .set({
          status: 'cancelled',
          voidedReason: input.reason,
          voidedBy: approverId,
          updatedAt: new Date(),
        })
        .where(and(eq(orderItems.id, line.id), eq(orderItems.orderId, order.id)));

      await tx.insert(orderEvents).values({
        orderId: order.id,
        businessId: ctx.businessId,
        eventType: 'item_voided',
        employeeId: requesterId, // quien lo pide; el aprobador va en el payload
        payload: {
          lineId: line.id,
          reason: input.reason,
          approvedBy: approverId,
          nameSnapshot: line.nameSnapshot,
          quantity: line.quantity,
          lineTotalCents: line.lineTotalCents,
          wasSent: line.status !== 'pending',
        },
      });

      await applyTotals(tx, order.id, ctx.businessId);

      return loadOrderResponse(tx, order.id, ctx.businessId);
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
        .where(and(eq(orderItems.orderId, order.id), ne(orderItems.status, 'cancelled')));

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

      // Resolve the open cash session for this device (if any).
      const [openSession] = await tx
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

      // Cash payments require an open session (card/bizum are allowed without one).
      const hasCash = input.payments.some((p) => p.method === 'cash');
      if (hasCash && !openSession) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Open cash session required to accept cash payments',
        });
      }

      const cashSessionId = openSession?.id ?? null;

      // Insert one payment row per method.
      const inserted = await tx
        .insert(payments)
        .values(
          input.payments.map((p) => ({
            businessId: ctx.businessId,
            orderId: order.id,
            cashSessionId,
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

  // "Pedir cuenta": marca la comanda abierta como pendiente de cobro (bill_requested_at).
  // Idempotente: si ya estaba pedida conserva la primera hora y no repite el evento.
  // El negocio sale de ctx; el orderId se busca siempre acotado a él.
  requestBill: deviceProcedure.input(orderIdSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.employeeId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee login required' });
    }
    const employeeId = ctx.employeeId;

    return withBusinessContext(ctx.db, ctx.businessId, async (tx) => {
      // Bloqueo de la fila: evita carreras con un upsert/pago simultáneo.
      const [order] = await tx
        .select({
          id: orders.id,
          status: orders.status,
          billRequestedAt: orders.billRequestedAt,
        })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.businessId, ctx.businessId)))
        .for('update');

      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      if (order.status !== 'open') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Order is not open' });
      }

      const [countRow] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, order.id), ne(orderItems.status, 'cancelled')));
      if ((countRow?.n ?? 0) === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot request the bill on an order without lines',
        });
      }

      const [updated] = await tx
        .update(orders)
        .set({
          billRequestedAt: sql`COALESCE(${orders.billRequestedAt}, now())`,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), eq(orders.businessId, ctx.businessId)))
        .returning({ billRequestedAt: orders.billRequestedAt });

      if (order.billRequestedAt === null) {
        await tx.insert(orderEvents).values({
          orderId: order.id,
          businessId: ctx.businessId,
          eventType: 'bill_requested',
          employeeId,
          payload: {},
        });
      }

      return { orderId: order.id, billRequestedAt: updated?.billRequestedAt ?? null };
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
      .select(itemColumns)
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
        .select(itemColumns)
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

      // El ticket no incluye las líneas anuladas.
      const items = await tx
        .select(itemColumns)
        .from(orderItems)
        .where(and(eq(orderItems.orderId, invoice.orderId), ne(orderItems.status, 'cancelled')));

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

      // Solo pasan a 'sent' las líneas 'pending' de ESTA comanda (el id suelto de otra comanda
      // o una ya anulada no cambian). returning() dice cuáles se marcaron de verdad.
      const marked = await tx
        .update(orderItems)
        .set({ status: 'sent', sentToKitchenAt: sql`now()`, updatedAt: new Date() })
        .where(
          and(
            inArray(orderItems.id, input.itemIds),
            eq(orderItems.orderId, order.id),
            eq(orderItems.status, 'pending'),
          ),
        )
        .returning({ id: orderItems.id });

      await tx.insert(orderEvents).values({
        orderId: order.id,
        businessId: ctx.businessId,
        eventType: 'kitchen_sent',
        employeeId,
        payload: { itemIds: marked.map((m) => m.id) },
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
          status: orderItems.status,
          printDestination: productCategories.printDestination,
        })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
        .where(and(eq(orderItems.orderId, order.id), ne(orderItems.status, 'cancelled')));

      // "Pendiente de enviar" = status 'pending' con destino de impresión. Lo que va a 'none'
      // (p. ej. una caña de barra) queda fijado al guardar pero nunca se envía.
      return {
        order,
        groups: {
          kitchen: rows.filter((r) => r.printDestination === 'kitchen'),
          bar: rows.filter((r) => r.printDestination === 'bar'),
        },
        pendingItemIds: rows
          .filter((r) => r.printDestination !== 'none' && r.status === 'pending')
          .map((r) => r.id),
      };
    });
  }),
});
