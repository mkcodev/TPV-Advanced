import { RATE_LIMIT_MAX } from '@tpv/core';
import type { Database } from '@tpv/db';
import { sql } from 'drizzle-orm';

// Upserts the rate limit counter atomically in a single SQL statement.
// Using INSERT ... ON CONFLICT avoids the SELECT+UPDATE race condition.
// Returns true if the request is allowed (count after this call <= RATE_LIMIT_MAX).
export async function consumeRateLimit(db: Database, key: string, now: Date): Promise<boolean> {
  const nowIso = now.toISOString();
  const rows = (await db.execute(sql`
    INSERT INTO auth_rate_limits (key, window_start, count)
    VALUES (${key}, ${nowIso}::timestamptz, 1)
    ON CONFLICT (key) DO UPDATE
      SET
        window_start = CASE
          WHEN now() - auth_rate_limits.window_start >= interval '60 seconds'
            THEN ${nowIso}::timestamptz
          ELSE auth_rate_limits.window_start
        END,
        count = CASE
          WHEN now() - auth_rate_limits.window_start >= interval '60 seconds'
            THEN 1
          ELSE auth_rate_limits.count + 1
        END
    RETURNING count
  `)) as { count: number }[];

  const count = rows[0]?.count ?? 1;
  return count <= RATE_LIMIT_MAX;
}
