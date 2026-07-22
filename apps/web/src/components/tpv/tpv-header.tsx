'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { Separator } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { TpvBackToFloorButton } from './floor/tpv-back-to-floor-button';
import { TpvEmployeeChip } from './tpv-employee-chip';
import { TpvSyncPill } from './tpv-sync-pill';

export function TpvHeader() {
  const t = useTranslations('tpv');
  const { type, tableName, zoneName } = useOrderStore((s) => ({
    type: s.type,
    tableName: s.tableName,
    zoneName: s.zoneName,
  }));

  const isTableOrder = type === 'dine_in';
  const contextLabel =
    isTableOrder && tableName
      ? zoneName
        ? t('floor.orderContext', { name: tableName, zone: zoneName })
        : t('floor.tableLabel', { name: tableName })
      : t('header.businessName');

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      {isTableOrder ? (
        <TpvBackToFloorButton />
      ) : (
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            T
          </div>
        </div>
      )}

      <Separator orientation="vertical" className="h-6" />

      <span className="font-semibold text-foreground truncate">{contextLabel}</span>

      <TpvSyncPill />

      <div className="ml-auto">
        <TpvEmployeeChip />
      </div>
    </header>
  );
}
