'use client';

import { PIN_MAX_DIGITS, PIN_MIN_DIGITS } from '@/lib/tpv/auth-constants';
import { trpc } from '@/lib/trpc/client';
import { Delete, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useReducer } from 'react';

interface EmployeeRef {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'admin' | 'manager' | 'worker';
}

interface PinKeypadProps {
  employeeId: string;
  employeeName: string;
  onSuccess: (sessionToken: string, employee: EmployeeRef) => void;
  onBack: () => void;
}

interface PinState {
  digits: string;
  submitting: boolean;
  error: string | null;
  lockedUntil: Date | null;
}

type PinAction =
  | { type: 'DIGIT'; digit: string }
  | { type: 'BACKSPACE' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string; lockedUntil?: Date }
  | { type: 'SUBMIT_SUCCESS' };

function pinReducer(state: PinState, action: PinAction): PinState {
  switch (action.type) {
    case 'DIGIT':
      if (state.submitting || state.digits.length >= PIN_MAX_DIGITS) return state;
      return { ...state, digits: state.digits + action.digit, error: null };
    case 'BACKSPACE':
      return { ...state, digits: state.digits.slice(0, -1), error: null };
    case 'CLEAR':
      return { ...state, digits: '', error: null };
    case 'SUBMIT_START':
      return { ...state, submitting: true, error: null };
    case 'SUBMIT_ERROR':
      return {
        ...state,
        submitting: false,
        digits: '',
        error: action.error,
        lockedUntil: action.lockedUntil ?? null,
      };
    case 'SUBMIT_SUCCESS':
      return { ...state, submitting: false, digits: '' };
    default:
      return state;
  }
}

export function PinKeypad({ employeeId, employeeName, onSuccess, onBack }: PinKeypadProps) {
  const t = useTranslations('tpv.auth');
  const [state, dispatch] = useReducer(pinReducer, {
    digits: '',
    submitting: false,
    error: null,
    lockedUntil: null,
  });

  const loginMutation = trpc.auth.employeeLogin.useMutation({
    onSuccess: ({ sessionToken, employee }) => {
      dispatch({ type: 'SUBMIT_SUCCESS' });
      onSuccess(sessionToken, employee);
    },
    onError: (err) => {
      const code = err.data?.code as string | undefined;
      if (code === 'TOO_MANY_REQUESTS') {
        dispatch({ type: 'SUBMIT_ERROR', error: t('login.errors.rateLimit') });
      } else if (code === 'FORBIDDEN') {
        const match = err.message.match(/Account locked until (.+)/);
        const until = match?.[1] ? new Date(match[1]) : null;
        dispatch({
          type: 'SUBMIT_ERROR',
          error: until
            ? t('login.errors.accountLocked', {
                time: until.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
              })
            : t('login.errors.generic'),
          lockedUntil: until ?? undefined,
        });
      } else {
        dispatch({ type: 'SUBMIT_ERROR', error: t('login.errors.invalidCredentials') });
      }
    },
  });

  const handleDigit = (digit: string) => {
    if (state.submitting) return;
    const newDigits = state.digits + digit;
    if (newDigits.length > PIN_MAX_DIGITS) return;
    dispatch({ type: 'DIGIT', digit });
    // Auto-submit when minimum PIN length reached
    if (newDigits.length >= PIN_MIN_DIGITS) {
      dispatch({ type: 'SUBMIT_START' });
      loginMutation.mutate({ employeeId, pin: newDigits });
    }
  };

  const isLocked = !!state.lockedUntil && state.lockedUntil > new Date();
  const keypadDisabled = state.submitting || isLocked;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
      <div className="text-center space-y-3">
        <p className="text-base font-medium text-foreground">
          {t('login.enterPinFor', { name: employeeName })}
        </p>
        {/* PIN dot indicator */}
        <div className="flex items-center justify-center gap-3" aria-hidden="true">
          {(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] as const).map((key, pos) => (
            <div
              key={key}
              className={`h-3 w-3 rounded-full transition-colors duration-[var(--duration-fast)] ${
                pos < state.digits.length ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive text-center">
          {state.error}
        </p>
      )}

      {/* Numeric keypad: 1-9 then clear/0/backspace */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <KeypadButton
            key={d}
            label={d}
            onClick={() => handleDigit(d)}
            disabled={keypadDisabled || state.digits.length >= PIN_MAX_DIGITS}
          />
        ))}

        <KeypadButton
          label={<X className="h-5 w-5" aria-hidden="true" />}
          ariaLabel={t('keypad.clear')}
          onClick={() => dispatch({ type: 'CLEAR' })}
          disabled={keypadDisabled}
          variant="ghost"
        />
        <KeypadButton
          label="0"
          onClick={() => handleDigit('0')}
          disabled={keypadDisabled || state.digits.length >= PIN_MAX_DIGITS}
        />
        <KeypadButton
          label={<Delete className="h-5 w-5" aria-hidden="true" />}
          ariaLabel={t('keypad.backspace')}
          onClick={() => dispatch({ type: 'BACKSPACE' })}
          disabled={keypadDisabled}
          variant="ghost"
        />
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-4"
      >
        ← {t('login.changeEmployee')}
      </button>
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
