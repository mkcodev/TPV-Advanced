import { QuickAccess } from '@/components/admin/dashboard/quick-access';
import type { NavRole } from '@/lib/admin/nav-config';
import {
  getAdminMemberships,
  getAdminUser,
  getRequestSupabase,
  getUserFullName,
} from '@/lib/admin/queries.server';
import { getActiveBusinessServer } from '@/lib/business/active.server';
import { getTranslations } from 'next-intl/server';

export default async function AdminDashboardPage() {
  const user = await getAdminUser();

  const businessId = await getActiveBusinessServer();
  const allMemberships = businessId ? await getAdminMemberships(user?.id ?? '') : [];
  const currentOrg = allMemberships.find((m) => m.businesses.some((b) => b.id === businessId));
  const role: NavRole = (currentOrg?.role as NavRole) ?? 'staff';
  const fullName = user ? await getUserFullName(await getRequestSupabase(), user.id) : null;

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
