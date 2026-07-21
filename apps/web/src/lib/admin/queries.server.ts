import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

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

// Uses the user's Supabase client (with JWT) so auth.uid() resolves correctly
// in RLS policies. Direct drizzle connections bypass Supabase auth context.
export async function listAdminMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminMembership[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select(
      'role, organization_id, organizations(id, name, businesses(id, name, timezone, currency))',
    )
    .eq('user_id', userId);

  if (error) {
    console.error('[listAdminMemberships] query failed:', error);
    return [];
  }

  const result: AdminMembership[] = [];
  for (const row of data ?? []) {
    const org = row.organizations as unknown as {
      id: string;
      name: string;
      businesses?: AdminBusiness[];
    } | null;
    if (!org) continue;
    result.push({
      organizationId: org.id,
      organizationName: org.name,
      role: row.role as AdminMembership['role'],
      businesses: (org.businesses ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        timezone: b.timezone,
        currency: b.currency,
      })),
    });
  }
  return result;
}
