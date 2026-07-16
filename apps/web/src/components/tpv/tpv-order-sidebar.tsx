import { Button, Separator } from '@tpv/ui';
import { useTranslations } from 'next-intl';

export function TpvOrderSidebar() {
  const t = useTranslations('tpv.order');

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">{t('title')}</span>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('clear')}
        </button>
      </div>

      {/* Empty state */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t('empty')}</p>
        <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
      </div>

      {/* Totals */}
      <div className="border-t border-border px-4 py-3">
        <div className="space-y-1.5 tabular-nums">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t('subtotal')}</span>
            <span>0,00 €</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t('tax')}</span>
            <span>0,00 €</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-semibold text-foreground">
            <span>{t('total')}</span>
            <span>0,00 €</span>
          </div>
        </div>

        <Button variant="success" size="xl" className="mt-3 w-full" aria-label={t('charge')}>
          {t('charge')}
        </Button>
      </div>
    </aside>
  );
}
