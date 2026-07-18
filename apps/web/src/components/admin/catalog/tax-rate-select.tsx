'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tpv/ui';
import { useTranslations } from 'next-intl';

const TAX_RATES = [0, 4, 10, 21] as const;

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function TaxRateSelect({ value, onChange, disabled }: Props) {
  const t = useTranslations('admin.catalog.products.taxRate');

  const label: Record<(typeof TAX_RATES)[number], 'iva0' | 'iva4' | 'iva10' | 'iva21'> = {
    0: 'iva0',
    4: 'iva4',
    10: 'iva10',
    21: 'iva21',
  };

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TAX_RATES.map((rate) => (
          <SelectItem key={rate} value={String(rate)}>
            {t(label[rate])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
