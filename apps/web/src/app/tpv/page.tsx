'use client';

import { TpvFloorCounterButton } from '@/components/tpv/floor/tpv-floor-counter-button';
import { TpvFloorZoneTabs } from '@/components/tpv/floor/tpv-floor-zone-tabs';
import { TpvEmployeeChip } from '@/components/tpv/tpv-employee-chip';
import { TpvSyncPill } from '@/components/tpv/tpv-sync-pill';
import { useTranslations } from 'next-intl';

export default function TpvFloorPage() {
  const t = useTranslations('tpv.floor');

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <span className="font-semibold text-foreground">{t('title')}</span>
        <div className="flex items-center gap-3">
          <TpvSyncPill />
          <TpvEmployeeChip />
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TpvFloorZoneTabs />
      </div>

      <div className="shrink-0 border-t border-border bg-card p-4">
        <TpvFloorCounterButton />
      </div>
    </div>
  );
}
