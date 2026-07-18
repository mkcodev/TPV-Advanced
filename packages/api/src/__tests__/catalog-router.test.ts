// Tests del catalogRouter: aislamiento multi-tenant, taxRate round-trip,
// validación Zod. Patrón: createCallerFactory + ctx simulado + proxy grabador.
//
// El proxy queuedDb consume respuestas en orden de aparición:
//   - managerProcedure (admin kind) emite 1 SELECT para getMembershipRole
//     antes de ejecutar el handler del endpoint.
//   - businessProcedure no emite SELECT adicional; el 1er slot es datos.

import type { Database } from '@tpv/db';
import { createCategorySchema, createProductSchema, createVariantSchema } from '@tpv/validators';
import { describe, expect, it } from 'vitest';
import type { Context } from '../context';
import { catalogRouter } from '../routers/catalog';
import { createCallerFactory, router } from '../trpc';

// ── helpers ─────────────────────────────────────────────────────────────────

type RecordedCall = { method: string; args: unknown[] };

/**
 * Proxy chainable de drizzle que consume respuestas de una cola.
 * Cada `await db.*` consume la siguiente entrada de `responses`.
 * Registra las llamadas a `.values()`, `.set()` y `.where()` en `calls`.
 *
 * Basado en el patrón de auth-router.test.ts; extendido con cola y grabación.
 */
function queuedDb(responses: unknown[][]): { db: Database; calls: RecordedCall[] } {
  const queue = responses.map((r) => [...r]);
  const calls: RecordedCall[] = [];

  const makeChain = (): unknown => {
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const handler: ProxyHandler<any> = {
      get(_t, prop: string | symbol) {
        const method = String(prop);
        if (method === 'then') {
          const rows = queue.shift() ?? [];
          return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          if (['values', 'set', 'where'].includes(method)) {
            calls.push({ method, args });
          }
          return new Proxy({}, handler);
        };
      },
    };
    return new Proxy({}, handler);
  };

  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
  } as unknown as Database;

  return { db, calls };
}

// Admin context — managerProcedure dispara 1 SELECT para getMembershipRole.
function adminCtx(businessId = 'biz-1'): Omit<Context, 'db'> {
  return { auth: { kind: 'admin', userId: 'user-1', businessId }, ip: '127.0.0.1' };
}

// Context para reads (businessProcedure, sin SELECT de rol).
function bizCtx(businessId = 'biz-1'): Omit<Context, 'db'> {
  return { auth: { kind: 'admin', userId: 'user-1', businessId }, ip: '127.0.0.1' };
}

// Respuesta de rol de owner que managerProcedure consume.
const OWNER_ROLE = [{ role: 'owner' }];

const testRouter = router({ catalog: catalogRouter });
const createCaller = createCallerFactory(testRouter);

// ── Zod: rejects businessId as input ────────────────────────────────────────

describe('catalog schemas — Zod rejects businessId', () => {
  it('createCategorySchema strips unknown keys including businessId', () => {
    const result = createCategorySchema.safeParse({
      businessId: 'biz-x',
      name: 'Bebidas',
      printDestination: 'bar',
    });
    // .strict() rejects unknown keys
    expect(result.success).toBe(false);
  });

  it('createProductSchema rejects businessId', () => {
    const result = createProductSchema.safeParse({
      businessId: 'biz-x',
      categoryId: '00000000-0000-0000-0000-000000000001',
      name: 'Cerveza',
      basePriceCents: 250,
      taxRate: 10,
    });
    expect(result.success).toBe(false);
  });

  it('createVariantSchema rejects businessId', () => {
    const result = createVariantSchema.safeParse({
      businessId: 'biz-x',
      productId: '00000000-0000-0000-0000-000000000001',
      name: 'Doble',
      priceCents: 350,
    });
    expect(result.success).toBe(false);
  });
});

// ── categories.create — businessId viene del ctx ─────────────────────────────

