import 'server-only';

import { getDb } from '@/lib/db.server';
import { businesses, memberships, organizations } from '@tpv/db';
import { eq } from 'drizzle-orm';

export type AdminBusiness = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
};

export type AdminMembership = {
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'staff';
  businesses: AdminBusiness[];
};

export async function listAdminMemberships(userId: string): Promise<AdminMembership[]> {
  const db = getDb();
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      role: memberships.role,
      businessId: businesses.id,
      businessName: businesses.name,
      timezone: businesses.timezone,
      currency: businesses.currency,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .innerJoin(businesses, eq(businesses.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));

  const orgMap = new Map<string, AdminMembership>();
  for (const row of rows) {
    if (!orgMap.has(row.organizationId)) {
      orgMap.set(row.organizationId, {
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        role: row.role as AdminMembership['role'],
        businesses: [],
      });
    }
    orgMap.get(row.organizationId)?.businesses.push({
      id: row.businessId,
      name: row.businessName,
      timezone: row.timezone,
      currency: row.currency,
    });
  }

  return [...orgMap.values()];
}
