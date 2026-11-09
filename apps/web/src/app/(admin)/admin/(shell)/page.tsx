import { QuickAccess } from '@/components/admin/dashboard/quick-access';
import type { NavRole } from '@/lib/admin/nav-config';
import { getUserFullName, listAdminMemberships } from '@/lib/admin/queries.server';
import { getActiveBusinessServer } from '@/lib/business/active.server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';

export default async function AdminDashboardPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const businessId = await getActiveBusinessServer();
  const allMemberships = businessId ? await listAdminMemberships(supabase, user?.id ?? '') : [];
  const currentOrg = allMemberships.find((m) => m.businesses.some((b) => b.id === businessId));
  const role: NavRole = (currentOrg?.role as NavRole) ?? 'staff';
  const fullName = user ? await getUserFullName(supabase, user.id) : null;

  const t = await getTranslations('admin.dashboard');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {fullName ? t('greeting', { name: fullName }) : t('greetingNoName')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <QuickAccess userRole={role} />
    </div>
  );
}
