// Módulo 2 — Catálogo (la carta).
// Fuente de verdad: docs/DATABASE-SCHEMA.md (módulo 2).
// Un combo NO es una tabla propia: es un product con is_combo=true;
// combo_sections/combo_section_items definen sus secciones elegibles.

import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from './accounts';
import { createdAt, id, inEnum, selectPolicy, tenantSelectPolicy, timestamps } from './helpers';

export const PRINT_DESTINATIONS = ['kitchen', 'bar', 'none'] as const;
export type PrintDestination = (typeof PRINT_DESTINATIONS)[number];

// Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011).
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const productCategories = pgTable(
  'product_categories',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => productCategories.id), // subcategorías
    name: text('name').notNull(),
    color: text('color'), // color del botón en el TPV
    icon: text('icon'),
    displayOrder: integer('display_order').default(0).notNull(),
    printDestination: text('print_destination').$type<PrintDestination>().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index('product_categories_business_id_idx').on(t.businessId),
    check(
      'product_categories_print_destination_check',
      inEnum(t.printDestination, PRINT_DESTINATIONS),
    ),
    tenantSelectPolicy('product_categories'),
  ],
);

export const products = pgTable(
  'products',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    categoryId: uuid('category_id')
      .references(() => productCategories.id)
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    basePriceCents: integer('base_price_cents').notNull(), // céntimos, IVA incluido
    taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull(), // % IVA (ej. 10.00)
    allergens: text('allergens').array().$type<Allergen[]>().default(sql`'{}'::text[]`).notNull(),
    isCombo: boolean('is_combo').default(false).notNull(),
    trackStock: boolean('track_stock').default(false).notNull(),
    sku: text('sku'),
    displayOrder: integer('display_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [index('products_business_id_idx').on(t.businessId), tenantSelectPolicy('products')],
);

export const productVariants = pgTable(
  'product_variants',
  {
    ...id,
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    name: text('name').notNull(), // ej. "Doble"
    priceCents: integer('price_cents').notNull(), // precio ABSOLUTO de la variante (no delta)
    sku: text('sku'),
    isDefault: boolean('is_default').default(false).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index('product_variants_product_id_idx').on(t.productId),
    // Hija sin business_id: hereda el acceso del producto padre.
    selectPolicy(
      'product_variants',
      sql`exists (select 1 from public.products p where p.id = product_id and public.has_business_access(p.business_id))`,
    ),
  ],
);

export const modifierGroups = pgTable(
  'modifier_groups',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    name: text('name').notNull(),
    minSelect: integer('min_select').default(0).notNull(), // 0 = opcional
    maxSelect: integer('max_select').default(1).notNull(),
    isRequired: boolean('is_required').default(false).notNull(),
    ...timestamps,
  },
  (t) => [
    index('modifier_groups_business_id_idx').on(t.businessId),
    tenantSelectPolicy('modifier_groups'),
  ],
);

export const modifiers = pgTable(
  'modifiers',
  {
    ...id,
    modifierGroupId: uuid('modifier_group_id')
      .references(() => modifierGroups.id)
      .notNull(),
    name: text('name').notNull(),
    priceDeltaCents: integer('price_delta_cents').notNull(), // puede ser 0 o negativo
    displayOrder: integer('display_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index('modifiers_modifier_group_id_idx').on(t.modifierGroupId),
    selectPolicy(
      'modifiers',
      sql`exists (select 1 from public.modifier_groups g where g.id = modifier_group_id and public.has_business_access(g.business_id))`,
    ),
  ],
);

// Junction: qué grupos de modificadores aplican a qué producto.
export const productModifierGroups = pgTable(
  'product_modifier_groups',
  {
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    modifierGroupId: uuid('modifier_group_id')
      .references(() => modifierGroups.id)
      .notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    ...createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.modifierGroupId] }),
    selectPolicy(
      'product_modifier_groups',
      sql`exists (select 1 from public.products p where p.id = product_id and public.has_business_access(p.business_id))`,
    ),
  ],
);

export const comboSections = pgTable(
  'combo_sections',
  {
    ...id,
    comboProductId: uuid('combo_product_id')
      .references(() => products.id)
      .notNull(),
    name: text('name').notNull(), // ej. "Primero"
    minSelect: integer('min_select').default(1).notNull(),
    maxSelect: integer('max_select').default(1).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    index('combo_sections_combo_product_id_idx').on(t.comboProductId),
    selectPolicy(
      'combo_sections',
      sql`exists (select 1 from public.products p where p.id = combo_product_id and public.has_business_access(p.business_id))`,
    ),
  ],
);

export const comboSectionItems = pgTable(
  'combo_section_items',
  {
    ...id,
    comboSectionId: uuid('combo_section_id')
      .references(() => comboSections.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    priceDeltaCents: integer('price_delta_cents').default(0).notNull(), // suplemento (ej. "+3 €")
    ...timestamps,
  },
  (t) => [
    index('combo_section_items_combo_section_id_idx').on(t.comboSectionId),
    // Nieta: dos saltos hasta el business_id (combo_sections → products).
    selectPolicy(
      'combo_section_items',
      sql`exists (select 1 from public.combo_sections cs join public.products p on p.id = cs.combo_product_id where cs.id = combo_section_id and public.has_business_access(p.business_id))`,
    ),
  ],
);

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  business: one(businesses, {
    fields: [productCategories.businessId],
    references: [businesses.id],
  }),
  parent: one(productCategories, {
    fields: [productCategories.parentId],
    references: [productCategories.id],
    relationName: 'category_parent',
  }),
  children: many(productCategories, { relationName: 'category_parent' }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  business: one(businesses, { fields: [products.businessId], references: [businesses.id] }),
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  variants: many(productVariants),
  modifierGroups: many(productModifierGroups),
  comboSections: many(comboSections),
  comboSectionItems: many(comboSectionItems),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const modifierGroupsRelations = relations(modifierGroups, ({ one, many }) => ({
  business: one(businesses, { fields: [modifierGroups.businessId], references: [businesses.id] }),
  modifiers: many(modifiers),
  products: many(productModifierGroups),
}));

export const modifiersRelations = relations(modifiers, ({ one }) => ({
  group: one(modifierGroups, {
    fields: [modifiers.modifierGroupId],
    references: [modifierGroups.id],
  }),
}));

export const productModifierGroupsRelations = relations(productModifierGroups, ({ one }) => ({
  product: one(products, {
    fields: [productModifierGroups.productId],
    references: [products.id],
  }),
  modifierGroup: one(modifierGroups, {
    fields: [productModifierGroups.modifierGroupId],
    references: [modifierGroups.id],
  }),
}));

export const comboSectionsRelations = relations(comboSections, ({ one, many }) => ({
  comboProduct: one(products, {
    fields: [comboSections.comboProductId],
    references: [products.id],
  }),
  items: many(comboSectionItems),
}));

export const comboSectionItemsRelations = relations(comboSectionItems, ({ one }) => ({
  section: one(comboSections, {
    fields: [comboSectionItems.comboSectionId],
    references: [comboSections.id],
  }),
  product: one(products, { fields: [comboSectionItems.productId], references: [products.id] }),
}));
