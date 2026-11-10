import { DevicesPanel } from '@/components/admin/devices/devices-panel';
import { getActiveBusinessServer } from '@/lib/business/active.server';
import { redirect } from 'next/navigation';

export default async function DevicesPage() {
  const businessId = await getActiveBusinessServer();
  if (!businessId) redirect('/admin/select-business');

  return (
    <div className="max-w-4xl">
      <DevicesPanel />
    </div>
  );
}
