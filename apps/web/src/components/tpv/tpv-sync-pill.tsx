import { useTranslations } from 'next-intl';

export function TpvSyncPill() {
  const t = useTranslations('tpv.sync');

  return (
    <output
      aria-label={t('online')}
      className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
    >
      <span className="h-2 w-2 rounded-full bg-state-free" aria-hidden="true" />
      {t('online')}
    </output>
  );
}
