// Módulo 3 — Inventario (se activa en Fase 3; el esquema queda listo ya).
// Fuente de verdad: docs/DATABASE-SCHEMA.md (módulo 3).

import { relations, sql } from 'drizzle-orm';
import { boolean, check, index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { businesses, employees } from './accounts';
import { products } from './catalog';
import { createdAt, id, inEnum, selectPolicy, tenantSelectPolicy, timestamps } from './helpers';
import { orders } from './orders';

export const INVENTORY_UNITS = ['unit', 'kg', 'l'] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const STOCK_MOVEMENT_TYPES = ['purchase', 'sale', 'adjustment', 'waste'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const inventoryItems = pgTable(
  'inventory_items',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    name: text('name').notNull(),
    unit: text('unit').$type<InventoryUnit>().notNull(),
    // Caché de existencias; la verdad es SUM(stock_movements.quantity).
    currentStock: numeric('current_stock', { precision: 12, scale: 3 }).default('0').notNull(),
    minStock: numeric('min_stock', { precision: 12, scale: 3 }).default('0').notNull(), // 0 = sin aviso
    costPriceCents: integer('cost_price_cents').notNull(), // coste por unidad
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index('inventory_items_business_id_idx').on(t.businessId),
    check('inventory_items_unit_check', inEnum(t.unit, INVENTORY_UNITS)),
    tenantSelectPolicy('inventory_items'),
  ],
);

// Escandallos: cuánto inventario consume un producto al venderse.
export const productRecipes = pgTable(
  'product_recipes',
  {
    ...id,
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    inventoryItemId: uuid('inventory_item_id')
      .references(() => inventoryItems.id)
      .notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('product_recipes_product_id_idx').on(t.productId),
    // Hija sin business_id: hereda el acceso del producto padre.
    selectPolicy(
      'product_recipes',
      sql`exists (select 1 from public.products p where p.id = product_id and public.has_business_access(p.business_id))`,
    ),
  ],
);

// Historial de stock — append-only: correcciones = movimiento nuevo 'adjustment'.
export const stockMovements = pgTable(
  'stock_movements',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    inventoryItemId: uuid('inventory_item_id')
      .references(() => inventoryItems.id)
      .notNull(),
    type: text('type').$type<StockMovementType>().notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(), // + entra, − sale
    reason: text('reason'), // nullable: los movimientos automáticos ('sale') no llevan motivo humano
    orderId: uuid('order_id').references(() => orders.id), // si viene de una venta
    employeeId: uuid('employee_id').references(() => employees.id),
    ...createdAt,
  },
  (t) => [
    index('stock_movements_business_id_idx').on(t.businessId),
    index('stock_movements_inventory_item_id_idx').on(t.inventoryItemId),
    check('stock_movements_type_check', inEnum(t.type, STOCK_MOVEMENT_TYPES)),
    tenantSelectPolicy('stock_movements'),
  ],
);

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  business: one(businesses, { fields: [inventoryItems.businessId], references: [businesses.id] }),
  recipes: many(productRecipes),
  movements: many(stockMovements),
}));

export const productRecipesRelations = relations(productRecipes, ({ one }) => ({
  product: one(products, { fields: [productRecipes.productId], references: [products.id] }),
  inventoryItem: one(inventoryItems, {
    fields: [productRecipes.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  business: one(businesses, { fields: [stockMovements.businessId], references: [businesses.id] }),
  inventoryItem: one(inventoryItems, {
    fields: [stockMovements.inventoryItemId],
    references: [inventoryItems.id],
  }),
  order: one(orders, { fields: [stockMovements.orderId], references: [orders.id] }),
  employee: one(employees, { fields: [stockMovements.employeeId], references: [employees.id] }),
}));
