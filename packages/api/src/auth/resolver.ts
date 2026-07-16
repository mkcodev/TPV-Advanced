import { businesses, devices, memberships, organizations } from '@tpv/db';
import type { Database } from '@tpv/db';
import { and, eq } from 'drizzle-orm';
import type { AuthContext } from '../context';
import { verifyEmployeeSession } from './session';
import type { JwtVerifier } from './supabase-jwt';
import { sha256Base64Url } from './tokens';

interface ResolverDeps {
  db: Database;
  sessionSecret: string;
  verifySupabaseJwt: JwtVerifier;
}

// The resolver NEVER throws — any invalid credential yields {kind:'anonymous'}.
// The businessProcedure / role procedures handle the rejection with proper codes.
export function createAuthResolver(deps: ResolverDeps) {
  return {
    async resolveAuth({ headers }: { headers: Headers }): Promise<AuthContext> {
      // --- Device path: x-device-token header ---
      const deviceToken = headers.get('x-device-token');
      if (deviceToken) {
        const hash = sha256Base64Url(deviceToken);
        const [device] = await deps.db
          .select()
          .from(devices)
          .where(and(eq(devices.deviceTokenHash, hash), eq(devices.isActive, true)))
          .limit(1);

        if (!device) return { kind: 'anonymous' };

        let employeeId: string | null = null;
        const sessionToken = headers.get('x-employee-session');
        if (sessionToken) {
          const session = await verifyEmployeeSession(sessionToken, deps.sessionSecret);
          // Bind the session to THIS device — prevents cross-device session reuse
          if (session?.deviceId === device.id) {
            employeeId = session.employeeId;
          }
        }

        // Best-effort lastSeenAt update — fire-and-forget, never blocks the request
        deps.db
          .update(devices)
          .set({ lastSeenAt: new Date() })
          .where(eq(devices.id, device.id))
          .catch(() => undefined);

        return {
          kind: 'device',
          deviceId: device.id,
          businessId: device.businessId,
          employeeId,
        };
      }

      // --- Admin path: Authorization: Bearer <supabase-jwt> ---
      const authHeader = headers.get('authorization');
      const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (bearer) {
        const verified = await deps.verifySupabaseJwt(bearer);
        if (!verified) return { kind: 'anonymous' };

        const requestedBusinessId = headers.get('x-business-id');
        let businessId: string | null = null;
        if (requestedBusinessId) {
          businessId = await resolveAdminBusinessId(deps.db, verified.userId, requestedBusinessId);
        }

        return { kind: 'admin', userId: verified.userId, businessId };
      }

      return { kind: 'anonymous' };
    },
  };
}

// Validates that userId has membership in the organization that owns businessId.
// Returns businessId if valid, null otherwise.
async function resolveAdminBusinessId(
  db: Database,
  userId: string,
  businessId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .innerJoin(organizations, eq(businesses.organizationId, organizations.id))
    .innerJoin(memberships, eq(memberships.organizationId, organizations.id))
    .where(and(eq(businesses.id, businessId), eq(memberships.userId, userId)))
    .limit(1);

  return rows.length > 0 ? businessId : null;
}
