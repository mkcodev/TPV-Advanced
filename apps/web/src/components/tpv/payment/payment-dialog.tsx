'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { formatCents, lineTotalCents, orderTaxBreakdown } from '@tpv/core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from '@tpv/ui';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { CashPanel } from './cash-panel';
import { type PaymentMethod, PaymentMethodTabs } from './payment-method-tabs';

// Línea de pago local (acumulación para pago mixto).
interface PendingPayment {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  cashReceivedCents?: number;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function openTicketWindow(orderId: string) {
  window.open(
    `/tpv/order/ticket/${orderId}`,
    'ticket',
    'width=420,height=800,menubar=no,toolbar=no',
  );
}

export function PaymentDialog({ open, onOpenChange }: PaymentDialogProps) {
  const t = useTranslations('tpv.order.payment');
  const tOrder = useTranslations('tpv.order');

  const { lines, orderId, savedOrderNumber, clear } = useOrderStore(
    useShallow((s) => ({
      lines: s.lines,
      orderId: s.orderId,
      savedOrderNumber: s.savedOrderNumber,
      clear: s.clear,
    })),
  );

  // Total local (feedback instantáneo; el servidor confirma el autoritativo).
  const breakdown = orderTaxBreakdown(
    lines.map((l) => ({
      grossCents: lineTotalCents(l.unitPriceCents, l.quantity),
      taxRate: l.taxRate,
    })),
  );
  const totalCents = breakdown.totalCents;

  // Estado local del dialog.
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [cashReceivedCents, setCashReceivedCents] = useState<number | null>(null);

  const paidSoFar = pendingPayments.reduce((s, p) => s + p.amountCents, 0);
  const remainingCents = totalCents - paidSoFar;

  // Importe del pago actual (basado en el restante).
  const currentAmountCents = remainingCents;

  // Cambio para el pago en efectivo actual.
  const currentChangeCents =
    method === 'cash' && cashReceivedCents !== null && cashReceivedCents >= currentAmountCents
      ? cashReceivedCents - currentAmountCents
      : null;

  // El botón confirmar se activa cuando el pago actual cubriría el restante.
  const canConfirm =
    method !== 'cash'
      ? remainingCents > 0 // card/bizum: con solo seleccionar método y que quede algo
      : cashReceivedCents !== null && cashReceivedCents >= currentAmountCents;

  const { mutate, isPending } = trpc.orders.pay.useMutation({
    onSuccess: (data) => {
      if (data.status === 'paid') {
        // Capturar orderId antes de clear() para el reprint.
        const ticketOrderId = orderId;
        if (ticketOrderId) {
          openTicketWindow(ticketOrderId);
        }
        clear();
        toast.success(t('successPaid', { number: data.orderNumber }), {
          duration: 10000,
          action: ticketOrderId
            ? {
                label: tOrder('reprintTicket'),
                onClick: () => openTicketWindow(ticketOrderId),
              }
            : undefined,
        });
        onOpenChange(false);
        resetDialog();
      } else {
        // Pago parcial — refrescar dialog con restante.
        setPendingPayments([]);
        setCashReceivedCents(null);
        toast.info(t('successPartial', { remaining: formatCents(data.remainingCents) }));
      }
    },
    onError: (err) => {
      toast.error(err.message || t('error'));
    },
  });

  const resetDialog = () => {
    setMethod('cash');
    setPendingPayments([]);
    setCashReceivedCents(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetDialog();
  };

  const handleAddPayment = () => {
    if (!canConfirm || remainingCents <= 0) return;
    const newPayment: PendingPayment = {
      id: crypto.randomUUID(),
      method,
      amountCents: currentAmountCents,
      ...(method === 'cash' && cashReceivedCents !== null ? { cashReceivedCents } : {}),
    };
    setPendingPayments((prev) => [...prev, newPayment]);
    setCashReceivedCents(null);
    setMethod('cash');
  };

  const handleRemovePayment = (id: string) => {
    setPendingPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleConfirm = () => {
    if (!orderId) return;

    // Construir la lista final de pagos: los ya acumulados + el actual.
    const allPayments = [
      ...pendingPayments.map((p) => ({
        method: p.method,
        amountCents: p.amountCents,
        ...(p.cashReceivedCents !== undefined ? { cashReceivedCents: p.cashReceivedCents } : {}),
      })),
      {
        method,
        amountCents: currentAmountCents,
        ...(method === 'cash' && cashReceivedCents !== null ? { cashReceivedCents } : {}),
      },
    ];

    mutate({ orderId, payments: allPayments });
  };

  const methodLabel: Record<PaymentMethod, string> = {
    cash: t('method.cash'),
    card: t('method.card'),
    bizum: t('method.bizum'),
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>
            {savedOrderNumber !== null ? t('title', { number: savedOrderNumber }) : t('confirm')}
          </DialogTitle>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-sm text-muted-foreground">{t('totalDue')}</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {formatCents(totalCents)}
            </span>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4">
          {/* Pagos ya acumulados (modo mixto) */}
          {pendingPayments.length > 0 && (
            <div className="flex flex-col gap-1">
              {pendingPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{methodLabel[p.method]}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium">{formatCents(p.amountCents)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(p.id)}
                      aria-label={t('removePayment')}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
              <Separator className="mt-1" />
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">{t('remaining')}</span>
                <span className="tabular-nums text-foreground">{formatCents(remainingCents)}</span>
              </div>
            </div>
          )}

          {/* Selector de método */}
          <PaymentMethodTabs
            selected={method}
            onChange={(m) => {
              setMethod(m);
              setCashReceivedCents(null);
            }}
          />

          {/* Panel específico por método */}
          {method === 'cash' ? (
            <CashPanel
              amountCents={currentAmountCents}
              cashReceivedCents={cashReceivedCents}
              onChange={setCashReceivedCents}
            />
          ) : (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
              {formatCents(currentAmountCents)} · {methodLabel[method]}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border px-6 py-4 sm:flex-col">
          {/* Botón "Añadir método" — pagar parte del total con un método y el resto con otro */}
          {canConfirm && remainingCents > currentAmountCents && (
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handleAddPayment}
              disabled={isPending}
            >
              {t('addMethod')}
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="lg"
              className="flex-1"
              onClick={handleClose}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="success"
              size="xl"
              className="flex-1"
              disabled={!canConfirm || isPending || !orderId}
              onClick={handleConfirm}
            >
              {isPending ? '…' : t('confirm')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
