// Router del catálogo: product_categories, products, product_variants.
// PATRÓN multi-tenant: businessId SIEMPRE de ctx.businessId, NUNCA del input.
// Toda query lleva eq(tabla.businessId, ctx.businessId) en el WHERE.
// Updates/setActive filtran por id AND businessId: un caller de B no puede
// tocar filas de A.

import { productCategories, productVariants, products } from '@tpv/db';
import type { Database } from '@tpv/db';
import {
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
  idOnlySchema,
  listByCategorySchema,
  listByProductSchema,
  reorderSchema,
  setActiveSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
} from '@tpv/validators';
import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { managerProcedure } from '../procedures';
import { businessProcedure, router } from '../trpc';

// Drizzle maps NUMERIC columns to string; the API accepts/returns number.
const toTaxRate = (n: number): string => String(n);
const fromTaxRate = (s: string): number => Number(s);

function mapProduct<T extends { taxRate: string }>(
  row: T,
): Omit<T, 'taxRate'> & { taxRate: number } {
  return { ...row, taxRate: fromTaxRate(row.taxRate) };
}

// Asserts a category belongs to the business. Throws BAD_REQUEST if not.
async function assertCategoryOwnership(
  db: Database,
  businessId: string,
  categoryId: string,
): Promise<void> {
  const [cat] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(eq(productCategories.id, categoryId), eq(productCategories.businessId, businessId)))
    .limit(1);
  if (!cat)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Category does not belong to this business',
    });
}

// Asserts a product belongs to the business. Throws NOT_FOUND if not.
async function assertProductOwnership(
  db: Database,
  businessId: string,
  productId: string,
): Promise<void> {
  const [prod] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.businessId, businessId)))
    .limit(1);
  if (!prod) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
}

// ──────────────────────────────── categories ────────────────────────────────

const categoriesRouter = router({
  list: businessProcedure
    .input(listByCategorySchema.omit({ categoryId: true }))
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(productCategories)
        .where(
          and(
            eq(productCategories.businessId, ctx.businessId),
            input.includeInactive ? undefined : eq(productCategories.isActive, true),
          ),
        ),
    ),

  getById: businessProcedure.input(idOnlySchema).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(productCategories)
      .where(
        and(eq(productCategories.id, input.id), eq(productCategories.businessId, ctx.businessId)),
      )
      .limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  create: managerProcedure.input(createCategorySchema).mutation(async ({ ctx, input }) => {
    if (input.parentId) await assertCategoryOwnership(ctx.db, ctx.businessId, input.parentId);
    const [row] = await ctx.db
      .insert(productCategories)
      .values({ ...input, businessId: ctx.businessId })
      .returning();
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return row;
  }),

  update: managerProcedure.input(updateCategorySchema).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    if (patch.parentId) await assertCategoryOwnership(ctx.db, ctx.businessId, patch.parentId);
    const [row] = await ctx.db
      .update(productCategories)
      .set(patch)
      .where(and(eq(productCategories.id, id), eq(productCategories.businessId, ctx.businessId)))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  setActive: managerProcedure.input(setActiveSchema).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .update(productCategories)
      .set({ isActive: input.isActive })
      .where(
        and(eq(productCategories.id, input.id), eq(productCategories.businessId, ctx.businessId)),
      )
      .returning({ id: productCategories.id });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return { id: row.id, isActive: input.isActive };
  }),

  reorder: managerProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    // TODO: replace with a single batch upsert when N grows large.
    await Promise.all(
      input.items.map(({ id, displayOrder }) =>
        ctx.db
          .update(productCategories)
          .set({ displayOrder })
          .where(
            and(eq(productCategories.id, id), eq(productCategories.businessId, ctx.businessId)),
          ),
      ),
    );
    return { ok: true };
  }),
});

// ──────────────────────────────── products ──────────────────────────────────

