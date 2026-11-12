'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

export function TpvSaveOrderButton() {
  const t = useTranslations('tpv.order');
  const { lines, type, tableId, ensureOrderId, hydrateFromServer, savedOrderNumber } =
    useOrderStore(
      useShallow((s) => ({
        lines: s.lines,
        type: s.type,
        tableId: s.tableId,
        ensureOrderId: s.ensureOrderId,
        hydrateFromServer: s.hydrateFromServer,
        savedOrderNumber: s.savedOrderNumber,
      })),
    );

  const { mutate, isPending } = trpc.orders.upsert.useMutation({
    onSuccess: (data) => {
      hydrateFromServer(data);
      toast.success(t('saveSuccess', { number: data.orderNumber }));
    },
    onError: (e) => {
      // Mensajes del servidor que el camarero puede entender; el resto, el genérico.
      if (e.message === 'LINE_LOCKED_USE_VOID') toast.error(t('lineLockedError'));
      else if (e.message === 'LINE_SENT_CANNOT_GROW') toast.error(t('lineSentError'));
      else toast.error(t('saveError'));
    },
  });

  const handleSave = () => {
    if (lines.length === 0) return;
    const orderId = ensureOrderId();
    mutate({
      orderId,
      type,
      ...(tableId !== null ? { tableId } : {}),
      lines: lines.map((l) => ({
        lineId: l.id,
        productId: l.productId,
        quantity: l.quantity,
        ...(l.notes ? { notes: l.notes } : {}),
      })),
    });
  };

  // Guardada y sin cambios: no hay nada que guardar. Cambios = línea nueva o cantidad subida.
  const hasChanges = lines.some(
    (l) => l.savedQuantity === undefined || l.quantity !== l.savedQuantity,
  );
  const isSaved = savedOrderNumber !== null && !hasChanges;

  const label = isSaved
    ? `${t('saved')} #${savedOrderNumber}`
    : savedOrderNumber !== null
      ? `${t('save')} #${savedOrderNumber}`
      : t('save');

  return (
    <Button
      variant="secondary"
      size="xl"
      className="w-full"
      disabled={lines.length === 0 || isPending || isSaved}
      aria-label={label}
      onClick={handleSave}
    >
      {isPending ? t('saving') : label}
    </Button>
  );
}
