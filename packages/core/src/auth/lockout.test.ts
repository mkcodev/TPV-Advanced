import { describe, expect, it } from 'vitest';
import { MAX_PIN_ATTEMPTS } from './constants';
import { applyPinFailure, applyPinSuccess, checkLockout } from './lockout';

const NOW = new Date('2025-01-01T12:00:00Z');

describe('checkLockout', () => {
  it('returns locked:false when lockedUntil is null', () => {
    expect(checkLockout({ failedPinAttempts: 0, lockedUntil: null }, NOW)).toEqual({
      locked: false,
    });
  });

  it('returns locked:true with until when still within lock window', () => {
    const until = new Date(NOW.getTime() + 60_000);
    expect(checkLockout({ failedPinAttempts: 5, lockedUntil: until }, NOW)).toEqual({
      locked: true,
      until,
    });
  });

  it('returns locked:false after lockout window expires', () => {
    const past = new Date(NOW.getTime() - 1);
    expect(checkLockout({ failedPinAttempts: 5, lockedUntil: past }, NOW)).toEqual({
      locked: false,
    });
  });
});

describe('applyPinFailure', () => {
  it('increments failedPinAttempts without locking below threshold', () => {
    const result = applyPinFailure({ failedPinAttempts: 0, lockedUntil: null }, NOW);
    expect(result.failedPinAttempts).toBe(1);
    expect(result.justLocked).toBe(false);
    expect(result.lockedUntil).toBeNull();
  });

  it(`locks on the ${MAX_PIN_ATTEMPTS}th failure`, () => {
    const result = applyPinFailure(
      { failedPinAttempts: MAX_PIN_ATTEMPTS - 1, lockedUntil: null },
      NOW,
    );
    expect(result.justLocked).toBe(true);
    expect(result.lockedUntil).not.toBeNull();
    expect(result.lockedUntil?.getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe('applyPinSuccess', () => {
  it('resets counter and clears lockout', () => {
    expect(applyPinSuccess()).toEqual({ failedPinAttempts: 0, lockedUntil: null });
  });
});
