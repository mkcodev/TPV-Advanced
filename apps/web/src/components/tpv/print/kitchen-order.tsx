'use client';

import { trpc } from '@/lib/trpc/client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

type Props = { orderId: string };

export function KitchenOrder({ orderId }: Props) {
  const t = useTranslations('tpv.kitchen');
  const sentRef = useRef(false);
  const { data, isLoading } = trpc.orders.getKitchenPayload.useQuery({ orderId });
  const markSent = trpc.orders.markLinesSent.useMutation();

  useEffect(() => {
    if (!data || sentRef.current) return;
    if (data.pendingItemIds.length === 0) return;

    // Marcar como enviadas UNA vez (guard para StrictMode double-invoke).
    sentRef.current = true;
    markSent.mutate({ orderId, itemIds: data.pendingItemIds });
    window.print();
  }, [data, orderId, markSent]);

  if (isLoading || !data) {
    return <div className="kitchen-print no-print">{t('empty')}</div>;
  }

  const { order, groups } = data;
  const hasKitchen = groups.kitchen.length > 0;
  const hasBar = groups.bar.length > 0;

  if (!hasKitchen && !hasBar) {
    return (
      <div className="no-print" style={{ padding: '24px' }}>
        <p>{t('empty')}</p>
        <button
          type="button"
          onClick={() => window.close()}
          style={{ marginTop: '16px', padding: '8px 16px' }}
        >
          {t('close')}
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .kitchen-print { width: 80mm; }
          .no-print { display: none !important; }
        }
        .kitchen-print {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
          width: 80mm;
          max-width: 80mm;
          padding: 8px;
          color: #000;
          background: #fff;
        }
        .kitchen-separator { border: none; border-top: 2px solid #000; margin: 6px 0; }
        .kitchen-section-title { font-size: 16px; font-weight: bold; text-align: center; }
        .kitchen-order-num { text-align: center; font-size: 20px; font-weight: bold; }
        .kitchen-row { display: flex; gap: 8px; }
        .kitchen-qty { font-weight: bold; min-width: 24px; }
        .kitchen-notes { padding-left: 32px; font-size: 11px; }
      `}</style>

      <div className="kitchen-print">
        <div className="kitchen-order-num">{t('order', { number: order.orderNumber })}</div>

        {hasKitchen && (
          <>
            <hr className="kitchen-separator" />
            <div className="kitchen-section-title">{t('kitchen')}</div>
            <hr className="kitchen-separator" />
            {groups.kitchen.map((item) => (
              <div key={item.id}>
                <div className="kitchen-row">
                  <span className="kitchen-qty">×{item.quantity}</span>
                  <span>{item.nameSnapshot}</span>
                </div>
                {item.notes && <div className="kitchen-notes">{item.notes}</div>}
              </div>
            ))}
          </>
        )}

        {hasBar && (
          <>
            <hr className="kitchen-separator" />
            <div className="kitchen-section-title">{t('bar')}</div>
            <hr className="kitchen-separator" />
            {groups.bar.map((item) => (
              <div key={item.id}>
                <div className="kitchen-row">
                  <span className="kitchen-qty">×{item.quantity}</span>
                  <span>{item.nameSnapshot}</span>
                </div>
                {item.notes && <div className="kitchen-notes">{item.notes}</div>}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="no-print" style={{ padding: '16px', display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => window.print()} style={{ padding: '8px 16px' }}>
          {t('print')}
        </button>
        <button type="button" onClick={() => window.close()} style={{ padding: '8px 16px' }}>
          {t('close')}
        </button>
      </div>
    </>
  );
}
