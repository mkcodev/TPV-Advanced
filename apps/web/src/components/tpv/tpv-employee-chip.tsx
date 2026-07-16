import { useTranslations } from 'next-intl';

export function TpvEmployeeChip() {
  const t = useTranslations('tpv.employee');

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        aria-hidden="true"
      >
        E
      </div>
      <span className="text-sm text-muted-foreground">
        <span className="sr-only">{t('label')}: </span>
        {t('noEmployee')}
      </span>
    </div>
  );
}
