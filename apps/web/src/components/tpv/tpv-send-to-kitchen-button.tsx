'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { UtensilsCrossed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';

export function TpvSendToKitchenButton() {
  const t = useTranslations('tpv.order');
  const { orderId, linesCount, savedTotals } = useOrderStore(
    useShallow((s) => ({
      orderId: s.orderId,
      linesCount: s.lines.length,
      savedTotals: s.savedTotals,
    })),
  );

  const { data } = trpc.orders.getKitchenPayload.useQuery(
    { orderId: orderId ?? '' },
    { enabled: !!orderId && linesCount > 0 && savedTotals !== null },
  );

  const hasPending = (data?.pendingItemIds.length ?? 0) > 0;
  const canSend = !!orderId && linesCount > 0 && savedTotals !== null && hasPending;

  function handleClick() {
    if (!orderId) return;
    window.open(
      `/tpv/order/kitchen/${orderId}`,
      'kitchen',
      'width=500,height=700,menubar=no,toolbar=no',
    );
  }

  if (!canSend) return null;

  return (
    <Button
      variant="outline"
      size="default"
      className="w-full"
      onClick={handleClick}
      aria-label={t('sendToKitchen')}
    >
      <UtensilsCrossed size={16} strokeWidth={1.5} />
      {t('sendToKitchen')}
    </Button>
  );
}
