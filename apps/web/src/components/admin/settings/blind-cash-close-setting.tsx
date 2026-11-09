'use client';

import { trpc } from '@/lib/trpc/client';
import { Label, Skeleton, Switch } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

// Interruptor del cierre ciego. El servidor (managerProcedure) es quien autoriza el cambio;
// aquí solo se refleja el valor guardado y se envía el nuevo.
export function BlindCashCloseSetting() {
  const t = useTranslations('admin.settings.cash.blindClose');
  const utils = trpc.useUtils();

  const { data, isLoading, isError } = trpc.business.getSettings.useQuery();
  const { mutate, isPending } = trpc.business.updateSettings.useMutation({
    onSuccess: () => {
      toast.success(t('saved'));
      void utils.business.getSettings.invalidate();
    },
    onError: () => toast.error(t('error')),
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (isError || !data) return <p className="text-sm text-destructive">{t('loadError')}</p>;

  return (
    <div className="flex items-start justify-between gap-6 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="blind-cash-close" className="text-base font-medium">
          {t('label')}
        </Label>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <Switch
        id="blind-cash-close"
        checked={data.blindCashClose}
        disabled={isPending}
        onCheckedChange={(value) => mutate({ blindCashClose: value })}
      />
    </div>
  );
}
