'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { formatCents, lineTotalCents, orderTaxBreakdown } from '@tpv/core';
import { Separator } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';

export function TpvOrderTotals() {
  const t = useTranslations('tpv.order');
  // Suscribir a lines con shallow: re-render solo cuando cambia contenido del array,
  // no en cada render. Evita el bucle de getBreakdown() que crea un nuevo objeto siempre.
  const lines = useOrderStore(useShallow((s) => s.lines));
  const breakdown = orderTaxBreakdown(
    lines.map((l) => ({
      grossCents: lineTotalCents(l.unitPriceCents, l.quantity),
      taxRate: l.taxRate,
    })),
  );

  return (
    <div className="space-y-1.5 tabular-nums">
      {/* Subtotal */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{t('subtotal')}</span>
        <span>{formatCents(breakdown.subtotalCents)}</span>
      </div>

      {/* Desglose de IVA por tipo */}
      {breakdown.buckets.map((bucket) => (
        <div key={bucket.taxRate} className="flex justify-between text-sm text-muted-foreground">
          <span>{t('tax', { rate: bucket.taxRate })}</span>
          <span>{formatCents(bucket.taxCents)}</span>
        </div>
      ))}

      <Separator className="my-2" />

      {/* Total con tick animado (S10) */}
      <div className="flex justify-between text-base font-semibold text-foreground">
        <span>{t('total')}</span>
        <span key={breakdown.totalCents} className="tpv-tick">
          {formatCents(breakdown.totalCents)}
        </span>
      </div>
    </div>
  );
}
