'use client';

import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type PaymentMethod = 'cash' | 'card' | 'bizum';

interface PaymentMethodTabsProps {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

const METHODS: { id: PaymentMethod; Icon: React.ElementType }[] = [
  { id: 'cash', Icon: Banknote },
  { id: 'card', Icon: CreditCard },
  { id: 'bizum', Icon: Smartphone },
];

export function PaymentMethodTabs({ selected, onChange }: PaymentMethodTabsProps) {
  const t = useTranslations('tpv.order.payment.method');

  return (
    <div className="grid grid-cols-3 gap-2" role="tablist">
      {METHODS.map(({ id, Icon }) => {
        const isSelected = selected === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(id)}
            className={[
              'flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2',
              'text-xs font-medium transition-colors duration-[var(--duration-fast)]',
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            {t(id)}
          </button>
        );
      })}
    </div>
  );
}
