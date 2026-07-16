import { PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MS } from './constants';

// randomInt receives the modulus (exclusive) and returns a value in [0, max).
// Inject real crypto randomness in production; deterministic fn in tests.
export function generatePairingCode(randomInt: (maxExclusive: number) => number): string {
  let code = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += String(randomInt(10));
  }
  return code;
}

export interface PairingCodeRow {
  expiresAt: Date;
  usedAt: Date | null;
}

export function isPairingCodeRedeemable(row: PairingCodeRow, now: Date): boolean {
  return row.usedAt === null && row.expiresAt > now;
}

export function pairingCodeExpiresAt(now: Date): Date {
  return new Date(now.getTime() + PAIRING_CODE_TTL_MS);
}
