'use client';

import { formatCents } from '@tpv/core';
import { useTranslations } from 'next-intl';

interface ChangeDisplayProps {
  changeCents: number;
}

// Muestra el cambio a devolver en tamaño display (DS §8 S2).
// aria-live="polite" para lectores de pantalla.
export function ChangeDisplay({ changeCents }: ChangeDisplayProps) {
  const t = useTranslations('tpv.order.payment');

  return (
    <output aria-live="polite" className="flex flex-col items-center gap-1 py-4">
      <span className="text-sm font-medium text-muted-foreground">{t('change')}</span>
      <span
        className="tabular-nums font-bold text-success"
        style={{ fontSize: '2.5rem', lineHeight: 1.1 }}
      >
        {formatCents(changeCents)}
      </span>
    </output>
  );
}
