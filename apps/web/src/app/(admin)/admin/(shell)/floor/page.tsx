import { getActiveBusinessServer } from '@/lib/business/active.server';
import { redirect } from 'next/navigation';
import { FloorClient } from '../../floor/floor-client';

export default async function FloorPage() {
  const businessId = await getActiveBusinessServer();
  if (!businessId) redirect('/admin/select-business');

  return <FloorClient />;
}
