// Módulo 6 — Facturación legal Veri*factu (RD 1007/2023).
// Fuente de verdad: docs/DATABASE-SCHEMA.md (módulo 6).
// ⚖️ ZONA CRÍTICA LEGAL: todas las tablas de este módulo son APPEND-ONLY —
// nunca UPDATE/DELETE. La inmutabilidad se refuerza en app/RLS/triggers en
// fases posteriores. Formatos de hash/QR: SOLO según la spec oficial AEAT.

import { relations } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses, customers, devices, employees } from './accounts';
import { createdAt, id, inEnum } from './helpers';
import { orders } from './orders';

export const INVOICE_TYPES = ['simplified', 'complete', 'rectificative'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const BILLING_RECORD_TYPES = ['registration', 'cancellation'] as const;
export type BillingRecordType = (typeof BILLING_RECORD_TYPES)[number];

export const AEAT_STATUSES = ['pending', 'sent', 'accepted', 'rejected'] as const;
export type AeatStatus = (typeof AEAT_STATUSES)[number];

export const invoices = pgTable(
  'invoices',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    orderId: uuid('order_id')
      .references(() => orders.id)
      .notNull(),
    invoiceType: text('invoice_type').$type<InvoiceType>().notNull(),
    rectifiedInvoiceId: uuid('rectified_invoice_id').references((): AnyPgColumn => invoices.id),
    // Mapeo a tipos R1–R5 de la AEAT: verificar con gestor antes de implementar.
    rectificationReason: text('rectification_reason'),
    customerId: uuid('customer_id').references(() => customers.id),
    series: text('series').notNull(), // incluye el año, ej. 'A2027'
    number: integer('number').notNull(), // correlativo por serie SIN huecos — generación atómica
    issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
    // Snapshot fiscal del cliente al emitir: esta es la verdad legal, no customers.
    customerTaxId: text('customer_tax_id'),
    customerName: text('customer_name'),
    customerAddress: text('customer_address'),
    subtotalCents: integer('subtotal_cents').notNull(), // base imponible total
    taxTotalCents: integer('tax_total_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    deviceId: uuid('device_id')
      .references(() => devices.id)
      .notNull(),
    employeeId: uuid('employee_id')
      .references(() => employees.id)
      .notNull(),
    ...createdAt,
  },
  (t) => [
    unique('invoices_business_series_number_unique').on(t.businessId, t.series, t.number),
    index('invoices_business_issue_date_idx').on(t.businessId, t.issueDate),
    check('invoices_invoice_type_check', inEnum(t.invoiceType, INVOICE_TYPES)),
  ],
);

// Desglose de IVA: una línea por cada tipo aplicado (obligatorio).
export const invoiceTaxLines = pgTable(
  'invoice_tax_lines',
  {
    ...id,
    invoiceId: uuid('invoice_id')
      .references(() => invoices.id)
      .notNull(),
    taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull(),
    baseCents: integer('base_cents').notNull(),
    taxCents: integer('tax_cents').notNull(),
    ...createdAt,
  },
  (t) => [index('invoice_tax_lines_invoice_id_idx').on(t.invoiceId)],
);

// EL CORAZÓN LEGAL: un registro por factura, encadenado por hash con el anterior.
// Solo el nodo emisor designado del negocio escribe aquí (cadena lineal, sin forks).
// Para "corregir": nuevo registro 'cancellation' + nuevo registro de alta.
export const billingRecords = pgTable(
  'billing_records',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    invoiceId: uuid('invoice_id')
      .references(() => invoices.id)
      .notNull(),
    recordType: text('record_type').$type<BillingRecordType>().notNull(),
    // bigint en modo number: seguro hasta 2^53 registros y simplifica el TS.
    sequenceNumber: bigint('sequence_number', { mode: 'number' }).notNull(),
    // Serialización EXACTA del registro según spec AEAT; el hash se calcula
    // sobre esto. Sin este campo la cadena no es verificable externamente.
    recordPayload: jsonb('record_payload').$type<Record<string, unknown>>().notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(), // entra en el hash
    hash: text('hash').notNull(),
    previousHash: text('previous_hash').notNull(), // el primer registro usa la semilla de la spec
    hashAlgorithm: text('hash_algorithm').notNull(), // ej. 'SHA-256' — según spec AEAT vigente
    qrContent: text('qr_content').notNull(), // URL de verificación AEAT
    signature: text('signature'), // firma electrónica (modo no_verifactu)
    softwareId: text('software_id').notNull(), // identificador del SIF
    softwareVersion: text('software_version').notNull(),
    aeatStatus: text('aeat_status').$type<AeatStatus>().default('pending').notNull(),
    aeatSentAt: timestamp('aeat_sent_at', { withTimezone: true }),
    aeatResponse: jsonb('aeat_response').$type<Record<string, unknown>>(),
    ...createdAt,
  },
  (t) => [
    unique('billing_records_business_sequence_unique').on(t.businessId, t.sequenceNumber),
    index('billing_records_invoice_id_idx').on(t.invoiceId),
    check('billing_records_record_type_check', inEnum(t.recordType, BILLING_RECORD_TYPES)),
    check('billing_records_aeat_status_check', inEnum(t.aeatStatus, AEAT_STATUSES)),
  ],
);

// Log de eventos del SIF exigido por la normativa — append-only.
// event_type es lista abierta: 'sif_start' / 'login' / 'config_change' / 'incident' / 'reprint'...
export const systemEvents = pgTable(
  'system_events',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    deviceId: uuid('device_id').references(() => devices.id),
    employeeId: uuid('employee_id').references(() => employees.id),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    // Encadenado opcional del log en modo no_verifactu (Orden HAC/1177/2024) —
    // verificar con la spec AEAT vigente antes de activarlo.
    hash: text('hash'),
    previousHash: text('previous_hash'),
    ...createdAt,
  },
  (t) => [index('system_events_business_id_idx').on(t.businessId)],
);

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  business: one(businesses, { fields: [invoices.businessId], references: [businesses.id] }),
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
  rectifiedInvoice: one(invoices, {
    fields: [invoices.rectifiedInvoiceId],
    references: [invoices.id],
    relationName: 'invoice_rectifies',
  }),
  rectificativeInvoices: many(invoices, { relationName: 'invoice_rectifies' }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  device: one(devices, { fields: [invoices.deviceId], references: [devices.id] }),
  employee: one(employees, { fields: [invoices.employeeId], references: [employees.id] }),
  taxLines: many(invoiceTaxLines),
  billingRecords: many(billingRecords),
}));

export const invoiceTaxLinesRelations = relations(invoiceTaxLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceTaxLines.invoiceId], references: [invoices.id] }),
}));

export const billingRecordsRelations = relations(billingRecords, ({ one }) => ({
  business: one(businesses, { fields: [billingRecords.businessId], references: [businesses.id] }),
  invoice: one(invoices, { fields: [billingRecords.invoiceId], references: [invoices.id] }),
}));

export const systemEventsRelations = relations(systemEvents, ({ one }) => ({
  business: one(businesses, { fields: [systemEvents.businessId], references: [businesses.id] }),
  device: one(devices, { fields: [systemEvents.deviceId], references: [devices.id] }),
  employee: one(employees, { fields: [systemEvents.employeeId], references: [employees.id] }),
}));
