'use client';

import { useDeviceStore } from '@/lib/stores/use-device-store';
import { trpc } from '@/lib/trpc/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function DevicePairingScreen() {
  const t = useTranslations('tpv.auth.pairing');
  const setPaired = useDeviceStore((s) => s.setPaired);

  const [code, setCode] = useState('');
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pairMutation = trpc.auth.pairDevice.useMutation({
    onSuccess: ({ deviceToken, device }) => {
      setPaired(deviceToken, { id: device.id, name: device.name, type: device.type });
    },
    onError: (err) => {
      if (err.data?.code === 'TOO_MANY_REQUESTS') {
        setError(t('errors.rateLimit'));
      } else if (err.data?.code === 'NOT_FOUND') {
        setError(t('errors.invalidCode'));
      } else {
        setError(t('errors.generic'));
      }
    },
  });

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6,8}$/.test(code)) {
      setError(t('errors.invalidCode'));
      return;
    }
    pairMutation.mutate({ code });
  };

  const handleDevToken = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = devToken.trim();
    if (!trimmed) return;
    // In dev mode, we accept the raw token printed by the seed.
    // Store it with a placeholder device object; real device metadata isn't needed here.
    setPaired(trimmed, { id: 'dev', name: 'Terminal Demo', type: 'pos_terminal' });
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / identity */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
            T
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="text-center text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Pairing code form */}
        <form onSubmit={handleSubmitCode} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pairing-code" className="text-sm font-medium text-foreground">
              {t('codeLabel')}
            </label>
            <input
              id="pairing-code"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={8}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              placeholder={t('codePlaceholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-2xl tracking-[0.5em] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-describedby={error ? 'pairing-error' : undefined}
              autoComplete="off"
            />
          </div>

          {error && (
            <p id="pairing-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pairMutation.isPending || code.length < 6}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50 hover:opacity-90 active:opacity-80 min-h-[44px]"
          >
            {pairMutation.isPending ? t('submitting') : t('submit')}
          </button>
        </form>

        {/* Dev-mode shortcut — only rendered in development builds */}
        {process.env.NODE_ENV === 'development' && (
          <details className="border border-border rounded-md p-4 space-y-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none">
              {t('devTokenTitle')}
            </summary>
            <form onSubmit={handleDevToken} className="mt-3 space-y-3">
              <label htmlFor="dev-token" className="text-xs text-muted-foreground">
                {t('devTokenLabel')}
              </label>
              <textarea
                id="dev-token"
                rows={3}
                value={devToken}
                onChange={(e) => setDevToken(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Pegar el token del seed aquí…"
              />
              <button
                type="submit"
                disabled={!devToken.trim()}
                className="w-full rounded-md border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 min-h-[44px]"
              >
                {t('devTokenSubmit')}
              </button>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
