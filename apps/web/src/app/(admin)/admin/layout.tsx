import { getAdminUser } from '@/lib/admin/queries.server';
import { AdminTRPCProvider } from '@/lib/trpc/provider';
import { redirect } from 'next/navigation';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();

  if (!user) {
    redirect('/admin/login');
  }

  return <AdminTRPCProvider>{children}</AdminTRPCProvider>;
}
