'use client';

import { Delete } from 'lucide-react';

interface MoneyKeypadProps {
  /** Importe actual en céntimos */
  valueCents: number;
  onChange: (cents: number) => void;
  onClose: () => void;
}

// Convierte el buffer de dígitos (en céntimos) a string con 2 decimales.
function formatBuffer(cents: number): string {
  const euros = Math.floor(cents / 100);
  const ctm = cents % 100;
  return `${euros},${String(ctm).padStart(2, '0')} €`;
}

export function MoneyKeypad({ valueCents, onChange, onClose }: MoneyKeypadProps) {
  const handleDigit = (digit: string) => {
    // Shift left: multiplica por 10, añade dígito.
    const next = valueCents * 10 + Number(digit);
    if (next > 99999_99) return; // límite 999.999,99 €
    onChange(next);
  };

  const handleBackspace = () => {
    onChange(Math.floor(valueCents / 10));
  };

  const handleClear = () => onChange(0);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Display */}
      <div className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-right">
        <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
          {formatBuffer(valueCents)}
        </span>
      </div>

      {/* Keypad */}
      <div className="grid w-full grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <KeypadBtn key={d} label={d} onClick={() => handleDigit(d)} />
        ))}
        <KeypadBtn label="C" onClick={handleClear} variant="ghost" />
        <KeypadBtn label="0" onClick={() => handleDigit('0')} />
        <KeypadBtn
          label={<Delete size={18} aria-hidden="true" />}
          ariaLabel="Borrar último dígito"
          onClick={handleBackspace}
          variant="ghost"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg border border-border bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Aceptar
      </button>
    </div>
  );
}

interface KeypadBtnProps {
  label: React.ReactNode;
  ariaLabel?: string;
  onClick: () => void;
  variant?: 'default' | 'ghost';
}

function KeypadBtn({ label, ariaLabel, onClick, variant = 'default' }: KeypadBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        'flex min-h-[3.5rem] items-center justify-center rounded-lg text-base font-semibold',
        'transition-colors duration-[var(--duration-fast)] active:scale-95',
        variant === 'ghost'
          ? 'text-muted-foreground hover:bg-muted'
          : 'border border-border bg-card text-foreground hover:bg-muted',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
