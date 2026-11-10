'use client';

import { useEmployeeStore } from '@/lib/stores/use-employee-store';
import { useOrderStore } from '@/lib/stores/use-order-store';
import { PIN_MAX_DIGITS, PIN_MIN_DIGITS } from '@/lib/tpv/auth-constants';
import { trpc } from '@/lib/trpc/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  cn,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PinPad } from './auth/pin-pad';

interface Props {
  lineId: string | null;
  onOpenChange: (open: boolean) => void;
}

const QUICK_REASONS = ['waiterError', 'customerRefused', 'outOfStock'] as const;

// Anular una línea YA GUARDADA. Pide motivo y la autorización de un encargado:
// - Si quien está logueado ya es encargado/admin, se autoriza él mismo (sin PIN).
// - Si no, elige a un encargado y teclea su PIN en el momento.
// El servidor revalida todo (rol, PIN, bloqueo); esto es solo la interfaz.
export function TpvVoidLineDialog({ lineId, onOpenChange }: Props) {
  const t = useTranslations('tpv.void');
  const open = lineId !== null;

  const line = useOrderStore((s) => s.lines.find((l) => l.id === lineId));
  const orderId = useOrderStore((s) => s.orderId);
  const hydrateFromServer = useOrderStore((s) => s.hydrateFromServer);
  const role = useEmployeeStore((s) => s.employee?.role);
  const selfApproves = role === 'manager' || role === 'admin';

  const [reason, setReason] = useState('');
  const [approverId, setApproverId] = useState<string | null>(null);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre para otra línea se parte de cero.
  useEffect(() => {
    if (lineId !== null) {
      setReason('');
      setApproverId(null);
      setDigits('');
      setError(null);
    }
  }, [lineId]);

  const employeesQuery = trpc.auth.listEmployees.useQuery(undefined, {
    enabled: open && !selfApproves,
    staleTime: 30_000,
  });
  const approvers = (employeesQuery.data ?? []).filter(
    (e) => e.role === 'manager' || e.role === 'admin',
  );
  // Un único encargado: se preselecciona.
  const effectiveApproverId =
    approverId ?? (approvers.length === 1 ? (approvers[0]?.id ?? null) : null);

  const voidMutation = trpc.orders.voidLine.useMutation({
    onSuccess: (data) => {
      hydrateFromServer(data);
      toast.success(t('success'));
      onOpenChange(false);
    },
    onError: (err) => {
      const code = err.data?.code as string | undefined;
      setDigits('');
      if (code === 'TOO_MANY_REQUESTS') {
        setError(t('errors.rateLimit'));
      } else if (code === 'FORBIDDEN' && err.message.startsWith('Account locked until')) {
        setError(t('errors.locked'));
      } else if (code === 'FORBIDDEN') {
        setError(t('errors.notManager'));
      } else if (code === 'UNAUTHORIZED') {
        setError(t('errors.invalidPin'));
      } else {
        setError(t('errors.generic'));
      }
    },
  });

  const trimmedReason = reason.trim();
  const needsPin = !selfApproves;
  const canConfirm =
    line !== undefined &&
    orderId !== null &&
    trimmedReason.length > 0 &&
    (!needsPin || (effectiveApproverId !== null && digits.length >= PIN_MIN_DIGITS)) &&
    !voidMutation.isPending;

  function handleConfirm() {
    if (!canConfirm || lineId === null || orderId === null) return;
    setError(null);
    voidMutation.mutate({
      orderId,
      lineId,
      reason: trimmedReason,
      ...(needsPin && effectiveApproverId !== null
        ? { approverEmployeeId: effectiveApproverId, approverPin: digits }
        : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title', { name: line?.name ?? '' })}</DialogTitle>
          <DialogDescription>
            {selfApproves ? t('descriptionSelf') : t('descriptionPin')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Motivo: atajos + texto libre */}
          <div className="space-y-2">
            <Label htmlFor="void-reason">{t('reason')}</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={reason === t(`reasons.${key}`) ? 'default' : 'outline'}
                  size="sm"
                  className="min-h-11"
                  onClick={() => setReason(t(`reasons.${key}`))}
                >
                  {t(`reasons.${key}`)}
                </Button>
              ))}
            </div>
            <Input
              id="void-reason"
              value={reason}
              maxLength={200}
              placeholder={t('reasonPlaceholder')}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {needsPin && (
            <div className="space-y-3">
              <Label>{t('approver')}</Label>
              {employeesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t('loadingApprovers')}</p>
              ) : approvers.length === 0 ? (
                <p
                  role="alert"
                  className="rounded-md border border-warning bg-warning/10 p-3 text-sm"
                >
                  {t('noApprovers')}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {approvers.map((a) => (
                      <Button
                        key={a.id}
                        type="button"
                        variant={effectiveApproverId === a.id ? 'default' : 'outline'}
                        className={cn('min-h-11')}
                        onClick={() => {
                          setApproverId(a.id);
                          setDigits('');
                          setError(null);
                        }}
                      >
                        {a.name}
                      </Button>
                    ))}
                  </div>
                  {effectiveApproverId !== null && (
                    <div className="mx-auto w-full max-w-xs">
                      <PinPad
                        digits={digits}
                        disabled={voidMutation.isPending}
                        onDigit={(d) => {
                          setError(null);
                          setDigits((cur) => (cur.length < PIN_MAX_DIGITS ? cur + d : cur));
                        }}
                        onClear={() => setDigits('')}
                        onBackspace={() => setDigits((cur) => cur.slice(0, -1))}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {voidMutation.isPending ? t('voiding') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
