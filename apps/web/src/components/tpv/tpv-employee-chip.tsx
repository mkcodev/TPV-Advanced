import { Avatar, AvatarFallback } from '@tpv/ui';
import { useTranslations } from 'next-intl';

export function TpvEmployeeChip() {
  const t = useTranslations('tpv.employee');

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
          E
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground">
        <span className="sr-only">{t('label')}: </span>
        {t('noEmployee')}
      </span>
    </div>
  );
}
