'use client';

import { trpc } from '@/lib/trpc/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function OpenCashSessionDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('tpv.cash');
  const [amountStr, setAmountStr] = useState('');
  const utils = trpc.useUtils();

  const { mutate, isPending } = trpc.cashSession.open.useMutation({
    onSuccess: () => {
      toast.success(t('openDialog.success'));
      setAmountStr('');
      // Refresca chip, aviso de cobro y esperado: todo cuelga de cashSession.
      void utils.cashSession.invalidate();
      onSuccess();
    },
    onError: (err) => {
      const msg = err.data?.code === 'CONFLICT' ? t('errors.alreadyOpen') : t('openDialog.error');
      toast.error(msg);
    },
  });

  const parsedEuros = Number.parseFloat(amountStr.replace(',', '.'));
  const isValid = !Number.isNaN(parsedEuros) && parsedEuros >= 0;

  const handleConfirm = () => {
    if (!isValid) return;
    mutate({ openingAmountCents: Math.round(parsedEuros * 100) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('openDialog.title')}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t('openDialog.description')}</p>
        </DialogHeader>

        <div className="py-2">
          <Label htmlFor="opening-amount">{t('openDialog.openingAmount')}</Label>
          <div className="relative mt-1.5">
            <Input
              id="opening-amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="pr-10 text-right font-mono tabular-nums"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid) handleConfirm();
              }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              €
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('openDialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isPending}>
            {isPending ? '…' : t('openDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
