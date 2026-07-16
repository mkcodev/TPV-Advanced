import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './constants';

export interface RateLimitState {
  windowStart: Date;
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  next: RateLimitState;
}

// Evaluates whether a request is within the rate limit.
// state = current window row from DB (null if first ever request).
// Returns {allowed, next} where next is the new state to persist.
export function evaluateRateLimit(state: RateLimitState | null, now: Date): RateLimitResult {
  if (state === null || now.getTime() - state.windowStart.getTime() >= RATE_LIMIT_WINDOW_MS) {
    return { allowed: true, next: { windowStart: now, count: 1 } };
  }
  const next: RateLimitState = { windowStart: state.windowStart, count: state.count + 1 };
  return { allowed: state.count < RATE_LIMIT_MAX, next };
}
