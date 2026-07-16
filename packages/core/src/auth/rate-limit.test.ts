import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './constants';
import { evaluateRateLimit } from './rate-limit';

const NOW = new Date('2025-01-01T12:00:00Z');

describe('evaluateRateLimit', () => {
  it('allows the first request (null state)', () => {
    const result = evaluateRateLimit(null, NOW);
    expect(result.allowed).toBe(true);
    expect(result.next.count).toBe(1);
    expect(result.next.windowStart).toBe(NOW);
  });

  it(`allows requests up to the limit (${RATE_LIMIT_MAX})`, () => {
    const state = { windowStart: NOW, count: RATE_LIMIT_MAX - 1 };
    const result = evaluateRateLimit(state, NOW);
    expect(result.allowed).toBe(true);
  });

  it('denies when count reaches the limit', () => {
    const state = { windowStart: NOW, count: RATE_LIMIT_MAX };
    const result = evaluateRateLimit(state, NOW);
    expect(result.allowed).toBe(false);
  });

  it('resets the window after the interval expires', () => {
    const past = new Date(NOW.getTime() - RATE_LIMIT_WINDOW_MS);
    const state = { windowStart: past, count: RATE_LIMIT_MAX };
    const result = evaluateRateLimit(state, NOW);
    expect(result.allowed).toBe(true);
    expect(result.next.windowStart).toBe(NOW);
    expect(result.next.count).toBe(1);
  });
});
