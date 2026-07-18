'use client';

import { Checkbox, Label } from '@tpv/ui';
import { useTranslations } from 'next-intl';

// EU 1169/2011 — 14 alérgenos de declaración obligatoria
const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

type Allergen = (typeof ALLERGENS)[number];

type Props = {
  value: Allergen[];
  onChange: (v: Allergen[]) => void;
  disabled?: boolean;
};

export function AllergensPicker({ value, onChange, disabled }: Props) {
  const t = useTranslations('admin.catalog.allergens');

  function toggle(allergen: Allergen) {
    if (value.includes(allergen)) {
      onChange(value.filter((a) => a !== allergen));
    } else {
      onChange([...value, allergen]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ALLERGENS.map((allergen) => (
        <div key={allergen} className="flex items-center gap-2">
          <Checkbox
            id={`allergen-${allergen}`}
            checked={value.includes(allergen)}
            onCheckedChange={() => toggle(allergen)}
            disabled={disabled}
          />
          <Label htmlFor={`allergen-${allergen}`} className="cursor-pointer text-sm font-normal">
            {t(allergen)}
          </Label>
        </div>
      ))}
    </div>
  );
}
