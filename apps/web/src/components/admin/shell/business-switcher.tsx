'use client';

import { setActiveBusinessClient } from '@/lib/business/active';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@tpv/ui';
import { ChevronsUpDown, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type Business = { id: string; name: string; timezone: string; currency: string };
type Membership = {
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'staff';
  businesses: Business[];
};

type BusinessSwitcherProps = {
  memberships: Membership[];
  currentBusinessId: string;
};

export function BusinessSwitcher({ memberships, currentBusinessId }: BusinessSwitcherProps) {
  const t = useTranslations('admin.nav');
  const router = useRouter();

  const allBusinesses = memberships.flatMap((m) => m.businesses);
  const currentBusiness = allBusinesses.find((b) => b.id === currentBusinessId) ?? allBusinesses[0];
  const currentOrg = memberships.find((m) => m.businesses.some((b) => b.id === currentBusinessId));

  function handleSelect(businessId: string) {
    if (businessId === currentBusinessId) return;
    setActiveBusinessClient(businessId);
    router.refresh();
    router.push('/admin');
  }

  if (!currentBusiness) return null;

  // Single business — static display, no dropdown
  if (allBusinesses.length === 1) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
              <Store className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{currentBusiness.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {currentOrg?.organizationName}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Multiple businesses — dropdown
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                <Store className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{currentBusiness.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {currentOrg?.organizationName}
                </span>
              </div>
              <ChevronsUpDown
                className="ml-auto h-4 w-4 shrink-0"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            {memberships.map((org) => (
              <div key={org.organizationId}>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {org.organizationName}
                </DropdownMenuLabel>
                {org.businesses.map((business) => (
                  <DropdownMenuItem
                    key={business.id}
                    onClick={() => handleSelect(business.id)}
                    className="cursor-pointer gap-2"
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-sm border bg-sidebar-accent">
                      <Store
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </div>
                    {business.name}
                    {business.id === currentBusinessId && (
                      <span className="ml-auto text-xs text-muted-foreground">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
