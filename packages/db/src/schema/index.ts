// Esquema Drizzle — ARRANQUE.
// Aquí solo hay unas tablas de EJEMPLO para fijar las convenciones
// (business_id en todo, dinero en *_cents enteros, snake_case en columnas).
// El modelo COMPLETO (6 módulos) está en docs/DATABASE-SCHEMA.md.
// Ve añadiendo tablas desde ese documento, una a una.

import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  subscriptionPlan: text('subscription_plan').default('free').notNull(),
  subscriptionStatus: text('subscription_status').default('trialing').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const businesses = pgTable('businesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id)
    .notNull(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  taxId: text('tax_id'),
  currency: text('currency').default('EUR').notNull(),
  verifactuMode: text('verifactu_mode').default('disabled').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  pinHash: text('pin_hash').notNull(), // el PIN se guarda hasheado, nunca en claro
  role: text('role').default('worker').notNull(), // 'admin' | 'manager' | 'worker'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  basePriceCents: integer('base_price_cents').notNull(), // dinero en céntimos (entero)
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull(), // IVA %, ej. 10.00
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
