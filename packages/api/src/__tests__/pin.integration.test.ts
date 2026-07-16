// Light integration test: uses real argon2 (NAPI) to hash and verify.
// Excluded from the fast unit test suite; runs with `pnpm --filter @tpv/api test`.
import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from '../auth/pin';

describe('PIN hashing (argon2id)', () => {
  it('hashes a PIN and verifies it correctly', async () => {
    const pin = '1234';
    const hash = await hashPin(pin);
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPin(hash, pin)).resolves.toBe(true);
  });

  it('rejects a wrong PIN', async () => {
    const hash = await hashPin('1234');
    await expect(verifyPin(hash, '9999')).resolves.toBe(false);
  });

  it('generates different hashes for the same PIN (salt is random)', async () => {
    const [a, b] = await Promise.all([hashPin('5678'), hashPin('5678')]);
    expect(a).not.toBe(b);
  });
});
