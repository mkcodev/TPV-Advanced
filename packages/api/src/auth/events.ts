import { systemEvents } from '@tpv/db';
import type { Database } from '@tpv/db';

export type AuthEventType =
  | 'employee_login_succeeded'
  | 'employee_login_failed'
  | 'employee_locked_out'
  | 'device_paired'
  | 'device_revoked'
  | 'pairing_code_created';

interface LogAuthEventOpts {
  businessId: string;
  deviceId?: string;
  employeeId?: string;
  eventType: AuthEventType;
  payload?: Record<string, unknown>;
}

// system_events is append-only (legal record). This must never UPDATE/DELETE.
export async function logAuthEvent(db: Database, opts: LogAuthEventOpts): Promise<void> {
  await db.insert(systemEvents).values({
    businessId: opts.businessId,
    deviceId: opts.deviceId ?? null,
    employeeId: opts.employeeId ?? null,
    eventType: opts.eventType,
    payload: opts.payload ?? {},
  });
}
