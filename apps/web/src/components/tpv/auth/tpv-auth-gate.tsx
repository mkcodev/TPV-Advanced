'use client';

import { useDeviceStore } from '@/lib/stores/use-device-store';
import { useEmployeeStore } from '@/lib/stores/use-employee-store';
import { useEffect, useState } from 'react';
import { DevicePairingScreen } from './device-pairing-screen';
import { EmployeeLoginScreen } from './employee-login-screen';
import { IdleWatcher } from './idle-watcher';

// Returns true if the employee session JWT is still within its validity window.
function isSessionValid(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() < expiresAt;
}

export function TpvAuthGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Rehydrate both stores from storage before making any auth decisions.
    // skipHydration prevents SSR mismatch; we rehydrate manually here.
    Promise.all([useDeviceStore.persist.rehydrate(), useEmployeeStore.persist.rehydrate()]).then(
      () => setHydrated(true),
    );
  }, []);

  const deviceToken = useDeviceStore((s) => s.deviceToken);
  const session = useEmployeeStore((s) => s.session);
  const expiresAt = useEmployeeStore((s) => s.expiresAt);

  if (!hydrated) {
    return <TpvAuthSplash />;
  }

  if (!deviceToken) {
    return <DevicePairingScreen />;
  }

  if (!session || !isSessionValid(expiresAt)) {
    return <EmployeeLoginScreen />;
  }

  return (
    <>
      <IdleWatcher />
      {children}
    </>
  );
}

function TpvAuthSplash() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Cargando terminal…</span>
      </div>
    </div>
  );
}
