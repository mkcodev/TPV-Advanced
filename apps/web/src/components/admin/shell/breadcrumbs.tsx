'use client';

import { FOOTER_NAV, NAV_GROUPS } from '@/lib/admin/nav-config';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations('admin.nav');

  // segments: '' / 'admin' / 'catalog' / ...
  const segments = pathname.split('/').filter(Boolean);
  // Build paths: '/admin', '/admin/catalog', ...
  const crumbs = segments.map((seg, i) => {
    const href = `/${segments.slice(0, i + 1).join('/')}`;
    const navItem = ALL_ITEMS.find((item) => item.href === href);
    const label = navItem ? t(navItem.labelKey) : capitalize(seg);
    return { href, label };
  });

  if (crumbs.length <= 1) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <BreadcrumbItem key={crumb.href}>
              {i > 0 && <BreadcrumbSeparator />}
              {isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
