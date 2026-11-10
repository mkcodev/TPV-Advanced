import { EmployeesPanel } from '@/components/admin/employees/employees-panel';
import { getActiveBusinessServer } from '@/lib/business/active.server';
import { redirect } from 'next/navigation';

export default async function EmployeesPage() {
  const businessId = await getActiveBusinessServer();
  if (!businessId) redirect('/admin/select-business');

  return (
    <div className="max-w-4xl">
      <EmployeesPanel />
    </div>
  );
}
