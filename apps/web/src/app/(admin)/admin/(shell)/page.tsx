import { QuickAccess } from '@/components/admin/dashboard/quick-access';
import type { NavRole } from '@/lib/admin/nav-config';
import { listAdminMemberships } from '@/lib/admin/queries.server';
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
  const currentBusiness = currentOrg?.businesses.find((b) => b.id === businessId);
  const role: NavRole = (currentOrg?.role as NavRole) ?? 'staff';

  const t = await getTranslations('admin.dashboard');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('greeting', { name: currentBusiness?.name ?? '' })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <QuickAccess userRole={role} />
    </div>
  );
}
