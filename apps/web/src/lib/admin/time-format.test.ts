import { describe, expect, it } from 'vitest';
import { formatCountdown, relativeTime } from './time-format';

describe('formatCountdown', () => {
  it('formats mm:ss', () => {
    expect(formatCountdown(15 * 60 * 1000)).toBe('15:00');
    expect(formatCountdown(65_000)).toBe('01:05');
  });

  it('rounds partial seconds up so it never shows 00:00 while time remains', () => {
    expect(formatCountdown(500)).toBe('00:01');
  });

  it('never goes negative', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5000)).toBe('00:00');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('is "now" under a minute, also for future clock skew', () => {
    expect(relativeTime(ago(10_000), now)).toEqual({ unit: 'now' });
    expect(relativeTime(ago(-5_000), now)).toEqual({ unit: 'now' });
  });

  it('picks minutes, hours and days', () => {
    expect(relativeTime(ago(5 * 60_000), now)).toEqual({ unit: 'minutes', value: 5 });
    expect(relativeTime(ago(3 * 3_600_000), now)).toEqual({ unit: 'hours', value: 3 });
    expect(relativeTime(ago(2 * 86_400_000), now)).toEqual({ unit: 'days', value: 2 });
  });
});
