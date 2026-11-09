'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';

export function TpvBackToFloorButton() {
  const t = useTranslations('tpv.floor');
  const router = useRouter();

  const { lines, type, tableId, ensureOrderId } = useOrderStore(
    useShallow((s) => ({
      lines: s.lines,
      type: s.type,
      tableId: s.tableId,
      ensureOrderId: s.ensureOrderId,
    })),
  );

  const { mutateAsync } = trpc.orders.upsert.useMutation();

  async function handleBack() {
    // Auto-persist fire-and-forget if session has lines and is a table order
    if (lines.length > 0 && type === 'dine_in' && tableId !== null) {
      const orderId = ensureOrderId();
      mutateAsync({
        orderId,
        type,
        tableId,
        lines: lines.map((l) => ({
          lineId: l.id,
          productId: l.productId,
          quantity: l.quantity,
          ...(l.notes ? { notes: l.notes } : {}),
        })),
      }).catch(() => {
        // best-effort: failure is silently ignored, navigation proceeds anyway
      });
    }
    // Barra: no se guarda nada al salir. Sus líneas quedan en la sesión local del store
    // (se aparca al abrir una mesa y se recupera al volver a pulsar "Barra").
    router.push('/tpv');
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
      <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
      {t('backToFloor')}
    </Button>
  );
}
