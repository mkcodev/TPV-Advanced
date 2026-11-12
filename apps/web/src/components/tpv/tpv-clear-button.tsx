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
  // Solo se limpia lo no guardado: las líneas guardadas están fijadas y solo se anulan.
  const draftCount = useOrderStore(
    (s) =>
      s.lines.filter((l) => l.savedQuantity === undefined || l.quantity > l.savedQuantity).length,
  );
  const clear = useOrderStore((s) => s.discardDraft);

  if (draftCount === 0) {
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
