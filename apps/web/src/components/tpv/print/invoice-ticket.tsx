'use client';

// ⚖️ Verificar spec AEAT vigente antes de producción real.
// El QR y el label VERI*FACTU son Fase 2 (billing_records).

import { trpc } from '@/lib/trpc/client';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

type Props = { orderId: string };

function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return `${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function padInvoiceNumber(n: number): string {
  return String(n).padStart(4, '0');
}

export function InvoiceTicket({ orderId }: Props) {
  const t = useTranslations('tpv.ticket');
  const { data, isLoading } = trpc.orders.getInvoice.useQuery({ orderId });

  useEffect(() => {
    if (data) {
      window.print();
    }
  }, [data]);

  if (isLoading || !data) {
    return <div className="ticket-80mm no-print">{t('loading')}</div>;
  }

  const { invoice, taxLines, order, items, business } = data;

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .ticket-80mm { width: 80mm; }
          .no-print { display: none !important; }
        }
        .ticket-80mm {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.4;
          width: 80mm;
          max-width: 80mm;
          padding: 8px;
          color: #000;
          background: #fff;
        }
        .ticket-separator { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .ticket-row { display: flex; justify-content: space-between; }
        .ticket-center { text-align: center; }
        .ticket-bold { font-weight: bold; }
        .ticket-big { font-size: 14px; }
        .qr-placeholder {
          border: 1px dashed #999;
          padding: 12px;
          text-align: center;
          margin: 8px 0;
          font-size: 9px;
          color: #666;
        }
      `}</style>

      <div className="ticket-80mm">
        {/* Cabecera del negocio */}
        <div className="ticket-center ticket-bold">{business?.name ?? '—'}</div>
        {business?.legalName && <div className="ticket-center">{business.legalName}</div>}
        {business?.taxId && <div className="ticket-center">CIF: {business.taxId}</div>}
        {business?.address && <div className="ticket-center">{business.address}</div>}

        <hr className="ticket-separator" />

        {/* Cabecera de factura */}
        <div className="ticket-center ticket-bold">FACTURA SIMPLIFICADA</div>
        <div className="ticket-center">
          {t('series', { series: invoice.series, number: padInvoiceNumber(invoice.number) })}
        </div>
        <div className="ticket-center">{formatDate(invoice.issueDate)}</div>

        <hr className="ticket-separator" />

        {/* Líneas */}
        {items.map((item) => (
          <div key={item.id}>
            <div className="ticket-row">
              <span>
                {item.quantity}× {item.nameSnapshot}
              </span>
              <span>{formatCents(item.lineTotalCents)}</span>
            </div>
            {item.notes && <div style={{ paddingLeft: '12px', color: '#555' }}>{item.notes}</div>}
          </div>
        ))}

        <hr className="ticket-separator" />

        {/* Desglose IVA */}
        {taxLines.map((tl) => (
          <div key={tl.taxRate}>
            <div className="ticket-row">
              <span>{t('iva', { rate: tl.taxRate })}</span>
            </div>
            <div className="ticket-row" style={{ paddingLeft: '8px' }}>
              <span>
                {t('base')}: {formatCents(tl.baseCents)}
              </span>
              <span>
                {t('share')}: {formatCents(tl.taxCents)}
              </span>
            </div>
          </div>
        ))}

        <hr className="ticket-separator" />

        {/* Total */}
        <div className="ticket-row ticket-bold ticket-big">
          <span>{t('total')}</span>
          <span>{formatCents(invoice.totalCents)}</span>
        </div>

        <hr className="ticket-separator" />

        {/* Pie */}
        <div className="ticket-center">{t('order', { number: order?.orderNumber ?? '—' })}</div>

        {/* Fase 2: QR AEAT + label VERI*FACTU */}
        <div className="qr-placeholder">
          {/* Fase 2: aquí irá el QR de verificación AEAT (billing_records.qrContent) */}
          {t('noQrYet')}
        </div>
      </div>

      {/* Botones — solo en pantalla */}
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
