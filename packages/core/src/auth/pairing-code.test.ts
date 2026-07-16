import { describe, expect, it } from 'vitest';
import { PAIRING_CODE_LENGTH } from './constants';
import { generatePairingCode, isPairingCodeRedeemable } from './pairing-code';

const NOW = new Date('2025-01-01T12:00:00Z');
const FUTURE = new Date(NOW.getTime() + 10_000);
const PAST = new Date(NOW.getTime() - 1);

describe('generatePairingCode', () => {
  it(`produces a ${PAIRING_CODE_LENGTH}-digit string`, () => {
    const code = generatePairingCode(() => 5);
    expect(code).toHaveLength(PAIRING_CODE_LENGTH);
    expect(/^\d+$/.test(code)).toBe(true);
  });

  it('zero-pads when randomInt returns 0', () => {
    const code = generatePairingCode(() => 0);
    expect(code).toBe('00000000');
  });

  it('uses the injected randomInt correctly', () => {
    let n = 0;
    const code = generatePairingCode(() => n++ % 10);
    expect(code).toBe('01234567');
  });
});

describe('isPairingCodeRedeemable', () => {
  it('returns true for a valid, unused, non-expired code', () => {
    expect(isPairingCodeRedeemable({ expiresAt: FUTURE, usedAt: null }, NOW)).toBe(true);
  });

  it('returns false for an expired code', () => {
    expect(isPairingCodeRedeemable({ expiresAt: PAST, usedAt: null }, NOW)).toBe(false);
  });

  it('returns false for an already used code', () => {
    expect(isPairingCodeRedeemable({ expiresAt: FUTURE, usedAt: PAST }, NOW)).toBe(false);
  });
});
