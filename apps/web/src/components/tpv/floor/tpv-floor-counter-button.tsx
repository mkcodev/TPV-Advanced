'use client';

import { type OrderLine, useOrderStore } from '@/lib/stores/use-order-store';
import { counterSummary } from '@/lib/tpv/floor-state';
import { formatCents } from '@tpv/core';
import { Button } from '@tpv/ui';
import { ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

// Referencia estable para el selector (evita re-renders por un array nuevo en cada lectura).
const NO_LINES: OrderLine[] = [];

export function TpvFloorCounterButton() {
  const t = useTranslations('tpv.floor');
  const router = useRouter();
  const setActiveCounter = useOrderStore((s) => s.setActiveCounter);

  // Líneas de la venta rápida de barra: están en la sesión activa si es la de barra,
  // o aparcadas en sessions.counter si se salió a una mesa.
  const counterLines = useOrderStore((s) =>
    s.type === 'counter' ? s.lines : (s.sessions.counter?.lines ?? NO_LINES),
  );
  const summary = useMemo(() => counterSummary(counterLines), [counterLines]);

  function handlePress() {
    setActiveCounter();
    router.push('/tpv/order');
  }

  return (
    <Button
      size="lg"
      variant="outline"
      onClick={handlePress}
      className="h-16 gap-3 border-2 text-base font-semibold"
    >
      <ShoppingCart size={20} strokeWidth={1.5} aria-hidden />
      <span className="flex flex-col items-start leading-tight">
        <span>{t('counter')}</span>
        {summary.itemCount > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            {t('counterSummary', {
              count: summary.itemCount,
              total: formatCents(summary.totalCents),
            })}
          </span>
        )}
      </span>
    </Button>
  );
}
