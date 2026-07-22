'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

export function TpvSaveOrderButton() {
  const t = useTranslations('tpv.order');
  const { lines, ensureOrderId, hydrateFromServer, savedOrderNumber } = useOrderStore(
    useShallow((s) => ({
      lines: s.lines,
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
      toast.error(e.message || t('saveError'));
    },
  });

  const handleSave = () => {
    if (lines.length === 0) return;
    const orderId = ensureOrderId();
    mutate({
      orderId,
      type: 'counter',
      lines: lines.map((l) => ({
        lineId: l.id,
        productId: l.productId,
        quantity: l.quantity,
        ...(l.notes ? { notes: l.notes } : {}),
      })),
    });
  };

  const label = savedOrderNumber !== null ? `${t('save')} #${savedOrderNumber}` : t('save');

  return (
    <Button
      variant="secondary"
      size="xl"
      className="w-full"
      disabled={lines.length === 0 || isPending}
      aria-label={label}
      onClick={handleSave}
    >
      {isPending ? t('saving') : label}
    </Button>
  );
}
