import { Skeleton } from '@tpv/ui';
import { useTranslations } from 'next-intl';

export function TpvContentPlaceholder() {
  const t = useTranslations('tpv.content');

  return (
    <div className="flex-1 overflow-y-auto p-4" aria-label={t('selectCategory')}>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => `skeleton-${i}`).map((id) => (
          <Skeleton key={id} className="aspect-square min-h-[80px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
