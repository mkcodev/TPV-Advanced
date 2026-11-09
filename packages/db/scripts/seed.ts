import { createHash, randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from '@node-rs/argon2';
// Script de seed para desarrollo. Crea un usuario admin demo con org, negocio,
// memberships, productos de ejemplo, empleados y un device pre-emparejado.
// Idempotente: reutiliza la cuenta demo y regenera sus datos de venta y catálogo.
// Uso: pnpm db:seed (desde la raíz) o pnpm --filter @tpv/db db:seed
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from '../src/client';
import {
  businesses,
  customers,
  devices,
  employees,
  memberships,
  orderEvents,
  orderItems,
  orders,
  organizations,
  productCategories,
  products,
  users,
} from '../src/schema/index';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Variable de entorno requerida: ${name}`);
  return val;
}

const DATABASE_URL = requireEnv('DATABASE_URL');
const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const DEMO_EMAIL = 'admin@tpv.dev';
const DEMO_PASSWORD = 'AdminTPV1234!';
const DEMO_ORGANIZATION_NAME = 'Bar Demo SL';
const DEMO_BUSINESS_NAME = 'Bar Demo';
const DEMO_DEVICE_NAME = 'Terminal Demo';

async function main() {
  // Este script borra datos: nunca debe poder ejecutarse contra producción.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed bloqueado: NODE_ENV=production. Este script es solo para desarrollo.');
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const db = createDb(DATABASE_URL);

  const { data: authList } = await supabase.auth.admin.listUsers();
  const existingAuthUser = authList?.users.find((u) => u.email === DEMO_EMAIL);

  const ownedBusinesses = existingAuthUser
    ? await db
        .select({
          id: businesses.id,
          name: businesses.name,
          organizationName: organizations.name,
        })
        .from(businesses)
        .innerJoin(organizations, eq(businesses.organizationId, organizations.id))
        .where(eq(organizations.ownerUserId, existingAuthUser.id))
    : [];

  // Comprobación antes de borrar nada: la cuenta demo solo puede tener el negocio demo.
  const isOnlyDemoBusiness = ownedBusinesses.every(
    (b) => b.name === DEMO_BUSINESS_NAME && b.organizationName === DEMO_ORGANIZATION_NAME,
  );
  if (ownedBusinesses.length > 1 || !isOnlyDemoBusiness) {
    throw new Error(
      `Seed bloqueado: ${DEMO_EMAIL} tiene negocios que no son el demo ("${DEMO_BUSINESS_NAME}"). No se ha borrado nada.`,
    );
  }

  const existingBusiness = ownedBusinesses[0];

  // --- Demo account ---
  let userId: string;
  if (existingAuthUser) {
    userId = existingAuthUser.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
    });
    if (error) throw new Error(`Auth updateUserById falló: ${error.message}`);
  } else {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      throw new Error(`Auth createUser falló: ${authError?.message}`);
    }
    userId = authData.user.id;
  }

  await db
    .insert(users)
    .values({ id: userId, email: DEMO_EMAIL, fullName: 'Admin Demo' })
    .onConflictDoNothing();

  let business: { id: string };
  if (existingBusiness) {
    business = { id: existingBusiness.id };

    // --- Reset ---
    // No se borra el negocio, los empleados ni el dispositivo: system_events apunta a ellos
    // y es una tabla legal de solo añadir (regla 6 de CLAUDE.md), así que nunca se toca.
    // En transacción: si algo falla, no se queda un borrado a medias.
    await db.transaction(async (tx) => {
      const demoOrderIds = tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.businessId, business.id));

      await tx.delete(orderEvents).where(eq(orderEvents.businessId, business.id));
      await tx.delete(orderItems).where(inArray(orderItems.orderId, demoOrderIds));
      await tx.delete(orders).where(eq(orders.businessId, business.id));
      await tx.delete(products).where(eq(products.businessId, business.id));
      await tx.delete(productCategories).where(eq(productCategories.businessId, business.id));
      await tx.delete(customers).where(eq(customers.businessId, business.id));
    });
  } else {
    const [org] = await db
      .insert(organizations)
      .values({ name: DEMO_ORGANIZATION_NAME, ownerUserId: userId })
      .returning({ id: organizations.id });
    if (!org) throw new Error('Failed to insert demo organization');

    const [createdBusiness] = await db
      .insert(businesses)
      .values({ organizationId: org.id, name: DEMO_BUSINESS_NAME, invoiceSeries: 'A2026' })
      .returning({ id: businesses.id });
    if (!createdBusiness) throw new Error('Failed to insert demo business');
    business = createdBusiness;

    await db.insert(memberships).values({ userId, organizationId: org.id, role: 'owner' });
  }

  // --- Catalog ---
  const [catBebidas, catComida, catPostres] = await db
    .insert(productCategories)
    .values([
      { businessId: business.id, name: 'Bebidas', displayOrder: 1, printDestination: 'bar' },
      { businessId: business.id, name: 'Comida', displayOrder: 2, printDestination: 'kitchen' },
      { businessId: business.id, name: 'Postres', displayOrder: 3, printDestination: 'none' },
    ])
    .returning({ id: productCategories.id });

  await db.insert(products).values([
    {
      businessId: business.id,
      categoryId: catBebidas.id,
      name: 'Café con leche',
      basePriceCents: 150,
      taxRate: '10.00',
      displayOrder: 1,
    },
    {
      businessId: business.id,
      categoryId: catBebidas.id,
      name: 'Cerveza',
      basePriceCents: 250,
      taxRate: '10.00',
      displayOrder: 2,
    },
    {
      businessId: business.id,
      categoryId: catBebidas.id,
      name: 'Agua mineral',
      basePriceCents: 150,
      taxRate: '10.00',
      displayOrder: 3,
    },
    {
      businessId: business.id,
      categoryId: catComida.id,
      name: 'Tortilla española',
      basePriceCents: 800,
      taxRate: '10.00',
      displayOrder: 1,
    },
    {
      businessId: business.id,
      categoryId: catComida.id,
      name: 'Bocadillo de jamón',
      basePriceCents: 600,
      taxRate: '10.00',
      displayOrder: 2,
    },
    {
      businessId: business.id,
      categoryId: catPostres.id,
      name: 'Tarta del día',
      basePriceCents: 450,
      taxRate: '10.00',
      displayOrder: 1,
    },
  ]);

  // --- Employees ---
  const ARGON2_OPTIONS = { memoryCost: 65536, timeCost: 3, outputLen: 32, parallelism: 1 } as const;

  const employeeData = [
    { name: 'Ana García', role: 'admin' as const, pin: '1234' },
    { name: 'Bruno López', role: 'worker' as const, pin: '5678' },
    { name: 'Carla Martín', role: 'manager' as const, pin: '4321' },
  ];

  const existingEmployees = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.businessId, business.id));

  const createdEmployees = await Promise.all(
    employeeData.map(async (e) => {
      const pinHash = await hash(e.pin, ARGON2_OPTIONS);
      const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(e.name)}`;
      const existing = existingEmployees.find((row) => row.name === e.name);
      const [row] = existing
        ? await db
            .update(employees)
            .set({
              role: e.role,
              pinHash,
              avatarUrl,
              isActive: true,
              failedPinAttempts: 0,
              lockedUntil: null,
            })
            .where(eq(employees.id, existing.id))
            .returning({ id: employees.id })
        : await db
            .insert(employees)
            .values({
              businessId: business.id,
              name: e.name,
              role: e.role,
              pinHash,
              avatarUrl,
              isActive: true,
            })
            .returning({ id: employees.id });
      if (!row) throw new Error(`Failed to upsert employee ${e.name}`);
      return { ...e, id: row.id, avatarUrl };
    }),
  );

  // --- Pre-paired development device ---
  // The plaintext token is printed below — the server stores only its SHA-256 hash.
  const deviceToken = randomBytes(32).toString('base64url');
  const deviceTokenHash = createHash('sha256').update(deviceToken).digest('base64url');

  const [existingDevice] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.businessId, business.id), eq(devices.name, DEMO_DEVICE_NAME)));

  if (existingDevice) {
    await db
      .update(devices)
      .set({ deviceTokenHash, isActive: true, lastSeenAt: new Date() })
      .where(eq(devices.id, existingDevice.id));
  } else {
    await db.insert(devices).values({
      businessId: business.id,
      name: DEMO_DEVICE_NAME,
      type: 'pos_terminal',
      deviceTokenHash,
      isActive: true,
      lastSeenAt: new Date(),
    });
  }

  await db.$client.end();

  console.log('\n✔ Seed completado');
  console.log('  URL:        http://localhost:3000/admin/login');
  console.log(`  Email:      ${DEMO_EMAIL}`);
  console.log(`  Contraseña: ${DEMO_PASSWORD}`);
  console.log('');
  console.log('────────────────────────────────────────────────');
  console.log('  TPV — Token de dispositivo (solo dev):');
  console.log(`  ${deviceToken}`);
  console.log('');
  console.log('  Empleados y PINs:');
  for (const e of createdEmployees) {
    console.log(`    ${e.name.padEnd(16)} PIN: ${e.pin}  role: ${e.role}  id: ${e.id}`);
  }
  console.log('────────────────────────────────────────────────');
  console.log('');
}

main().catch((err) => {
  console.error('Seed falló:', err);
  process.exit(1);
});
