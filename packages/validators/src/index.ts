import { z } from 'zod';

// Convención: validar SIEMPRE los datos externos en los bordes (API, formularios).

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  pin: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos'),
  role: z.enum(['admin', 'manager', 'worker']).default('worker'),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// Auth schemas

export const createPairingCodeSchema = z.object({
  name: z.string().min(1, 'Device name is required'),
  type: z.enum(['pos_terminal', 'waiter_tablet', 'kds', 'printer']),
});
export type CreatePairingCodeInput = z.infer<typeof createPairingCodeSchema>;

export const pairDeviceSchema = z.object({
  code: z.string().regex(/^\d{6,8}$/, 'Pairing code must be 6–8 digits'),
});
export type PairDeviceInput = z.infer<typeof pairDeviceSchema>;

export const employeeLoginSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
});
export type EmployeeLoginInput = z.infer<typeof employeeLoginSchema>;

export const revokeDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
});
export type RevokeDeviceInput = z.infer<typeof revokeDeviceSchema>;

// Catalog schemas

// Mirrored from packages/db/src/schema/catalog.ts to keep validators dep-free.
const PRINT_DESTINATIONS = ['kitchen', 'bar', 'none'] as const;
const ALLERGENS = [
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

// Shared building blocks
export const idOnlySchema = z.object({ id: z.string().uuid() }).strict();
export type IdOnlyInput = z.infer<typeof idOnlySchema>;

export const setActiveSchema = z
  .object({
    id: z.string().uuid(),
    isActive: z.boolean(),
  })
  .strict();
export type SetActiveInput = z.infer<typeof setActiveSchema>;

export const reorderSchema = z
  .object({
    items: z
      .array(z.object({ id: z.string().uuid(), displayOrder: z.number().int().min(0) }).strict())
      .min(1),
  })
  .strict();
export type ReorderInput = z.infer<typeof reorderSchema>;

export const listByCategorySchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    includeInactive: z.boolean().optional(),
  })
  .strict();
export type ListByCategoryInput = z.infer<typeof listByCategorySchema>;

export const listByProductSchema = z
  .object({
    productId: z.string().uuid(),
  })
  .strict();
export type ListByProductInput = z.infer<typeof listByProductSchema>;

// Product categories
export const createCategorySchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    printDestination: z.enum(PRINT_DESTINATIONS),
    parentId: z.string().uuid().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    printDestination: z.enum(PRINT_DESTINATIONS).optional(),
    parentId: z.string().uuid().nullable().optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// Products
export const createProductSchema = z
  .object({
    categoryId: z.string().uuid(),
    name: z.string().min(1, 'Name is required'),
    basePriceCents: z.number().int().min(0),
    taxRate: z.number().min(0).max(100),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    allergens: z.array(z.enum(ALLERGENS)).optional(),
    sku: z.string().optional(),
    isCombo: z.boolean().optional(),
    trackStock: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    id: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    basePriceCents: z.number().int().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    description: z.string().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    allergens: z.array(z.enum(ALLERGENS)).optional(),
    sku: z.string().nullable().optional(),
    isCombo: z.boolean().optional(),
    trackStock: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Product variants
export const createVariantSchema = z
  .object({
    productId: z.string().uuid(),
    name: z.string().min(1, 'Name is required'),
    priceCents: z.number().int().min(0),
    sku: z.string().optional(),
    isDefault: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    priceCents: z.number().int().min(0).optional(),
    sku: z.string().nullable().optional(),
    isDefault: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

// Floor schemas

// Mirrored from packages/db/src/schema/floor.ts to keep validators dep-free.
const TABLE_SHAPES = ['square', 'round'] as const;

export const listByZoneSchema = z
  .object({
    zoneId: z.string().uuid(),
    includeInactive: z.boolean().optional(),
  })
  .strict();
export type ListByZoneInput = z.infer<typeof listByZoneSchema>;

export const listTablesWithOrdersSchema = z
  .object({ zoneId: z.string().uuid().optional() })
  .strict();
export type ListTablesWithOrdersInput = z.infer<typeof listTablesWithOrdersSchema>;

export const createZoneSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    displayOrder: z.number().int().min(0).optional(),
    backgroundUrl: z.string().url().nullable().optional(),
  })
  .strict();
export type CreateZoneInput = z.infer<typeof createZoneSchema>;

export const updateZoneSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    displayOrder: z.number().int().min(0).optional(),
    backgroundUrl: z.string().url().nullable().optional(),
  })
  .strict();
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;

export const createTableSchema = z
  .object({
    zoneId: z.string().uuid(),
    name: z.string().min(1, 'Name is required'),
    posX: z.number().int().min(0),
    posY: z.number().int().min(0),
    width: z.number().int().min(40),
    height: z.number().int().min(40),
    shape: z.enum(TABLE_SHAPES),
    seats: z.number().int().min(1),
  })
  .strict();
export type CreateTableInput = z.infer<typeof createTableSchema>;

export const updateTableSchema = z
  .object({
    id: z.string().uuid(),
    zoneId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    posX: z.number().int().min(0).optional(),
    posY: z.number().int().min(0).optional(),
    width: z.number().int().min(40).optional(),
    height: z.number().int().min(40).optional(),
    shape: z.enum(TABLE_SHAPES).optional(),
    seats: z.number().int().min(1).optional(),
  })
  .strict();
export type UpdateTableInput = z.infer<typeof updateTableSchema>;

export const tableIdSchema = z.object({ tableId: z.string().uuid() }).strict();
export type TableIdInput = z.infer<typeof tableIdSchema>;

// Order schemas

// Mirrored from packages/db/src/schema/orders.ts to keep validators dep-free.
const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery', 'counter'] as const;

export const upsertOrderLineSchema = z
  .object({
    lineId: z.string().uuid(),
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1),
    notes: z.string().optional(),
  })
  .strict();

export const upsertOrderSchema = z
  .object({
    orderId: z.string().uuid(),
    type: z.enum(ORDER_TYPES),
    tableId: z.string().uuid().nullable().optional(),
    notes: z.string().optional(),
    lines: z.array(upsertOrderLineSchema),
  })
  .strict();
export type UpsertOrderInput = z.infer<typeof upsertOrderSchema>;

export const orderIdSchema = z.object({ orderId: z.string().uuid() }).strict();
export type OrderIdInput = z.infer<typeof orderIdSchema>;

// Payment schemas

// Mirrored from packages/db/src/schema/orders.ts to keep validators dep-free.
export const PAYMENT_METHODS = ['cash', 'card', 'bizum', 'other'] as const;

export const payOrderPaymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    amountCents: z.number().int().positive(),
    tipCents: z.number().int().nonnegative().default(0),
    cashReceivedCents: z.number().int().positive().optional(),
    reference: z.string().max(120).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.method === 'cash') {
      if (data.cashReceivedCents === undefined) {
        ctx.addIssue({ code: 'custom', message: 'cashReceivedCents required for cash payments' });
      } else if (data.cashReceivedCents < data.amountCents) {
        ctx.addIssue({
          code: 'custom',
          message: 'cashReceivedCents must be >= amountCents',
        });
      }
    } else if (data.cashReceivedCents !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'cashReceivedCents is only valid for cash payments',
      });
    }
  });

export const payOrderSchema = z
  .object({
    orderId: z.string().uuid(),
    payments: z.array(payOrderPaymentSchema).min(1).max(6),
  })
  .strict();
export type PayOrderInput = z.infer<typeof payOrderSchema>;
