import { Button } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { TpvClearButton } from './tpv-clear-button';
import { TpvOrderLines } from './tpv-order-lines';
import { TpvOrderTotals } from './tpv-order-totals';

export function TpvOrderSidebar() {
  const t = useTranslations('tpv.order');

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">{t('title')}</span>
        <TpvClearButton />
      </div>

      {/* Líneas de la comanda */}
      <TpvOrderLines />

      {/* Totales + Cobrar */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <TpvOrderTotals />
        <Button variant="success" size="xl" className="mt-3 w-full" aria-label={t('charge')}>
          {t('charge')}
        </Button>
      </div>
    </aside>
  );
}
