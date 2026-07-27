'use client';

import { trpc } from '@/lib/trpc/client';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

type Props = { sessionId: string };

function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return `${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ZReport({ sessionId }: Props) {
  const t = useTranslations('tpv.cash.zReport');
  const { data, isLoading } = trpc.cashSession.getZReport.useQuery({ sessionId });

  useEffect(() => {
    if (data) {
      window.print();
    }
  }, [data]);

  if (isLoading || !data) {
    return <div className="ticket-80mm no-print">{t('loading')}</div>;
  }

  const { session, business, byMethod, byEmployee, movements, employeeMap } = data;
  const isOpenSession = session.status === 'open';

  const methodLabels: Record<string, string> = {
    cash: t('method.cash'),
    card: t('method.card'),
    bizum: t('method.bizum'),
    other: t('method.other'),
  };

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
        .ticket-muted { color: #555; font-size: 10px; padding-left: 8px; }
        .ticket-diff { color: #c00; }
      `}</style>

      <div className="ticket-80mm">
        {/* Cabecera negocio */}
        <div className="ticket-center ticket-bold">{business?.name ?? '—'}</div>
        {business?.legalName && <div className="ticket-center">{business.legalName}</div>}
        {business?.taxId && <div className="ticket-center">CIF: {business.taxId}</div>}

        <hr className="ticket-separator" />

        <div className="ticket-center ticket-bold ticket-big">
          {isOpenSession ? t('xTitle') : t('title')}
        </div>

        <hr className="ticket-separator" />

        {/* Apertura / cierre */}
        <div className="ticket-row">
          <span>{t('openedAt')}</span>
          <span>{formatDate(session.openedAt)}</span>
        </div>
        {session.openedBy && (
          <div className="ticket-row">
            <span>{t('openedBy')}</span>
            <span>{employeeMap[session.openedBy] ?? '—'}</span>
          </div>
        )}
        {session.closedAt && (
          <div className="ticket-row">
            <span>{t('closedAt')}</span>
            <span>{formatDate(session.closedAt)}</span>
          </div>
        )}
        {session.closedBy && (
          <div className="ticket-row">
            <span>{t('closedBy')}</span>
            <span>{employeeMap[session.closedBy] ?? '—'}</span>
          </div>
        )}

        <hr className="ticket-separator" />

        {/* Fondo inicial */}
        <div className="ticket-row">
          <span>{t('opening')}</span>
          <span>{formatCents(session.openingAmountCents)}</span>
        </div>

        <hr className="ticket-separator" />

        {/* Ventas por método */}
        <div className="ticket-bold">{t('byMethod')}</div>
        {Object.keys(byMethod).length === 0 && (
          <div className="ticket-center" style={{ color: '#999' }}>
            —
          </div>
        )}
        {Object.entries(byMethod).map(([method, agg]) => (
          <div key={method} className="ticket-row">
            <span>{methodLabels[method] ?? method}</span>
            <span>{formatCents(agg.amountCents)}</span>
          </div>
        ))}

        {/* Ventas por empleado */}
        {Object.keys(byEmployee).length > 0 && (
          <>
            <hr className="ticket-separator" />
            <div className="ticket-bold">{t('byEmployee')}</div>
            {Object.entries(byEmployee).map(([empId, agg]) => (
              <div key={empId} className="ticket-row">
                <span>{employeeMap[empId] ?? '—'}</span>
                <span>{formatCents(agg.amountCents)}</span>
              </div>
            ))}
          </>
        )}

        <hr className="ticket-separator" />

        {/* Movimientos de caja */}
        <div className="ticket-bold">{t('movements')}</div>
        {movements.length === 0 && (
          <div className="ticket-center" style={{ color: '#999' }}>
            —
          </div>
        )}
        {movements.map((m) => (
          <div key={m.id}>
            <div className="ticket-row">
              <span>{m.type === 'pay_in' ? t('payIn') : t('payOut')}</span>
              <span>
                {m.type === 'pay_out'
                  ? `-${formatCents(m.amountCents)}`
                  : formatCents(m.amountCents)}
              </span>
            </div>
            {m.reason && <div className="ticket-muted">{m.reason}</div>}
          </div>
        ))}

        {/* Cuadre — solo visible en sesión cerrada */}
        {!isOpenSession && (
          <>
            <hr className="ticket-separator" />
            {session.expectedAmountCents != null && (
              <div className="ticket-row">
                <span>{t('expected')}</span>
                <span>{formatCents(session.expectedAmountCents)}</span>
              </div>
            )}
            {session.countedAmountCents != null && (
              <div className="ticket-row ticket-bold">
                <span>{t('counted')}</span>
                <span>{formatCents(session.countedAmountCents)}</span>
              </div>
            )}
            {session.differenceCents != null && (
              <div
                className={`ticket-row ticket-bold${session.differenceCents !== 0 ? ' ticket-diff' : ''}`}
              >
                <span>{t('difference')}</span>
                <span>{formatCents(session.differenceCents)}</span>
              </div>
            )}
          </>
        )}
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
