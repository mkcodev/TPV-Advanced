import { createHash, randomBytes } from 'node:crypto';

// Generates a cryptographically random device token (32 bytes → base64url).
// The cleartext is returned once at pairing; only the SHA-256 hash is stored.
export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

// Deterministic hash for lookups — O(1) via unique index on devices.device_token_hash.
export function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
