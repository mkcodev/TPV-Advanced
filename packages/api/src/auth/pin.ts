import { Algorithm, hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  outputLen: 32,
  parallelism: 1,
} as const;

// Pre-computed at module load; used when the employee doesn't exist so that
// the response time is indistinguishable from a real (but failed) PIN check.
// This prevents timing side-channels that reveal whether an employee ID is valid.
export const DUMMY_HASH_PROMISE: Promise<string> = hash(
  '__dummy_pin_for_timing_protection__',
  ARGON2_OPTIONS,
);

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, ARGON2_OPTIONS);
}

export async function verifyPin(pinHash: string, pin: string): Promise<boolean> {
  try {
    return await verify(pinHash, pin, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
