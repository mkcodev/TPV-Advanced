'use client';

import { trpc } from '@/lib/trpc/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (sessionId: string) => void;
}

function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

interface Mismatch {
  sessionId: string;
  differenceCents: number;
  expectedAmountCents: number;
}

export function CloseCashSessionDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('tpv.cash');
  const [countedStr, setCountedStr] = useState('');
  const [blind, setBlind] = useState(true);
  const [mismatch, setMismatch] = useState<Mismatch | null>(null);

  const { mutate, isPending } = trpc.cashSession.close.useMutation({
    onSuccess: (data) => {
      if (data.differenceCents !== 0) {
        setMismatch({
          sessionId: data.sessionId,
          differenceCents: data.differenceCents,
          expectedAmountCents: data.expectedAmountCents,
        });
      } else {
        toast.success(t('closeDialog.success'));
        const sessionId = data.sessionId;
        reset();
        onSuccess(sessionId);
      }
    },
    onError: (err) => {
      const msg =
        err.data?.code === 'PRECONDITION_FAILED'
          ? t('errors.sessionClosed')
          : t('closeDialog.error');
      toast.error(msg);
    },
  });

  const reset = () => {
    setCountedStr('');
    setBlind(true);
    setMismatch(null);
  };

  const parsedEuros = Number.parseFloat(countedStr.replace(',', '.'));
  const isValid = !Number.isNaN(parsedEuros) && parsedEuros >= 0;

  const handleConfirm = () => {
    if (!isValid) return;
    mutate({ countedAmountCents: Math.round(parsedEuros * 100) });
  };

  const handleMismatchConfirm = () => {
    if (!mismatch) return;
    toast.success(t('closeDialog.success'));
    const { sessionId } = mismatch;
    reset();
    onSuccess(sessionId);
  };

  const handleDismiss = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={open && mismatch === null}
        onOpenChange={(v) => {
          if (!v) handleDismiss();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('closeDialog.title')}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t('closeDialog.description')}</p>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="blind-mode" className="text-sm cursor-pointer">
                {t('closeDialog.blind')}
              </Label>
              <Switch id="blind-mode" checked={blind} onCheckedChange={setBlind} />
            </div>
            {blind && <p className="text-xs text-muted-foreground">{t('closeDialog.blindHint')}</p>}

            <div>
              <Label htmlFor="counted-amount">{t('closeDialog.counted')}</Label>
              <div className="relative mt-1.5">
                <Input
                  id="counted-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={countedStr}
                  onChange={(e) => setCountedStr(e.target.value)}
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
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleDismiss} disabled={isPending}>
              {t('closeDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!isValid || isPending}>
              {isPending ? '…' : t('closeDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mismatch !== null && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('closeDialog.confirmMismatchTitle')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p>{t('closeDialog.confirmMismatchDescription')}</p>
                  <div className="mt-3 space-y-1 font-mono text-sm">
                    <div className="flex justify-between">
                      <span>{t('closeDialog.expected')}</span>
                      <span>{formatCents(mismatch.expectedAmountCents)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-destructive">
                      <span>{t('closeDialog.difference')}</span>
                      <span>{formatCents(mismatch.differenceCents)}</span>
                    </div>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDismiss}>{t('zReport.close')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleMismatchConfirm}>
                {t('closeDialog.viewZReport')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
