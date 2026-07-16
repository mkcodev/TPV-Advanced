'use client';

import { Tabs, TabsList, TabsTrigger } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { TpvContentPlaceholder } from './tpv-content-placeholder';

const NAV_TABS = ['drinks', 'kitchen', 'desserts', 'others'] as const;
type NavTab = (typeof NAV_TABS)[number];

export function TpvNavTabs() {
  const t = useTranslations('tpv.nav');
  const [active, setActive] = useState<NavTab>('drinks');

  return (
    <Tabs
      value={active}
      onValueChange={(v) => setActive(v as NavTab)}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <TabsList className="h-11 shrink-0 rounded-none border-b border-border bg-card px-4 justify-start gap-1">
        {NAV_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="min-h-[44px] px-4 text-sm">
            {t(tab)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TpvContentPlaceholder />
    </Tabs>
  );
}
