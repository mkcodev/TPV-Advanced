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
  Textarea,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type MovementType = 'pay_in' | 'pay_out';

export function CashMovementDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('tpv.cash');
  const [type, setType] = useState<MovementType>('pay_in');
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const utils = trpc.useUtils();

  const { mutate, isPending } = trpc.cashSession.addMovement.useMutation({
    onSuccess: () => {
      toast.success(t('movementDialog.success'));
      reset();
      // El movimiento cambia el esperado: el chip se actualiza al invalidar.
      void utils.cashSession.invalidate();
      onSuccess();
    },
    onError: () => {
      toast.error(t('movementDialog.error'));
    },
  });

  const reset = () => {
    setType('pay_in');
    setAmountStr('');
    setReason('');
  };

  const parsedEuros = Number.parseFloat(amountStr.replace(',', '.'));
  const isValid = !Number.isNaN(parsedEuros) && parsedEuros > 0 && reason.trim().length > 0;

  const handleConfirm = () => {
    if (!isValid) return;
    mutate({
      type,
      amountCents: Math.round(parsedEuros * 100),
      reason: reason.trim(),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('movementDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <Label>{t('movementDialog.type')}</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(['pay_in', 'pay_out'] as MovementType[]).map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setType(mt)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors min-h-[44px] ${
                    type === mt
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-foreground hover:bg-muted'
                  }`}
                >
                  {mt === 'pay_in' ? t('movementDialog.typeIn') : t('movementDialog.typeOut')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="movement-amount">{t('movementDialog.amount')}</Label>
            <div className="relative mt-1.5">
              <Input
                id="movement-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="pr-10 text-right font-mono tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="movement-reason">{t('movementDialog.reason')}</Label>
            <Textarea
              id="movement-reason"
              placeholder={t('movementDialog.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={isPending}
          >
            {t('movementDialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isPending}>
            {isPending ? '…' : t('movementDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
