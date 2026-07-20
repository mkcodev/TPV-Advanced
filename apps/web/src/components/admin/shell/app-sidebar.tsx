'use client';

import { FOOTER_NAV, NAV_GROUPS, type NavRole } from '@/lib/admin/nav-config';
import { HIDE_SOON_ITEMS } from '@/lib/admin/nav-config';
import { canSeeItem } from '@/lib/admin/roles';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from '@tpv/ui';
import { SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { BusinessSwitcher } from './business-switcher';
import { NavGroup } from './nav-group';
import { UserMenu } from './user-menu';

type Business = { id: string; name: string; timezone: string; currency: string };
type Membership = {
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'staff';
  businesses: Business[];
};

type AppSidebarProps = {
  memberships: Membership[];
  currentBusinessId: string;
  role: NavRole;
  currentUser: { email: string };
};

export function AppSidebar({ memberships, currentBusinessId, role, currentUser }: AppSidebarProps) {
  const t = useTranslations('admin.nav');

  const visibleFooterItems = FOOTER_NAV.filter((item) => {
    if (!canSeeItem(role, item.minRole)) return false;
    if (HIDE_SOON_ITEMS && item.status === 'soon') return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BusinessSwitcher memberships={memberships} currentBusinessId={currentBusinessId} />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.labelKey} group={group} userRole={role} />
        ))}
      </SidebarContent>

      <SidebarFooter>
        {visibleFooterItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarMenu>
              {visibleFooterItems.map((item) => {
                const isSoon = item.status === 'soon';
                return (
                  <SidebarMenuItem key={item.labelKey}>
                    <SidebarMenuButton
                      asChild={!isSoon}
                      aria-disabled={isSoon || undefined}
                      tabIndex={isSoon ? -1 : undefined}
                      tooltip={t(item.labelKey)}
                    >
                      {isSoon ? (
                        <span className="flex items-center gap-2 opacity-60">
                          <item.icon
                            className="h-4 w-4 shrink-0"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          <span>{t(item.labelKey)}</span>
                        </span>
                      ) : (
                        <Link href={item.href}>
                          <item.icon
                            className="h-4 w-4 shrink-0"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                    {isSoon && (
                      <SidebarMenuBadge className="text-muted-foreground/60 text-[10px]">
                        {t('soonBadge')}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </>
        )}
        <UserMenu email={currentUser.email} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
