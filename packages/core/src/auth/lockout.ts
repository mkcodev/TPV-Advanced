import { LOCKOUT_MS, MAX_PIN_ATTEMPTS } from './constants';

export type LockoutState = { locked: false } | { locked: true; until: Date };

export interface EmployeeLockoutData {
  failedPinAttempts: number;
  lockedUntil: Date | null;
}

export function checkLockout(e: EmployeeLockoutData, now: Date): LockoutState {
  if (e.lockedUntil && e.lockedUntil > now) {
    return { locked: true, until: e.lockedUntil };
  }
  return { locked: false };
}

export interface PinFailureResult {
  failedPinAttempts: number;
  lockedUntil: Date | null;
  justLocked: boolean;
}

export function applyPinFailure(e: EmployeeLockoutData, now: Date): PinFailureResult {
  const next = e.failedPinAttempts + 1;
  const justLocked = next >= MAX_PIN_ATTEMPTS;
  return {
    failedPinAttempts: next,
    lockedUntil: justLocked ? new Date(now.getTime() + LOCKOUT_MS) : null,
    justLocked,
  };
}

export function applyPinSuccess(): { failedPinAttempts: number; lockedUntil: null } {
  return { failedPinAttempts: 0, lockedUntil: null };
}
