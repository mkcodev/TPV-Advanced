'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { Button } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PaymentDialog } from './payment/payment-dialog';
import { TpvClearButton } from './tpv-clear-button';
import { TpvOrderHydrator } from './tpv-order-hydrator';
import { TpvOrderLines } from './tpv-order-lines';
import { TpvOrderTotals } from './tpv-order-totals';
import { TpvSaveOrderButton } from './tpv-save-order-button';

export function TpvOrderSidebar() {
  const t = useTranslations('tpv.order');
  const [payOpen, setPayOpen] = useState(false);

  const { linesCount, savedTotals } = useOrderStore(
    useShallow((s) => ({
      linesCount: s.lines.length,
      savedTotals: s.savedTotals,
    })),
  );

  // Cobrar solo cuando la comanda está persistida en servidor.
  const canCharge = linesCount > 0 && savedTotals !== null;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      <TpvOrderHydrator />

      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">{t('title')}</span>
        <TpvClearButton />
      </div>

      {/* Líneas de la comanda */}
      <TpvOrderLines />

      {/* Totales + acciones */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <TpvOrderTotals />
        <div className="mt-3 flex flex-col gap-2">
          <TpvSaveOrderButton />
          <Button
            variant="success"
            size="xl"
            className="w-full"
            disabled={!canCharge}
            aria-label={t('charge')}
            onClick={() => setPayOpen(true)}
          >
            {t('charge')}
          </Button>
        </div>
      </div>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />
    </aside>
  );
}
