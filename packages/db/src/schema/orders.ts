// Módulo 5 — Comandas y caja.
// Fuente de verdad: docs/DATABASE-SCHEMA.md (módulo 5).
// Las líneas de comanda son SNAPSHOTS: nombre/precio/IVA se copian en el
// momento de la venta; cambiar el producto después no altera comandas pasadas.

import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses, devices, employees } from './accounts';
import { modifiers, productVariants, products } from './catalog';
import { tables, zones } from './floor';
import { createdAt, id, inEnum, selectPolicy, tenantSelectPolicy, timestamps } from './helpers';

export const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery', 'counter'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = ['open', 'paid', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_STATUSES = [
  'pending',
  'sent',
  'preparing',
  'ready',
  'served',
  'cancelled',
] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const ORDER_ITEM_COURSES = ['starter', 'main', 'drink'] as const;
// Lista abierta: autocompleta los cursos comunes pero admite otros ('dessert'...).
// Por eso la columna course no lleva CHECK — es un hint de UI, no integridad.
export type OrderItemCourse = (typeof ORDER_ITEM_COURSES)[number] | (string & {});

export const PAYMENT_METHODS = ['cash', 'card', 'bizum', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['completed', 'voided', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CASH_SESSION_STATUSES = ['open', 'closed'] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

export const CASH_MOVEMENT_TYPES = ['pay_in', 'pay_out'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

// Sesión de caja (arqueo / cierre Z): apertura con fondo, cierre con recuento.
export const cashSessions = pgTable(
  'cash_sessions',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    deviceId: uuid('device_id').references(() => devices.id),
    openedBy: uuid('opened_by')
      .references(() => employees.id)
      .notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    openingAmountCents: integer('opening_amount_cents').notNull(), // fondo de caja
    closedBy: uuid('closed_by').references(() => employees.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    countedAmountCents: integer('counted_amount_cents'), // recuento real (puede ser ciego)
    expectedAmountCents: integer('expected_amount_cents'), // incluye los cash_movements
    differenceCents: integer('difference_cents'), // descuadre = counted − expected
    status: text('status').$type<CashSessionStatus>().default('open').notNull(),
    ...timestamps,
  },
  (t) => [
    index('cash_sessions_business_id_idx').on(t.businessId),
    check('cash_sessions_status_check', inEnum(t.status, CASH_SESSION_STATUSES)),
    tenantSelectPolicy('cash_sessions'),
  ],
);

export const orders = pgTable(
  'orders',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    // Correlativo por negocio, asignado por el servidor al sincronizar.
    // El número LEGAL es siempre invoices.number, no este.
    orderNumber: integer('order_number').notNull(),
    type: text('type').$type<OrderType>().notNull(),
    status: text('status').$type<OrderStatus>().default('open').notNull(),
    zoneId: uuid('zone_id').references(() => zones.id),
    tableId: uuid('table_id').references(() => tables.id),
    deviceId: uuid('device_id').references(() => devices.id),
    employeeId: uuid('employee_id')
      .references(() => employees.id)
      .notNull(),
    guestCount: integer('guest_count').default(1).notNull(),
    // Totales en céntimos: el cliente los pinta en optimista, pero el servidor
    // SIEMPRE los recalcula con @tpv/core antes de persistir/cobrar/facturar.
    subtotalCents: integer('subtotal_cents').default(0).notNull(),
    taxTotalCents: integer('tax_total_cents').default(0).notNull(),
    discountTotalCents: integer('discount_total_cents').default(0).notNull(),
    discountReason: text('discount_reason'), // auditado en order_events
    totalCents: integer('total_cents').default(0).notNull(),
    notes: text('notes'),
    version: integer('version').default(1).notNull(), // optimistic locking: +1 en cada update
    mergedIntoOrderId: uuid('merged_into_order_id').references((): AnyPgColumn => orders.id),
    splitFromOrderId: uuid('split_from_order_id').references((): AnyPgColumn => orders.id),
    cashSessionId: uuid('cash_session_id').references(() => cashSessions.id),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('orders_business_order_number_unique').on(t.businessId, t.orderNumber),
    // Máximo 1 comanda abierta por mesa — fuente de verdad del estado de la mesa.
    uniqueIndex('orders_open_table_unique')
      .on(t.tableId)
      .where(sql`${t.status} = 'open'`),
    index('orders_business_status_idx').on(t.businessId, t.status),
    index('orders_business_created_at_idx').on(t.businessId, t.createdAt),
    check('orders_type_check', inEnum(t.type, ORDER_TYPES)),
    check('orders_status_check', inEnum(t.status, ORDER_STATUSES)),
    tenantSelectPolicy('orders'),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    ...id,
    orderId: uuid('order_id')
      .references(() => orders.id)
      .notNull(),
    productId: uuid('product_id').references(() => products.id), // puede desaparecer el producto
    variantId: uuid('variant_id').references(() => productVariants.id),
    nameSnapshot: text('name_snapshot').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
    taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull(),
    discountCents: integer('discount_cents').default(0).notNull(), // auditado en order_events
    lineTotalCents: integer('line_total_cents').notNull(), // con modificadores y descuento
    course: text('course').$type<OrderItemCourse>(),
    notes: text('notes'), // ej. "poco hecho"
    status: text('status').$type<OrderItemStatus>().default('pending').notNull(),
    voidedReason: text('voided_reason'), // obligatorio si status='cancelled' — se valida en app
    // Anular línea ya enviada a cocina requiere rol manager+ y escribe order_events.
    voidedBy: uuid('voided_by').references(() => employees.id),
    sentToKitchenAt: timestamp('sent_to_kitchen_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .references(() => employees.id)
      .notNull(),
    ...timestamps,
  },
  (t) => [
    index('order_items_order_id_idx').on(t.orderId),
    index('order_items_order_status_idx').on(t.orderId, t.status), // KDS
    check('order_items_status_check', inEnum(t.status, ORDER_ITEM_STATUSES)),
    check('order_items_quantity_check', sql`${t.quantity} > 0`),
    // Hija sin business_id: hereda el acceso de la comanda padre.
    selectPolicy(
      'order_items',
      sql`exists (select 1 from public.orders o where o.id = order_id and public.has_business_access(o.business_id))`,
    ),
  ],
);

export const orderItemModifiers = pgTable(
  'order_item_modifiers',
  {
    ...id,
    orderItemId: uuid('order_item_id')
      .references(() => orderItems.id)
      .notNull(),
    modifierId: uuid('modifier_id').references(() => modifiers.id),
    nameSnapshot: text('name_snapshot').notNull(),
    priceDeltaCents: integer('price_delta_cents').notNull(),
    ...createdAt,
  },
  (t) => [
    index('order_item_modifiers_order_item_id_idx').on(t.orderItemId),
    // Nieta: dos saltos hasta el business_id (order_items → orders).
    selectPolicy(
      'order_item_modifiers',
      sql`exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = order_item_id and public.has_business_access(o.business_id))`,
    ),
  ],
);

// Varios pagos por comanda = pago mixto o cuenta dividida.
// Devolución = nuevo payment con importe negativo (+ rectificativa si había factura).
export const payments = pgTable(
  'payments',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    orderId: uuid('order_id')
      .references(() => orders.id)
      .notNull(),
    cashSessionId: uuid('cash_session_id').references(() => cashSessions.id),
    method: text('method').$type<PaymentMethod>().notNull(),
    amountCents: integer('amount_cents').notNull(),
    tipCents: integer('tip_cents').default(0).notNull(),
    cashReceivedCents: integer('cash_received_cents'),
    changeCents: integer('change_cents'),
    status: text('status').$type<PaymentStatus>().default('completed').notNull(),
    reference: text('reference'), // referencia del datáfono u otro sistema externo
    employeeId: uuid('employee_id')
      .references(() => employees.id)
      .notNull(),
    ...timestamps, // updated_at añadido sobre el doc: status es mutable (voided/refunded)
  },
  (t) => [
    index('payments_order_id_idx').on(t.orderId),
    index('payments_business_cash_session_idx').on(t.businessId, t.cashSessionId),
    check('payments_method_check', inEnum(t.method, PAYMENT_METHODS)),
    check('payments_status_check', inEnum(t.status, PAYMENT_STATUSES)),
    tenantSelectPolicy('payments'),
  ],
);

// Entradas/salidas de efectivo que no son ventas — append-only.
// Sin esta tabla el arqueo Z nunca cuadra.
export const cashMovements = pgTable(
  'cash_movements',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    cashSessionId: uuid('cash_session_id')
      .references(() => cashSessions.id)
      .notNull(),
    type: text('type').$type<CashMovementType>().notNull(),
    amountCents: integer('amount_cents').notNull(), // siempre positivo; type marca la dirección
    reason: text('reason').notNull(), // motivo obligatorio
    employeeId: uuid('employee_id')
      .references(() => employees.id)
      .notNull(),
    ...createdAt,
  },
  (t) => [
    index('cash_movements_business_id_idx').on(t.businessId),
    check('cash_movements_type_check', inEnum(t.type, CASH_MOVEMENT_TYPES)),
    check('cash_movements_amount_check', sql`${t.amountCents} > 0`),
    tenantSelectPolicy('cash_movements'),
  ],
);

// Auditoría de comandas — append-only. event_type es lista abierta ('created',
// 'item_added', 'item_voided', 'discount_applied', 'transferred', 'merged', 'split'...).
export const orderEvents = pgTable(
  'order_events',
  {
    ...id,
    orderId: uuid('order_id')
      .references(() => orders.id)
      .notNull(),
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    eventType: text('event_type').notNull(),
    employeeId: uuid('employee_id')
      .references(() => employees.id)
      .notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    ...createdAt,
  },
  (t) => [
    index('order_events_order_id_idx').on(t.orderId),
    index('order_events_business_id_idx').on(t.businessId),
    tenantSelectPolicy('order_events'),
  ],
);

export const cashSessionsRelations = relations(cashSessions, ({ one, many }) => ({
  business: one(businesses, { fields: [cashSessions.businessId], references: [businesses.id] }),
  device: one(devices, { fields: [cashSessions.deviceId], references: [devices.id] }),
  openedByEmployee: one(employees, {
    fields: [cashSessions.openedBy],
    references: [employees.id],
    relationName: 'cash_session_opened_by',
  }),
  closedByEmployee: one(employees, {
    fields: [cashSessions.closedBy],
    references: [employees.id],
    relationName: 'cash_session_closed_by',
  }),
  orders: many(orders),
  payments: many(payments),
  movements: many(cashMovements),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  business: one(businesses, { fields: [orders.businessId], references: [businesses.id] }),
  zone: one(zones, { fields: [orders.zoneId], references: [zones.id] }),
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  device: one(devices, { fields: [orders.deviceId], references: [devices.id] }),
  employee: one(employees, { fields: [orders.employeeId], references: [employees.id] }),
  cashSession: one(cashSessions, {
    fields: [orders.cashSessionId],
    references: [cashSessions.id],
  }),
  mergedIntoOrder: one(orders, {
    fields: [orders.mergedIntoOrderId],
    references: [orders.id],
    relationName: 'order_merged_into',
  }),
  splitFromOrder: one(orders, {
    fields: [orders.splitFromOrderId],
    references: [orders.id],
    relationName: 'order_split_from',
  }),
  items: many(orderItems),
  payments: many(payments),
  events: many(orderEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
  voidedByEmployee: one(employees, {
    fields: [orderItems.voidedBy],
    references: [employees.id],
    relationName: 'order_item_voided_by',
  }),
  createdByEmployee: one(employees, {
    fields: [orderItems.createdBy],
    references: [employees.id],
    relationName: 'order_item_created_by',
  }),
  modifiers: many(orderItemModifiers),
}));

export const orderItemModifiersRelations = relations(orderItemModifiers, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderItemModifiers.orderItemId],
    references: [orderItems.id],
  }),
  modifier: one(modifiers, {
    fields: [orderItemModifiers.modifierId],
    references: [modifiers.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  business: one(businesses, { fields: [payments.businessId], references: [businesses.id] }),
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  cashSession: one(cashSessions, {
    fields: [payments.cashSessionId],
    references: [cashSessions.id],
  }),
  employee: one(employees, { fields: [payments.employeeId], references: [employees.id] }),
}));

export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  business: one(businesses, { fields: [cashMovements.businessId], references: [businesses.id] }),
  cashSession: one(cashSessions, {
    fields: [cashMovements.cashSessionId],
    references: [cashSessions.id],
  }),
  employee: one(employees, { fields: [cashMovements.employeeId], references: [employees.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
  business: one(businesses, { fields: [orderEvents.businessId], references: [businesses.id] }),
  employee: one(employees, { fields: [orderEvents.employeeId], references: [employees.id] }),
}));
