// Módulo 4 — Sala y mesas (plano visual).
// Fuente de verdad: docs/DATABASE-SCHEMA.md (módulo 4).

import { relations } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { businesses } from './accounts';
import { id, inEnum, timestamps } from './helpers';

export const TABLE_SHAPES = ['square', 'round'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

export const TABLE_STATUSES = ['free', 'occupied', 'billing', 'reserved'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const zones = pgTable(
  'zones',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    name: text('name').notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    backgroundUrl: text('background_url'), // imagen de fondo del plano
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [index('zones_business_id_idx').on(t.businessId)],
);

// tables.status es una CACHÉ visual del plano. La fuente de verdad es la
// comanda abierta: orders con status='open' + índice UNIQUE parcial por mesa.
// A propósito NO existe current_order_id aquí (doble verdad = bugs de sync).
export const tables = pgTable(
  'tables',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    zoneId: uuid('zone_id')
      .references(() => zones.id)
      .notNull(),
    name: text('name').notNull(), // número/nombre de mesa
    posX: integer('pos_x').notNull(),
    posY: integer('pos_y').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    shape: text('shape').$type<TableShape>().notNull(),
    seats: integer('seats').notNull(),
    status: text('status').$type<TableStatus>().default('free').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index('tables_business_id_idx').on(t.businessId),
    check('tables_shape_check', inEnum(t.shape, TABLE_SHAPES)),
    check('tables_status_check', inEnum(t.status, TABLE_STATUSES)),
  ],
);

export const zonesRelations = relations(zones, ({ one, many }) => ({
  business: one(businesses, { fields: [zones.businessId], references: [businesses.id] }),
  tables: many(tables),
}));

export const tablesRelations = relations(tables, ({ one }) => ({
  business: one(businesses, { fields: [tables.businessId], references: [businesses.id] }),
  zone: one(zones, { fields: [tables.zoneId], references: [zones.id] }),
}));
