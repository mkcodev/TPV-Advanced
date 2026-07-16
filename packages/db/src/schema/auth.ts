// Server-only tables for the auth subsystem.
// RLS is enabled (deny-all by default) but NO SELECT policy is defined —
// these tables are never exposed to supabase-js clients; only the server
// owner connection reads/writes them via tRPC.

import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { DEVICE_TYPES, businesses, users } from './accounts';
import type { DeviceType } from './accounts';
import { createdAt, id } from './helpers';

export const pairingCodes = pgTable(
  'pairing_codes',
  {
    ...id,
    businessId: uuid('business_id')
      .references(() => businesses.id)
      .notNull(),
    // Stored in cleartext — 6–8 digits with 15-min TTL and single-use make
    // hashing cosmetic (10^8 brute force window << TTL), and cleartext allows
    // re-displaying the code to the admin.
    code: text('code').notNull(),
    deviceName: text('device_name').notNull(),
    deviceType: text('device_type').$type<DeviceType>().notNull(),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    ...createdAt,
  },
  (t) => [index('pairing_codes_code_idx').on(t.code)],
).enableRLS();

export const authRateLimits = pgTable('auth_rate_limits', {
  // Composite key: 'login:{ip}:{deviceId}' or 'pair:{ip}'
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull(),
}).enableRLS();
