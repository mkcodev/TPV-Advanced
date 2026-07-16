// Módulo 1 — Cuentas y multi-tenant.
// Fuente de verdad: docs/DATABASE-SCHEMA.md (módulo 1).
// Nota: las relations inversas hacia módulos posteriores (businesses→orders, etc.)
// se omiten a propósito para evitar ciclos de import; consulta desde el lado del FK.

import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, inEnum, selectPolicy, tenantSelectPolicy, timestamps } from './helpers';

export const SUBSCRIPTION_PLANS = ['free', 'basic', 'pro'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const VERIFACTU_MODES = ['verifactu', 'no_verifactu', 'disabled'] as const;
export type VerifactuMode = (typeof VERIFACTU_MODES)[number];

export const MEMBERSHIP_ROLES = ['owner', 'admin', 'staff'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const EMPLOYEE_ROLES = ['admin', 'manager', 'worker'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const DEVICE_TYPES = ['pos_terminal', 'waiter_tablet', 'kds', 'printer'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const TIME_ENTRY_SOURCES = ['pin', 'admin', 'auto'] as const;
export type TimeEntrySource = (typeof TIME_ENTRY_SOURCES)[number];

// Perfil público de quien entra al panel admin.
// id = auth.users.id de Supabase Auth (por eso NO lleva defaultRandom):
// la fila se crea a partir del usuario que ya existe en auth.
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    fullName: text('full_name'),
    email: text('email').notNull(),
    avatarUrl: text('avatar_url'),
    ...timestamps,
  },
  // Cada usuario solo ve su propio perfil.
  () => [selectPolicy('users', sql`id = (select auth.uid())`)],
);

export const organizations = pgTable(
  'organizations',
  {
    ...id,
    name: text('name').notNull(),
    ownerUserId: uuid('owner_user_id')
      .references(() => users.id)
      .notNull(),
    subscriptionPlan: text('subscription_plan').$type<SubscriptionPlan>().default('free').notNull(),
    subscriptionStatus: text('subscription_status')
      .$type<SubscriptionStatus>()
      .default('trialing')
      .notNull(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check('organizations_subscription_plan_check', inEnum(t.subscriptionPlan, SUBSCRIPTION_PLANS)),
    check(
      'organizations_subscription_status_check',
      inEnum(t.subscriptionStatus, SUBSCRIPTION_STATUSES),
    ),
    selectPolicy('organizations', sql`id in (select public.user_organization_ids())`),
  ],
);

export const businesses = pgTable(
  'businesses',
  {
    ...id,
    organizationId: uuid('organization_id')
      .references(() => organizations.id)
      .notNull(),
    name: text('name').notNull(),
    // Datos fiscales: nullable en BD porque se completan en el onboarding.
    // Al emitir factura son OBLIGATORIOS — validar su presencia en Fase 1/2.
    legalName: text('legal_name'),
    taxId: text('tax_id'),
    address: text('address'),
    city: text('city'),
    postalCode: text('postal_code'),
    province: text('province'),
    country: text('country').default('ES').notNull(),
    phone: text('phone'),
    email: text('email'),
    logoUrl: text('logo_url'),
    timezone: text('timezone').default('Europe/Madrid').notNull(),
    currency: text('currency').default('EUR').notNull(),
    verifactuMode: text('verifactu_mode').$type<VerifactuMode>().default('disabled').notNull(),
    invoiceSeries: text('invoice_series'), // incluye el año (ej. 'A2027'); rotación anual
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    check('businesses_verifactu_mode_check', inEnum(t.verifactuMode, VERIFACTU_MODES)),
    // El id de businesses ES el business_id del predicado.
    selectPolicy('businesses', sql`public.has_business_access(id)`),
  ],
);

export const memberships = pgTable(
  'memberships',
  {
    ...id,
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id)
      .notNull(),
    role: text('role').$type<MembershipRole>().notNull(),
    ...createdAt,
  },
  (t) => [
    unique('memberships_user_organization_unique').on(t.userId, t.organizationId),
    check('memberships_role_check', inEnum(t.role, MEMBERSHIP_ROLES)),
    // Las propias + las de compañeros de organización (para listar el equipo).
    selectPolicy(
      'memberships',
      sql`user_id = (select auth.uid()) or organization_id in (select public.user_organization_ids())`,
    ),
  ],
);

export const employees = pgTable(
  'employees',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    userId: uuid('user_id').references(() => users.id), // si además tiene acceso al panel
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    pinHash: text('pin_hash').notNull(), // PIN hasheado (argon2/bcrypt), nunca en claro
    role: text('role').$type<EmployeeRole>().default('worker').notNull(),
    hourlyWageCents: integer('hourly_wage_cents'),
    failedPinAttempts: integer('failed_pin_attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index('employees_business_id_idx').on(t.businessId),
    check('employees_role_check', inEnum(t.role, EMPLOYEE_ROLES)),
    // Además de la política, 0001 restringe por GRANT las columnas visibles
    // (pin_hash y datos laborales nunca llegan a un cliente supabase-js).
    tenantSelectPolicy('employees'),
  ],
);

// Obligatorio para Veri*factu: qué dispositivo emitió cada ticket.
export const devices = pgTable(
  'devices',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    name: text('name').notNull(),
    type: text('type').$type<DeviceType>().notNull(),
    // SHA-256 base64url of the opaque device token. Null = revoked.
    // The cleartext token is returned only once at pairing time.
    deviceTokenHash: text('device_token_hash').unique(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index('devices_business_id_idx').on(t.businessId),
    check('devices_type_check', inEnum(t.type, DEVICE_TYPES)),
    tenantSelectPolicy('devices'),
  ],
);

export const customers = pgTable(
  'customers',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    name: text('name').notNull(),
    taxId: text('tax_id'),
    address: text('address'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [index('customers_business_id_idx').on(t.businessId), tenantSelectPolicy('customers')],
);

// Registro de jornada (RD-ley 8/2019) — append-only: nunca UPDATE/DELETE.
// La inmutabilidad se refuerza en app/RLS/triggers en fases posteriores.
export const timeEntries = pgTable(
  'time_entries',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    employeeId: uuid('employee_id')
      .references(() => employees.id)
      .notNull(),
    deviceId: uuid('device_id').references(() => devices.id),
    clockIn: timestamp('clock_in', { withTimezone: true }).notNull(),
    clockOut: timestamp('clock_out', { withTimezone: true }), // null si sigue dentro
    source: text('source').$type<TimeEntrySource>().notNull(),
    notes: text('notes'),
    ...createdAt,
  },
  (t) => [
    index('time_entries_business_id_idx').on(t.businessId),
    index('time_entries_employee_id_idx').on(t.employeeId),
    check('time_entries_source_check', inEnum(t.source, TIME_ENTRY_SOURCES)),
    tenantSelectPolicy('time_entries'),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  ownedOrganizations: many(organizations),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerUserId], references: [users.id] }),
  memberships: many(memberships),
  businesses: many(businesses),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [businesses.organizationId],
    references: [organizations.id],
  }),
  employees: many(employees),
  devices: many(devices),
  customers: many(customers),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  business: one(businesses, { fields: [employees.businessId], references: [businesses.id] }),
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  timeEntries: many(timeEntries),
}));

export const devicesRelations = relations(devices, ({ one }) => ({
  business: one(businesses, { fields: [devices.businessId], references: [businesses.id] }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  business: one(businesses, { fields: [customers.businessId], references: [businesses.id] }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  business: one(businesses, { fields: [timeEntries.businessId], references: [businesses.id] }),
  employee: one(employees, { fields: [timeEntries.employeeId], references: [employees.id] }),
  device: one(devices, { fields: [timeEntries.deviceId], references: [devices.id] }),
}));
