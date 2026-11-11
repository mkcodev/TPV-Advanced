'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

// "Pedir cuenta": guarda la comanda y marca la mesa como pendiente de cobro en el plano.
// Solo tiene sentido en mesas (la barra se cobra en el momento).
export function TpvRequestBillButton() {
  const t = useTranslations('tpv.order');
  const utils = trpc.useUtils();
  const [pending, setPending] = useState(false);

  const {
    lines,
    type,
    tableId,
    ensureOrderId,
    hydrateFromServer,
    billRequestedAt,
    setBillRequestedAt,
  } = useOrderStore(
    useShallow((s) => ({
      billRequestedAt: s.billRequestedAt,
      setBillRequestedAt: s.setBillRequestedAt,
      lines: s.lines,
      type: s.type,
      tableId: s.tableId,
      ensureOrderId: s.ensureOrderId,
      hydrateFromServer: s.hydrateFromServer,
    })),
  );
  const upsert = trpc.orders.upsert.useMutation();
  const requestBill = trpc.orders.requestBill.useMutation();

  if (type !== 'dine_in' || tableId === null) return null;

  async function handleClick() {
    if (lines.length === 0 || tableId === null) return;
    setPending(true);
    try {
      // Primero se guarda (la cuenta debe reflejar lo que hay en pantalla) y luego se pide.
      const saved = await upsert.mutateAsync({
        orderId: ensureOrderId(),
        type: 'dine_in',
        tableId,
        lines: lines.map((l) => ({
          lineId: l.id,
          productId: l.productId,
          quantity: l.quantity,
          ...(l.notes ? { notes: l.notes } : {}),
        })),
      });
      hydrateFromServer(saved);
      const billed = await requestBill.mutateAsync({ orderId: saved.id });
      setBillRequestedAt(billed.billRequestedAt);
      await utils.floor.tables.listWithOpenOrders.invalidate();
      toast.success(t('requestBillSuccess'));
    } catch {
      toast.error(t('requestBillError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="xl"
      className="w-full"
      disabled={lines.length === 0 || pending || billRequestedAt !== null}
      onClick={handleClick}
    >
      {pending
        ? t('requestingBill')
        : billRequestedAt !== null
          ? t('billRequested')
          : t('requestBill')}
    </Button>
  );
}
