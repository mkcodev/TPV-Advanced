'use client';

import {
  HIDE_SOON_ITEMS,
  type NavGroup as NavGroupConfig,
  type NavRole,
} from '@/lib/admin/nav-config';
import { canSeeItem } from '@/lib/admin/roles';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { SlidingIndicator } from './sliding-indicator';

type NavGroupProps = {
  group: NavGroupConfig;
  userRole: NavRole;
};

export function NavGroup({ group, userRole }: NavGroupProps) {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const menuRef = React.useRef<HTMLUListElement>(null);

  const visibleItems = group.items.filter((item) => {
    if (!canSeeItem(userRole, item.minRole)) return false;
    if (HIDE_SOON_ITEMS && item.status === 'soon') return false;
    return true;
  });

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t(`groups.${group.labelKey}`)}</SidebarGroupLabel>
      <div className="relative">
        <SlidingIndicator
          containerRef={menuRef as React.RefObject<HTMLElement | null>}
          activeSelector="[data-active='true']"
          hoverSelector="[data-slot='sidebar-menu-button']"
        />
        <SidebarMenu ref={menuRef}>
          {visibleItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isSoon = item.status === 'soon';

            return (
              <SidebarMenuItem key={item.labelKey}>
                <SidebarMenuButton
                  asChild={!isSoon}
                  isActive={isActive}
                  aria-current={isActive ? 'page' : undefined}
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
      </div>
    </SidebarGroup>
  );
}
