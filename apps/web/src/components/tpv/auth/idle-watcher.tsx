'use client';

import { useEmployeeStore } from '@/lib/stores/use-employee-store';
import { IDLE_LOCK_MS } from '@/lib/tpv/auth-constants';
import { useEffect, useRef } from 'react';

const WATCHED_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

// Locks the employee session after IDLE_LOCK_MS of inactivity.
// Guards against React StrictMode double-invocation with a mounted ref.
export function IdleWatcher() {
  const lock = useEmployeeStore((s) => s.lock);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(lock, IDLE_LOCK_MS);
    };

    for (const ev of WATCHED_EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }
    reset();

    return () => {
      for (const ev of WATCHED_EVENTS) {
        window.removeEventListener(ev, reset);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      mountedRef.current = false;
    };
  }, [lock]);

  return null;
}
