import { createHash, randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from '@node-rs/argon2';
// Script de seed para desarrollo. Crea un usuario admin demo con org, negocio,
// memberships, productos de ejemplo, empleados y un device pre-emparejado.
// Idempotente: limpia y recrea los datos demo.
// Uso: pnpm db:seed (desde la raíz) o pnpm --filter @tpv/db db:seed
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '../src/client';
import {
  businesses,
  customers,
  devices,
  employees,
  memberships,
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

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const db = createDb(DATABASE_URL);

  // --- Wipe ---
  const { data: authList } = await supabase.auth.admin.listUsers();
  const existingAuthUser = authList?.users.find((u) => u.email === DEMO_EMAIL);

  if (existingAuthUser) {
    const demoUserId = existingAuthUser.id;

    const demoOrgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ownerUserId, demoUserId));

    const orgIds = demoOrgs.map((o) => o.id);

    if (orgIds.length > 0) {
      const demoBusinesses = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(inArray(businesses.organizationId, orgIds));

      const businessIds = demoBusinesses.map((b) => b.id);

      if (businessIds.length > 0) {
        await db.delete(products).where(inArray(products.businessId, businessIds));
        await db
          .delete(productCategories)
          .where(inArray(productCategories.businessId, businessIds));
        await db.delete(employees).where(inArray(employees.businessId, businessIds));
        await db.delete(devices).where(inArray(devices.businessId, businessIds));
        await db.delete(customers).where(inArray(customers.businessId, businessIds));
      }

      await db.delete(businesses).where(inArray(businesses.organizationId, orgIds));
    }

    await db.delete(memberships).where(eq(memberships.userId, demoUserId));
    await db.delete(organizations).where(eq(organizations.ownerUserId, demoUserId));
    await db.delete(users).where(eq(users.id, demoUserId));
    await supabase.auth.admin.deleteUser(demoUserId);
  }

  // --- Create ---
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(`Auth createUser falló: ${authError?.message}`);
  }

  const userId = authData.user.id;

  await db.insert(users).values({ id: userId, email: DEMO_EMAIL, fullName: 'Admin Demo' });

  const [org] = await db
    .insert(organizations)
    .values({ name: 'Bar Demo SL', ownerUserId: userId })
    .returning({ id: organizations.id });

  const [business] = await db
    .insert(businesses)
    .values({ organizationId: org.id, name: 'Bar Demo', invoiceSeries: 'A2026' })
    .returning({ id: businesses.id });

  await db.insert(memberships).values({ userId, organizationId: org.id, role: 'owner' });

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

  const createdEmployees = await Promise.all(
    employeeData.map(async (e) => {
      const pinHash = await hash(e.pin, ARGON2_OPTIONS);
      const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(e.name)}`;
      const [row] = await db
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
      if (!row) throw new Error(`Failed to insert employee ${e.name}`);
      return { ...e, id: row.id, avatarUrl };
    }),
  );

  // --- Pre-paired development device ---
  // The plaintext token is printed below — the server stores only its SHA-256 hash.
  const deviceToken = randomBytes(32).toString('base64url');
  const deviceTokenHash = createHash('sha256').update(deviceToken).digest('base64url');

  await db.insert(devices).values({
    businessId: business.id,
    name: 'Terminal Demo',
    type: 'pos_terminal',
    deviceTokenHash,
    isActive: true,
    lastSeenAt: new Date(),
  });

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
