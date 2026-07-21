'use client';

import { cn } from '@tpv/ui';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

interface TpvSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TpvSearchInput({ value, onChange, className }: TpvSearchInputProps) {
  const t = useTranslations('tpv.content');
  const inputId = useId();

  return (
    <div className={cn('relative flex items-center', className)}>
      <label htmlFor={inputId} className="sr-only">
        {t('searchPlaceholder')}
      </label>
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        autoComplete="off"
        className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      {value && (
        <button
          type="button"
          aria-label={t('clearSearch')}
          onClick={() => onChange('')}
          className="absolute right-2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
