'use client';

import { type FloorTableRect, hasUsableLayout, layoutFloor } from '@/lib/floor/floor-layout';
import { useOrderStore } from '@/lib/stores/use-order-store';
import { elapsedMinutes, tableVisualState } from '@/lib/tpv/floor-state';
import { trpc } from '@/lib/trpc/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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

  // Medida del contenedor del plano (se re-mide al redimensionar la ventana/tablet).
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (container === null) return;
    const measure = () => setSize({ width: container.clientWidth, height: container.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  const rects = useMemo<FloorTableRect[]>(
    () =>
      tables.map((table) => ({
        id: table.id,
        posX: table.posX,
        posY: table.posY,
        width: table.width,
        height: table.height,
        shape: table.shape as 'square' | 'round',
      })),
    [tables],
  );
  const layout = useMemo(() => layoutFloor(rects, size), [rects, size]);

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

  function renderTable(table: (typeof tables)[number]) {
    return (
      <TpvFloorTable
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
    );
  }

  // Mesas nunca colocadas (apiladas): lista de siempre + aviso, hasta que se ordenen en el admin.
  if (!hasUsableLayout(rects)) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">{t('unplacedHint')}</p>
        <div className="flex flex-wrap gap-4">
          {tables.map((table) => (
            <div key={table.id}>{renderTable(table)}</div>
          ))}
        </div>
      </div>
    );
  }

  // Plano por posición: ocupa todo el hueco (el padre es `relative`) y se escala para caber.
  const byId = new Map(tables.map((table) => [table.id, table]));
  return (
    <div ref={setContainer} className="absolute inset-4">
      {layout.boxes.map((box) => {
        const table = byId.get(box.id);
        if (table === undefined) return null;
        return (
          <div
            key={box.id}
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${box.x}px, ${box.y}px)`,
              width: box.width,
              height: box.height,
            }}
          >
            {renderTable(table)}
          </div>
        );
      })}
    </div>
  );
}
