import { BlindCashCloseSetting } from '@/components/admin/settings/blind-cash-close-setting';
import { getActiveBusinessServer } from '@/lib/business/active.server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const businessId = await getActiveBusinessServer();
  if (!businessId) redirect('/admin/select-business');

  const t = await getTranslations('admin.settings');

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <section className="flex flex-col gap-3" aria-labelledby="settings-cash-title">
        <h2 id="settings-cash-title" className="text-lg font-medium">
          {t('cash.title')}
        </h2>
        <BlindCashCloseSetting />
      </section>
    </div>
  );
}
