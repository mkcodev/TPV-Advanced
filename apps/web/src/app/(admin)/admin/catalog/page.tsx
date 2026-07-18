import { getActiveBusinessServer } from '@/lib/business/active';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { CatalogClient } from './catalog-client';

export default async function CatalogPage() {
  const businessId = await getActiveBusinessServer();
  if (!businessId) redirect('/admin/select-business');

  const t = await getTranslations('admin.catalog');

  return (
    <main className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <CatalogClient />
    </main>
  );
}
