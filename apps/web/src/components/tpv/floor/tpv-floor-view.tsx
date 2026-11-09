'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { elapsedMinutes, tableVisualState } from '@/lib/tpv/floor-state';
import { trpc } from '@/lib/trpc/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TpvFloorTable } from './tpv-floor-table';

type Props = { zoneId: string; zoneName: string };

// El plano se refresca solo: cambios de otros camareros/cajas aparecen sin recargar.
const FLOOR_REFETCH_MS = 15_000;
// El "tiempo abierta" se repinta cada 30 s (minutos enteros: no hace falta más fino).
const CLOCK_TICK_MS = 30_000;

export function TpvFloorView({ zoneId, zoneName }: Props) {
  const t = useTranslations('tpv.floor');
  const router = useRouter();
  const setActiveTable = useOrderStore((s) => s.setActiveTable);

  const { data, isLoading } = trpc.floor.tables.listWithOpenOrders.useQuery(
    { zoneId },
    { refetchOnMount: true, refetchInterval: FLOOR_REFETCH_MS, refetchOnWindowFocus: true },
  );
  const tables = data ?? [];

  // Solo para MOSTRAR el tiempo abierta. Los importes vienen del servidor, no se calculan aquí.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

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
          state={tableVisualState(table)}
          pendingCents={table.pendingCents}
          elapsedMinutes={table.openedAt === null ? null : elapsedMinutes(table.openedAt, now)}
          employeeName={table.employeeName}
          onClick={() => handleTablePress(table.id, table.zoneId, table.name)}
        />
      ))}
    </div>
  );
}
