'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { formatCents } from '@tpv/core';
import { ScrollArea } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TpvOrderLine } from './tpv-order-line';
import { TpvVoidLineDialog } from './tpv-void-line-dialog';

export function TpvOrderLines() {
  const t = useTranslations('tpv.order');
  // useShallow: compara elemento a elemento → no crea nueva referencia si los ids no cambiaron
  const lineIds = useOrderStore(useShallow((s) => s.lines.map((l) => l.id)));
  const voidedLines = useOrderStore((s) => s.voidedLines);
  // Una sola instancia del diálogo de anulación para todas las líneas.
  const [voidingId, setVoidingId] = useState<string | null>(null);

  if (lineIds.length === 0 && voidedLines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t('empty')}</p>
        <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {lineIds.map((id) => (
            <TpvOrderLine key={id} lineId={id} onVoid={setVoidingId} />
          ))}
          {/* Anuladas: se conservan como auditoría, tachadas y con su motivo. No suman. */}
          {voidedLines.map((v) => (
            <div key={v.id} className="px-3 py-2 opacity-70" data-testid="voided-line">
              <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="truncate line-through">
                  {v.name} × {v.quantity}
                </span>
                <span className="shrink-0 tabular-nums line-through">
                  {formatCents(v.lineTotalCents)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t('voidedLabel')}
                {v.reason ? `: ${v.reason}` : ''}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
      <TpvVoidLineDialog
        lineId={voidingId}
        onOpenChange={(open) => {
          if (!open) setVoidingId(null);
        }}
      />
    </>
  );
}
