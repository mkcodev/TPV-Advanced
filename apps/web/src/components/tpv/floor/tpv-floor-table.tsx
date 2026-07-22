'use client';

import { cn } from '@tpv/ui';
import { useTranslations } from 'next-intl';

type Props = {
  id: string;
  name: string;
  seats: number;
  shape: 'square' | 'round';
  openOrderId: string | null;
  onClick: () => void;
};

export function TpvFloorTable({ name, seats, shape, openOrderId, onClick }: Props) {
  const t = useTranslations('tpv.floor');
  const isOccupied = openOrderId !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${t('tableLabel', { name })} — ${isOccupied ? t('occupied') : t('free')}`}
      className={cn(
        'flex min-h-[64px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-center transition-colors active:scale-95',
        isOccupied
          ? 'border-state-occupied bg-state-occupied/20 text-state-occupied hover:bg-state-occupied/30'
          : 'border-state-free bg-state-free/20 text-state-free hover:bg-state-free/30',
        shape === 'round' && 'rounded-full',
      )}
    >
      <span className="text-sm font-bold leading-tight">{name}</span>
      <span className="text-[10px] opacity-70">{t('seats', { count: seats })}</span>
    </button>
  );
}
