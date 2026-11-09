'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { Separator } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { TpvCashChip } from './cash/tpv-cash-chip';
import { TpvBackToFloorButton } from './floor/tpv-back-to-floor-button';
import { TpvEmployeeChip } from './tpv-employee-chip';
import { TpvSyncPill } from './tpv-sync-pill';

export function TpvHeader() {
  const t = useTranslations('tpv');
  const { type, tableName, zoneName } = useOrderStore(
    useShallow((s) => ({ type: s.type, tableName: s.tableName, zoneName: s.zoneName })),
  );

  // El nombre del negocio casi nunca cambia: se pide una vez por sesión. Mientras carga,
  // texto vacío (mejor que parpadear con un nombre falso).
  const { data: business } = trpc.business.getName.useQuery(undefined, { staleTime: Infinity });

  const isTableOrder = type === 'dine_in';
  const contextLabel =
    isTableOrder && tableName
      ? zoneName
        ? t('floor.orderContext', { name: tableName, zone: zoneName })
        : t('floor.tableLabel', { name: tableName })
      : (business?.name ?? '');

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <TpvBackToFloorButton />

      <Separator orientation="vertical" className="h-6" />

      <span className="font-semibold text-foreground truncate">{contextLabel}</span>

      <TpvSyncPill />

      <div className="ml-auto flex items-center gap-2">
        <TpvCashChip />
        <TpvEmployeeChip />
      </div>
    </header>
  );
}
