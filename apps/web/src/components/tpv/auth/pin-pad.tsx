'use client';

import { PIN_MAX_DIGITS } from '@/lib/tpv/auth-constants';
import { Delete, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PinPadProps {
  digits: string;
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}

// Teclado numérico + indicador de puntos, sin lógica de envío: lo comparten el login del TPV
// (PinKeypad, que envía solo al llegar a 4 dígitos) y la anulación de líneas con PIN de encargado
// (que espera a un botón de confirmar, así vale un PIN de 4 a 6 dígitos).
export function PinPad({ digits, disabled = false, onDigit, onClear, onBackspace }: PinPadProps) {
  const t = useTranslations('tpv.auth');
  const full = digits.length >= PIN_MAX_DIGITS;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex items-center justify-center gap-3" aria-hidden="true">
        {(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] as const).map((key, pos) => (
          <div
            key={key}
            className={`h-3 w-3 rounded-full transition-colors duration-[var(--duration-fast)] ${
              pos < digits.length ? 'bg-primary' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Numeric keypad: 1-9 then clear/0/backspace */}
      <div className="grid w-full grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <KeypadButton key={d} label={d} onClick={() => onDigit(d)} disabled={disabled || full} />
        ))}

        <KeypadButton
          label={<X className="h-5 w-5" aria-hidden="true" />}
          ariaLabel={t('keypad.clear')}
          onClick={onClear}
          disabled={disabled}
          variant="ghost"
        />
        <KeypadButton label="0" onClick={() => onDigit('0')} disabled={disabled || full} />
        <KeypadButton
          label={<Delete className="h-5 w-5" aria-hidden="true" />}
          ariaLabel={t('keypad.backspace')}
          onClick={onBackspace}
          disabled={disabled}
          variant="ghost"
        />
      </div>
    </div>
  );
}

interface KeypadButtonProps {
  label: React.ReactNode;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'ghost';
}

function KeypadButton({
  label,
  ariaLabel,
  onClick,
  disabled,
  variant = 'default',
}: KeypadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'flex min-h-16 min-w-16 items-center justify-center rounded-xl text-xl font-semibold',
        'transition-colors duration-[var(--duration-fast)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'ghost'
          ? 'text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted'
          : 'bg-card border border-border text-foreground hover:bg-muted active:scale-95',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
