import {
  BarChart3,
  BookOpenText,
  Coins,
  FileText,
  Home,
  LayoutGrid,
  MonitorSmartphone,
  Package,
  Receipt,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavStatus = 'ready' | 'soon';
export type NavRole = 'owner' | 'admin' | 'staff';

export type NavItem = {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  status: NavStatus;
  minRole: NavRole;
};

export type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

export const HIDE_SOON_ITEMS = false;

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'operation',
    items: [
      { labelKey: 'home', href: '/admin', icon: Home, status: 'ready', minRole: 'staff' },
      {
        labelKey: 'catalog',
        href: '/admin/catalog',
        icon: BookOpenText,
        status: 'ready',
        minRole: 'admin',
      },
      {
        labelKey: 'floor',
        href: '/admin/floor',
        icon: LayoutGrid,
        status: 'ready',
        minRole: 'admin',
      },
      {
        labelKey: 'orders',
        href: '/admin/orders',
        icon: Receipt,
        status: 'soon',
        minRole: 'staff',
      },
      {
        labelKey: 'cashbox',
        href: '/admin/cashbox',
        icon: Coins,
        status: 'soon',
        minRole: 'staff',
      },
    ],
  },
  {
    labelKey: 'management',
    items: [
      {
        labelKey: 'employees',
        href: '/admin/employees',
        icon: Users,
        status: 'soon',
        minRole: 'admin',
      },
      {
        labelKey: 'devices',
        href: '/admin/devices',
        icon: MonitorSmartphone,
        status: 'soon',
        minRole: 'admin',
      },
      {
        labelKey: 'inventory',
        href: '/admin/inventory',
        icon: Package,
        status: 'soon',
        minRole: 'admin',
      },
      {
        labelKey: 'customers',
        href: '/admin/customers',
        icon: UserRound,
        status: 'soon',
        minRole: 'admin',
      },
    ],
  },
  {
    labelKey: 'analysis',
    items: [
      {
        labelKey: 'reports',
        href: '/admin/reports',
        icon: BarChart3,
        status: 'soon',
        minRole: 'admin',
      },
      {
        labelKey: 'billing',
        href: '/admin/billing',
        icon: FileText,
        status: 'soon',
        minRole: 'owner',
      },
    ],
  },
];

export const FOOTER_NAV: NavItem[] = [
  {
    labelKey: 'settings',
    href: '/admin/settings',
    icon: Settings,
    status: 'soon',
    minRole: 'admin',
  },
];