describe('catalog.categories.create', () => {
  const CAT_ID = '00000000-0000-0000-0000-000000000010';

  it('uses ctx.businessId, not input', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [
        {
          id: CAT_ID,
          businessId: 'biz-1',
          name: 'Bebidas',
          printDestination: 'bar',
          parentId: null,
          color: null,
          icon: null,
          displayOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.catalog.categories.create({ name: 'Bebidas', printDestination: 'bar' });

    const valuesCall = calls.find((c) => c.method === 'values');
    expect(valuesCall).toBeDefined();
    const insertedRow = (valuesCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(insertedRow.businessId).toBe('biz-1');
    expect(insertedRow).not.toHaveProperty('businessId', 'biz-other');
  });

  it('throws BAD_REQUEST when parentId belongs to another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [], // parentId ownership check → empty (not found)
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await expect(
      caller.catalog.categories.create({
        name: 'Sub',
        printDestination: 'kitchen',
        parentId: '00000000-0000-0000-0000-000000000099',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── categories.update — NOT_FOUND when businessId mismatch ──────────────────

describe('catalog.categories.update', () => {
  it('throws NOT_FOUND when the row belongs to another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [], // update.returning() → empty (id+businessId didn't match)
    ]);
    const caller = createCaller({ ...adminCtx('biz-B'), db });
    await expect(
      caller.catalog.categories.update({
        id: '00000000-0000-0000-0000-000000000010',
        name: 'Renamed',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ── products.create — taxRate round-trip ──────────────────────────────────

describe('catalog.products.create — taxRate round-trip', () => {
  const PROD = {
    id: '00000000-0000-0000-0000-000000000020',
    businessId: 'biz-1',
    categoryId: '00000000-0000-0000-0000-000000000010',
    name: 'Cerveza',
    basePriceCents: 250,
    taxRate: '10.00', // Drizzle devuelve NUMERIC como string
    description: null,
    imageUrl: null,
    allergens: [],
    sku: null,
    isCombo: false,
    trackStock: false,
    displayOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('writes taxRate as string to DB and returns it as number', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [{ id: PROD.categoryId }], // assertCategoryOwnership
      [PROD], // insert.returning()
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    const result = await caller.catalog.products.create({
      categoryId: PROD.categoryId,
      name: 'Cerveza',
      basePriceCents: 250,
      taxRate: 10, // ← number in
    });

    // The DB insert should have received taxRate as a string.
    const valuesCall = calls.find((c) => c.method === 'values');
    const insertedRow = (valuesCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(typeof insertedRow.taxRate).toBe('string');

    // The returned value should be number.
    expect(typeof result.taxRate).toBe('number');
    expect(result.taxRate).toBe(10);
  });

  it('normalises taxRate "21.00" from DB to number 21 on read', async () => {
    const { db } = queuedDb([[{ ...PROD, taxRate: '21.00' }]]); // businessProcedure, 0 role checks
    const caller = createCaller({ ...bizCtx('biz-1'), db });
    const result = await caller.catalog.products.getById({
      id: PROD.id,
    });
    expect(result.taxRate).toBe(21);
    expect(typeof result.taxRate).toBe('number');
  });
});

// ── products.create — cross-business category ────────────────────────────

describe('catalog.products.create — cross-business category', () => {
  it('throws BAD_REQUEST when categoryId belongs to another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [], // assertCategoryOwnership → empty (not found in biz-1)
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await expect(
      caller.catalog.products.create({
        categoryId: '00000000-0000-0000-0000-000000000099',
        name: 'Producto',
        basePriceCents: 100,
        taxRate: 10,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ── variants.create — verifica producto padre ────────────────────────────

describe('catalog.variants.create', () => {
  it('throws NOT_FOUND when productId belongs to another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [], // assertProductOwnership → empty
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await expect(
      caller.catalog.variants.create({
        productId: '00000000-0000-0000-0000-000000000099',
        name: 'Doble',
        priceCents: 350,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('inserts variant when product belongs to the business', async () => {
    const VAR = {
      id: '00000000-0000-0000-0000-000000000030',
      productId: '00000000-0000-0000-0000-000000000020',
      name: 'Doble',
      priceCents: 350,
      sku: null,
      isDefault: false,
      displayOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { db } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [{ id: VAR.productId }], // assertProductOwnership → found
      [VAR], // insert.returning()
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    const result = await caller.catalog.variants.create({
      productId: VAR.productId,
      name: 'Doble',
      priceCents: 350,
    });
    expect(result.id).toBe(VAR.id);
  });
});

// ── products.update — basePriceCents se aplica al SET ────────────────────

describe('catalog.products.update', () => {
  const PROD = {
    id: '00000000-0000-0000-0000-000000000020',
    businessId: 'biz-1',
    categoryId: '00000000-0000-0000-0000-000000000010',
    name: 'Cerveza',
    basePriceCents: 300,
    taxRate: '10.00',
    description: null,
    imageUrl: null,
    allergens: [],
    sku: null,
    isCombo: false,
    trackStock: false,
    displayOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('applies basePriceCents to the SET patch when provided', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [PROD], // update.returning()
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    const result = await caller.catalog.products.update({
      id: PROD.id,
      basePriceCents: 300,
    });

    const setCall = calls.find((c) => c.method === 'set');
    const patch = (setCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(patch.basePriceCents).toBe(300);
    expect(result.basePriceCents).toBe(300);
  });

  it('does NOT include basePriceCents in SET when not provided', async () => {
    const { db, calls } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [PROD], // update.returning()
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.catalog.products.update({ id: PROD.id, name: 'Caña' });

    const setCall = calls.find((c) => c.method === 'set');
    const patch = (setCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(patch).not.toHaveProperty('basePriceCents');
  });

  it('applies every updateProductSchema field to the SET patch', async () => {
    // Regression guard: if a field is added to updateProductSchema but forgotten in the
    // explicit SET construction, this test catches it. Add any new optional field here.
    const CAT_ID = '00000000-0000-0000-0000-000000000010';
    const { db, calls } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [{ id: CAT_ID }], // assertCategoryOwnership (triggered by categoryId)
      [PROD], // update.returning()
    ]);
    const caller = createCaller({ ...adminCtx('biz-1'), db });
    await caller.catalog.products.update({
      id: PROD.id,
      name: 'Caña actualizada',
      description: 'Descripción nueva',
      imageUrl: 'https://example.com/img.jpg',
      allergens: ['gluten', 'milk'],
      sku: 'SKU-001',
      isCombo: true,
      trackStock: true,
      displayOrder: 5,
      basePriceCents: 350,
      categoryId: CAT_ID,
      taxRate: 21,
    });

    const setCall = calls.find((c) => c.method === 'set');
    const patch = (setCall?.args[0] ?? {}) as Record<string, unknown>;
    expect(patch.name).toBe('Caña actualizada');
    expect(patch.description).toBe('Descripción nueva');
    expect(patch.imageUrl).toBe('https://example.com/img.jpg');
    expect(patch.allergens).toEqual(['gluten', 'milk']);
    expect(patch.sku).toBe('SKU-001');
    expect(patch.isCombo).toBe(true);
    expect(patch.trackStock).toBe(true);
    expect(patch.displayOrder).toBe(5);
    expect(patch.basePriceCents).toBe(350);
    expect(patch.categoryId).toBe(CAT_ID);
    // taxRate is serialised to string before going to the DB
    expect(typeof patch.taxRate).toBe('string');
    expect(patch.taxRate).toBe('21');
  });
});

// ── variants.update — aislamiento via subquery ───────────────────────────

describe('catalog.variants.update', () => {
  it('throws NOT_FOUND when variant belongs to a product of another business', async () => {
    const { db } = queuedDb([
      OWNER_ROLE, // getMembershipRole
      [], // update.returning() → empty (productId not in owned subquery)
    ]);
    const caller = createCaller({ ...adminCtx('biz-B'), db });
    await expect(
      caller.catalog.variants.update({
        id: '00000000-0000-0000-0000-000000000030',
        name: 'Renamed',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
