'use client';

import { formatCents } from '@tpv/core';

interface BillButtonProps {
  valueCents: number;
  onSelect: (valueCents: number) => void;
}

export function BillButton({ valueCents, onSelect }: BillButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(valueCents)}
      className={[
        'flex min-h-16 items-center justify-center rounded-xl',
        'border border-border bg-card text-base font-semibold text-foreground',
        'transition-colors duration-[var(--duration-fast)]',
        'hover:bg-muted hover:border-border/80',
        'active:scale-95',
      ].join(' ')}
    >
      {formatCents(valueCents)}
    </button>
  );
}
