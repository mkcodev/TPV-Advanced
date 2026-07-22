'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { BillButton } from './bill-button';
import { ChangeDisplay } from './change-display';
import { MoneyKeypad } from './money-keypad';

const BILL_CENTS = [500, 1000, 2000, 5000] as const;

interface CashPanelProps {
  /** Importe restante a cubrir (en céntimos) */
  amountCents: number;
  cashReceivedCents: number | null;
  onChange: (cents: number | null) => void;
}

export function CashPanel({ amountCents, cashReceivedCents, onChange }: CashPanelProps) {
  const t = useTranslations('tpv.order.payment');
  const [showKeypad, setShowKeypad] = useState(false);

  const handleBill = (bill: number) => {
    // Billetes siempre >= 0. Si es menor que el importe se ignora el cambio (change negativo bloqueado en UI).
    onChange(bill);
    setShowKeypad(false);
  };

  const changeCents =
    cashReceivedCents !== null && cashReceivedCents >= amountCents
      ? cashReceivedCents - amountCents
      : null;

  if (showKeypad) {
    return (
      <MoneyKeypad
        valueCents={cashReceivedCents ?? 0}
        onChange={(c) => onChange(c === 0 ? null : c)}
        onClose={() => setShowKeypad(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Botones de billetes rápidos */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BILL_CENTS.map((bill) => (
          <BillButton key={bill} valueCents={bill} onSelect={handleBill} />
        ))}
      </div>

      {/* Importe exacto + Otro importe */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleBill(amountCents)}
          className={[
            'flex min-h-11 items-center justify-center rounded-lg border px-3 py-2',
            'text-sm font-medium transition-colors duration-[var(--duration-fast)]',
            'border-border bg-card text-foreground hover:bg-muted',
          ].join(' ')}
        >
          {t('exactAmount')}
        </button>
        <button
          type="button"
          onClick={() => setShowKeypad(true)}
          className={[
            'flex min-h-11 items-center justify-center rounded-lg border px-3 py-2',
            'text-sm font-medium transition-colors duration-[var(--duration-fast)]',
            'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          ].join(' ')}
        >
          {t('otherAmount')}
        </button>
      </div>

      {/* Display de cambio */}
      {changeCents !== null && (
        <div key={changeCents}>
          <ChangeDisplay changeCents={changeCents} />
        </div>
      )}
    </div>
  );
}
