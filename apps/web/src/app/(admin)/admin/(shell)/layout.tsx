import { AppSidebar } from '@/components/admin/shell/app-sidebar';
import { ContentHeader } from '@/components/admin/shell/content-header';
import type { NavRole } from '@/lib/admin/nav-config';
import { getAdminMemberships, getAdminUser } from '@/lib/admin/queries.server';
import { getActiveBusinessServer } from '@/lib/business/active.server';
import { SidebarInset, SidebarProvider } from '@tpv/ui';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect('/admin/login');

  const businessId = await getActiveBusinessServer();
  if (!businessId) redirect('/admin/select-business');

  const allMemberships = await getAdminMemberships(user.id);
  const currentOrg = allMemberships.find((m) => m.businesses.some((b) => b.id === businessId));
  if (!currentOrg) redirect('/admin/select-business');

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        memberships={allMemberships}
        currentBusinessId={businessId}
        role={currentOrg.role as NavRole}
        currentUser={{ email: user.email ?? '' }}
      />
      <SidebarInset>
        <ContentHeader />
        <div className="flex flex-1 flex-col gap-4 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
