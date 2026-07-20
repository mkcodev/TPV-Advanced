import { getActiveBusinessServer } from '@/lib/business/active.server';
import { redirect } from 'next/navigation';
import { CatalogClient } from '../../catalog/catalog-client';

export default async function CatalogPage() {
  const businessId = await getActiveBusinessServer();
  if (!businessId) redirect('/admin/select-business');

  return <CatalogClient />;
}
