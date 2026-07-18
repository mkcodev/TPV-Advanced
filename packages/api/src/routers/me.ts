import { businesses, memberships, organizations } from '@tpv/db';
import { eq } from 'drizzle-orm';
import { adminAuthedProcedure, router } from '../trpc';

export const meRouter = router({
  listMemberships: adminAuthedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
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
      .where(eq(memberships.userId, ctx.userId));

    const orgMap = new Map<
      string,
      {
        organizationId: string;
        organizationName: string;
        role: (typeof rows)[0]['role'];
        businesses: { id: string; name: string; timezone: string; currency: string }[];
      }
    >();

    for (const row of rows) {
      if (!orgMap.has(row.organizationId)) {
        orgMap.set(row.organizationId, {
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          role: row.role,
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
  }),
});
