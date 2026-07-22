import { getSupabaseServer } from '@/lib/supabase/server';
import { AdminTRPCProvider } from '@/lib/trpc/provider';
import { redirect } from 'next/navigation';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  return <AdminTRPCProvider>{children}</AdminTRPCProvider>;
}
