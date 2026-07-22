'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { TpvFloorTable } from './tpv-floor-table';

type Props = { zoneId: string; zoneName: string };

export function TpvFloorView({ zoneId, zoneName }: Props) {
  const t = useTranslations('tpv.floor');
  const router = useRouter();
  const setActiveTable = useOrderStore((s) => s.setActiveTable);

  const { data, isLoading } = trpc.floor.tables.listWithOpenOrders.useQuery(
    { zoneId },
    { refetchOnMount: true },
  );
  const tables = data ?? [];

  function handleTablePress(tableId: string, tableZoneId: string, tableName: string) {
    setActiveTable(tableId, tableZoneId, tableName, zoneName);
    router.push('/tpv/order');
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('free')}</p>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">{t('emptyZone')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 p-4">
      {tables.map((table) => (
        <TpvFloorTable
          key={table.id}
          id={table.id}
          name={table.name}
          seats={table.seats}
          shape={table.shape as 'square' | 'round'}
          openOrderId={table.openOrderId ?? null}
          onClick={() => handleTablePress(table.id, table.zoneId, table.name)}
        />
      ))}
    </div>
  );
}
