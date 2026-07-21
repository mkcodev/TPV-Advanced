'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { ScrollArea } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { TpvOrderLine } from './tpv-order-line';

export function TpvOrderLines() {
  const t = useTranslations('tpv.order');
  const lineIds = useOrderStore((s) => s.lines.map((l) => l.id));

  if (lineIds.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t('empty')}</p>
        <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {lineIds.map((id) => (
          <TpvOrderLine key={id} lineId={id} />
        ))}
      </div>
    </ScrollArea>
  );
}
