import {
  FOOTER_NAV,
  HIDE_SOON_ITEMS,
  NAV_GROUPS,
  type NavItem,
  type NavRole,
} from '@/lib/admin/nav-config';
import { canSeeItem } from '@/lib/admin/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const QUICK_ITEM_KEYS = ['catalog', 'floor', 'orders', 'employees'] as const;

type QuickAccessProps = { userRole: NavRole };

function QuickCard({ item }: { item: NavItem }) {
  const t = useTranslations('admin.dashboard.quickAccess');
  const isSoon = item.status === 'soon';

  const card = (
    <Card
      className={
        isSoon ? 'cursor-default opacity-60' : 'cursor-pointer transition-colors hover:bg-accent'
      }
      aria-disabled={isSoon || undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
            <item.icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <CardTitle className="text-base">{t(`${item.labelKey}.title`)}</CardTitle>
          {isSoon && (
            <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Pronto
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t(`${item.labelKey}.description`)}</p>
      </CardContent>
    </Card>
  );

  if (isSoon) return card;
  return (
    <Link href={item.href} className="block">
      {card}
    </Link>
  );
}

export function QuickAccess({ userRole }: QuickAccessProps) {
  const allItems = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV];

  const cards = QUICK_ITEM_KEYS.map((key) => allItems.find((i) => i.labelKey === key))
    .filter((i): i is NavItem => Boolean(i))
    .filter((i) => canSeeItem(userRole, i.minRole))
    .filter((i) => !HIDE_SOON_ITEMS || i.status === 'ready');

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((item) => (
        <QuickCard key={item.labelKey} item={item} />
      ))}
    </div>
  );
}
