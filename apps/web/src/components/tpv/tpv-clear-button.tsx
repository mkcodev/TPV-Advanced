'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';

export function TpvClearButton() {
  const t = useTranslations('tpv.order');
  const lineCount = useOrderStore((s) => s.lines.length);
  const clear = useOrderStore((s) => s.clear);

  if (lineCount === 0) {
    return (
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled>
        {t('clear')}
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          {t('clear')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('clearConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('clearConfirmDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('clearConfirmCancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={clear}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('clearConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
