import { getActiveBusinessServer } from '@/lib/business/active.server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function AdminDashboardPage() {
  const businessId = await getActiveBusinessServer();
  if (!businessId) {
    redirect('/admin/select-business');
  }

  const t = await getTranslations('admin.dashboard');

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
    </main>
  );
}
