'use client';

import { TABLE_MIN_SIZE_CLASS, type TableVisualState, splitElapsed } from '@/lib/tpv/floor-state';
import { formatCents } from '@tpv/core';
import { badgeVariants, cn } from '@tpv/ui';
import { useTranslations } from 'next-intl';

type Props = {
  id: string;
  name: string;
  seats: number;
  shape: 'square' | 'round';
  state: TableVisualState;
  // Datos de la comanda abierta (null en mesas libres o mientras llega el dato real).
  pendingCents: number | null;
  elapsedMinutes: number | null;
  employeeName: string | null;
  onClick: () => void;
};

// Color de borde/relleno por estado (solo fichas, no texto: ver nota de contraste en tokens.css).
// El estado NUNCA va solo en color: la etiqueta (Badge) lo repite con texto.
const STATE_CLASSES: Record<TableVisualState, string> = {
  free: 'border-state-free bg-state-free/20 hover:bg-state-free/30',
  occupied: 'border-state-occupied bg-state-occupied/20 hover:bg-state-occupied/30',
  billing: 'border-state-billing bg-state-billing/20 hover:bg-state-billing/30',
};

const STATE_BADGE = {
  free: 'state-free',
  occupied: 'state-occupied',
  billing: 'state-billing',
} as const;

export function TpvFloorTable({
  name,
  seats,
  shape,
  state,
  pendingCents,
  elapsedMinutes,
  employeeName,
  onClick,
}: Props) {
  const t = useTranslations('tpv.floor');
  const isOpen = state !== 'free';
  const stateLabel = t(
    state === 'billing' ? 'billing' : state === 'occupied' ? 'occupied' : 'free',
  );

  const elapsedLabel =
    elapsedMinutes === null
      ? null
      : elapsedMinutes < 60
        ? t('openFor', { minutes: elapsedMinutes })
        : t('openForHours', splitElapsed(elapsedMinutes));
  const pendingLabel =
    pendingCents === null ? null : t('pending', { amount: formatCents(pendingCents) });
  const servedByLabel = employeeName === null ? null : t('servedBy', { name: employeeName });

  // El lector de pantalla oye nombre + estado + los mismos datos que se ven.
  const ariaLabel = [
    t('tableLabel', { name }),
    stateLabel,
    pendingLabel,
    elapsedLabel,
    servedByLabel,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-center text-foreground transition-colors active:scale-95',
        TABLE_MIN_SIZE_CLASS,
        STATE_CLASSES[state],
        shape === 'round' && 'aspect-square rounded-full',
      )}
    >
      <span className="text-sm font-bold leading-tight">{name}</span>
      <span className={badgeVariants({ variant: STATE_BADGE[state] })}>{stateLabel}</span>
      {isOpen ? (
        <>
          {pendingLabel !== null && <span className="text-sm font-semibold">{pendingLabel}</span>}
          {elapsedLabel !== null && <span className="text-xs">{elapsedLabel}</span>}
          {servedByLabel !== null && (
            <span className="max-w-full truncate text-xs">{servedByLabel}</span>
          )}
        </>
      ) : (
        <span className="text-xs opacity-70">{t('seats', { count: seats })}</span>
      )}
    </button>
  );
}