const productsRouter = router({
  list: businessProcedure.input(listByCategorySchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.businessId, ctx.businessId),
          input.categoryId !== undefined ? eq(products.categoryId, input.categoryId) : undefined,
          input.includeInactive ? undefined : eq(products.isActive, true),
        ),
      );
    return rows.map(mapProduct);
  }),

  getById: businessProcedure.input(idOnlySchema).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(products)
      .where(and(eq(products.id, input.id), eq(products.businessId, ctx.businessId)))
      .limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return mapProduct(row);
  }),

  create: managerProcedure.input(createProductSchema).mutation(async ({ ctx, input }) => {
    await assertCategoryOwnership(ctx.db, ctx.businessId, input.categoryId);
    const [row] = await ctx.db
      .insert(products)
      .values({ ...input, businessId: ctx.businessId, taxRate: toTaxRate(input.taxRate) })
      .returning();
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return mapProduct(row);
  }),

  update: managerProcedure.input(updateProductSchema).mutation(async ({ ctx, input }) => {
    const { id, taxRate, categoryId, ...rest } = input;
    if (categoryId !== undefined) await assertCategoryOwnership(ctx.db, ctx.businessId, categoryId);
    const setPatch = {
      ...(rest.name !== undefined && { name: rest.name }),
      ...(rest.description !== undefined && { description: rest.description }),
      ...(rest.imageUrl !== undefined && { imageUrl: rest.imageUrl }),
      ...(rest.allergens !== undefined && { allergens: rest.allergens }),
      ...(rest.sku !== undefined && { sku: rest.sku }),
      ...(rest.isCombo !== undefined && { isCombo: rest.isCombo }),
      ...(rest.trackStock !== undefined && { trackStock: rest.trackStock }),
      ...(rest.displayOrder !== undefined && { displayOrder: rest.displayOrder }),
      ...(rest.basePriceCents !== undefined && { basePriceCents: rest.basePriceCents }),
      ...(categoryId !== undefined && { categoryId }),
      ...(taxRate !== undefined && { taxRate: toTaxRate(taxRate) }),
    };
    const [row] = await ctx.db
      .update(products)
      .set(setPatch)
      .where(and(eq(products.id, id), eq(products.businessId, ctx.businessId)))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return mapProduct(row);
  }),

  setActive: managerProcedure.input(setActiveSchema).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .update(products)
      .set({ isActive: input.isActive })
      .where(and(eq(products.id, input.id), eq(products.businessId, ctx.businessId)))
      .returning({ id: products.id });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return { id: row.id, isActive: input.isActive };
  }),

  reorder: managerProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    // TODO: replace with a single batch upsert when N grows large.
    await Promise.all(
      input.items.map(({ id, displayOrder }) =>
        ctx.db
          .update(products)
          .set({ displayOrder })
          .where(and(eq(products.id, id), eq(products.businessId, ctx.businessId))),
      ),
    );
    return { ok: true };
  }),
});

// ──────────────────────────────── variants ──────────────────────────────────

// Variants have no businessId column; ownership is checked via the parent product.

const variantsRouter = router({
  list: businessProcedure.input(listByProductSchema).query(async ({ ctx, input }) => {
    // Verifies product ownership implicitly: NOT_FOUND if product is from another business.
    await assertProductOwnership(ctx.db, ctx.businessId, input.productId);
    return ctx.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, input.productId));
  }),

  create: managerProcedure.input(createVariantSchema).mutation(async ({ ctx, input }) => {
    // Verifies product ownership before inserting.
    await assertProductOwnership(ctx.db, ctx.businessId, input.productId);
    const [row] = await ctx.db.insert(productVariants).values(input).returning();
    if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return row;
  }),

  update: managerProcedure.input(updateVariantSchema).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    // Atomic: WHERE variant.id AND variant.productId IN (products owned by this business).
    const ownedProductIds = ctx.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.businessId, ctx.businessId));
    const [row] = await ctx.db
      .update(productVariants)
      .set(patch)
      .where(and(eq(productVariants.id, id), inArray(productVariants.productId, ownedProductIds)))
      .returning();
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  setActive: managerProcedure.input(setActiveSchema).mutation(async ({ ctx, input }) => {
    const ownedProductIds = ctx.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.businessId, ctx.businessId));
    const [row] = await ctx.db
      .update(productVariants)
      .set({ isActive: input.isActive })
      .where(
        and(eq(productVariants.id, input.id), inArray(productVariants.productId, ownedProductIds)),
      )
      .returning({ id: productVariants.id });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return { id: row.id, isActive: input.isActive };
  }),
});

// ─────────────────────────────── root export ────────────────────────────────

export const catalogRouter = router({
  categories: categoriesRouter,
  products: productsRouter,
  variants: variantsRouter,
});
