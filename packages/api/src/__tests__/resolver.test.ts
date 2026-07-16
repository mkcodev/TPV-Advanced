import type { Database } from '@tpv/db';
import { describe, expect, it, vi } from 'vitest';
import { createAuthResolver } from '../auth/resolver';
import { signEmployeeSession } from '../auth/session';
import type { JwtVerifier } from '../auth/supabase-jwt';
import { sha256Base64Url } from '../auth/tokens';

const SESSION_SECRET = 'test-secret-that-is-long-enough-for-hs256';

// Minimal DB stub that simulates a device lookup by token hash.
function makeDb(device: { id: string; businessId: string } | null): Database {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(device ? [{ ...device, isActive: true, deviceTokenHash: '' }] : []),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    query: {
      businesses: { findFirst: () => Promise.resolve(null) },
    },
    // biome-ignore lint/suspicious/noExplicitAny: stub
  } as unknown as Database;
}

// DB stub for admin path with business membership lookup.
function makeAdminDb(hasAccess: boolean): Database {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve(hasAccess ? [{ id: 'biz-1' }] : []),
            }),
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    // biome-ignore lint/suspicious/noExplicitAny: stub
  } as unknown as Database;
}

const VALID_DEVICE_TOKEN = 'valid-device-token-32-bytes-xxxxxx';
const VALID_DEVICE = { id: 'dev-1', businessId: 'biz-1' };

const noopJwtVerifier: JwtVerifier = async () => null;

describe('createAuthResolver', () => {
  it('returns anonymous when no credentials are provided', async () => {
    const resolver = createAuthResolver({
      db: makeDb(null),
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: noopJwtVerifier,
    });
    const result = await resolver.resolveAuth({ headers: new Headers() });
    expect(result).toEqual({ kind: 'anonymous' });
  });

  it('resolves device auth from x-device-token header', async () => {
    const db = makeDb(VALID_DEVICE);
    const resolver = createAuthResolver({
      db,
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: noopJwtVerifier,
    });
    const headers = new Headers({ 'x-device-token': VALID_DEVICE_TOKEN });
    const result = await resolver.resolveAuth({ headers });
    expect(result).toEqual({
      kind: 'device',
      deviceId: VALID_DEVICE.id,
      businessId: VALID_DEVICE.businessId,
      employeeId: null,
    });
  });

  it('extracts employeeId from a valid x-employee-session', async () => {
    const db = makeDb(VALID_DEVICE);
    const resolver = createAuthResolver({
      db,
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: noopJwtVerifier,
    });
    const sessionToken = await signEmployeeSession(
      { employeeId: 'emp-1', deviceId: VALID_DEVICE.id },
      SESSION_SECRET,
    );
    const headers = new Headers({
      'x-device-token': VALID_DEVICE_TOKEN,
      'x-employee-session': sessionToken,
    });
    const result = await resolver.resolveAuth({ headers });
    expect(result).toMatchObject({ kind: 'device', employeeId: 'emp-1' });
  });

  it('ignores employee session when deviceId does not match', async () => {
    const db = makeDb(VALID_DEVICE);
    const resolver = createAuthResolver({
      db,
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: noopJwtVerifier,
    });
    // Session was issued for a DIFFERENT device
    const sessionToken = await signEmployeeSession(
      { employeeId: 'emp-1', deviceId: 'dev-WRONG' },
      SESSION_SECRET,
    );
    const headers = new Headers({
      'x-device-token': VALID_DEVICE_TOKEN,
      'x-employee-session': sessionToken,
    });
    const result = await resolver.resolveAuth({ headers });
    expect(result).toMatchObject({ kind: 'device', employeeId: null });
  });

  it('returns anonymous when device token is invalid', async () => {
    const db = makeDb(null); // device not found
    const resolver = createAuthResolver({
      db,
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: noopJwtVerifier,
    });
    const headers = new Headers({ 'x-device-token': 'invalid-token' });
    const result = await resolver.resolveAuth({ headers });
    expect(result).toEqual({ kind: 'anonymous' });
  });

  it('resolves admin auth from Bearer JWT with valid business', async () => {
    const db = makeAdminDb(true);
    const mockVerifier: JwtVerifier = async () => ({ userId: 'user-1' });
    const resolver = createAuthResolver({
      db,
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: mockVerifier,
    });
    const headers = new Headers({
      authorization: 'Bearer valid.jwt.token',
      'x-business-id': 'biz-1',
    });
    const result = await resolver.resolveAuth({ headers });
    expect(result).toEqual({ kind: 'admin', userId: 'user-1', businessId: 'biz-1' });
  });

  it('sets businessId to null when admin has no access to requested business', async () => {
    const db = makeAdminDb(false);
    const mockVerifier: JwtVerifier = async () => ({ userId: 'user-1' });
    const resolver = createAuthResolver({
      db,
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: mockVerifier,
    });
    const headers = new Headers({
      authorization: 'Bearer valid.jwt.token',
      'x-business-id': 'biz-OTHER',
    });
    const result = await resolver.resolveAuth({ headers });
    expect(result).toEqual({ kind: 'admin', userId: 'user-1', businessId: null });
  });

  it('returns anonymous when Bearer JWT is invalid', async () => {
    const db = makeAdminDb(false);
    const resolver = createAuthResolver({
      db,
      sessionSecret: SESSION_SECRET,
      verifySupabaseJwt: noopJwtVerifier, // always returns null
    });
    const headers = new Headers({ authorization: 'Bearer bad.jwt' });
    const result = await resolver.resolveAuth({ headers });
    expect(result).toEqual({ kind: 'anonymous' });
  });
});
