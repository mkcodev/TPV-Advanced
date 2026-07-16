import { Separator } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { TpvEmployeeChip } from './tpv-employee-chip';
import { TpvSyncPill } from './tpv-sync-pill';

export function TpvHeader() {
  const t = useTranslations('tpv.header');

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          T
        </div>
        <span>{t('businessName')}</span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <TpvSyncPill />

      <div className="ml-auto">
        <TpvEmployeeChip />
      </div>
    </header>
  );
}
