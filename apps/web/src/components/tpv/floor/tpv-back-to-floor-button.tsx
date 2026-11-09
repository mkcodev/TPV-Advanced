'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { markTableOccupied, saveAndSyncFloor } from '@/lib/tpv/floor-state';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

export function TpvBackToFloorButton() {
  const t = useTranslations('tpv.floor');
  const router = useRouter();
  const utils = trpc.useUtils();

  const { lines, type, tableId, tableName, zoneId, ensureOrderId } = useOrderStore(
    useShallow((s) => ({
      lines: s.lines,
      type: s.type,
      tableId: s.tableId,
      tableName: s.tableName,
      zoneId: s.zoneId,
      ensureOrderId: s.ensureOrderId,
    })),
  );

  async function handleBack() {
    // Barra: no se guarda nada al salir. Sus líneas quedan en la sesión local del store
    // (se aparca al abrir una mesa y se recupera al volver a pulsar "Barra").
    if (lines.length === 0 || type !== 'dine_in' || tableId === null || zoneId === null) {
      router.push('/tpv');
      return;
    }

    const orderId = ensureOrderId();
    const floorKey = { zoneId };
    // Cortamos un refetch en vuelo del plano: si llegara tarde pisaría la mesa pintada.
    await utils.floor.tables.listWithOpenOrders.cancel(floorKey);

    // Navegamos ya; el guardado sigue en segundo plano PERO con resultado controlado:
    // la mesa se pinta ocupada al instante, se refresca al terminar y, si falla, vuelve a
    // su estado real con un aviso visible. Las líneas siguen en el store local (no se pierden).
    // Usamos utils.client (no useMutation) porque este botón se desmonta al navegar y sus
    // callbacks ya no correrían.
    router.push('/tpv');
    void saveAndSyncFloor({
      snapshot: utils.floor.tables.listWithOpenOrders.getData(floorKey),
      optimistic: (current) => markTableOccupied(current, tableId, orderId, new Date()),
      setData: (data) => utils.floor.tables.listWithOpenOrders.setData(floorKey, data),
      save: () =>
        utils.client.orders.upsert.mutate({
          orderId,
          type,
          tableId,
          lines: lines.map((l) => ({
            lineId: l.id,
            productId: l.productId,
            quantity: l.quantity,
            ...(l.notes ? { notes: l.notes } : {}),
          })),
        }),
      invalidate: () => utils.floor.tables.listWithOpenOrders.invalidate(floorKey),
      notifyError: () => toast.error(t('saveFailed', { name: tableName ?? '' })),
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
      <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
      {t('backToFloor')}
    </Button>
  );
}
