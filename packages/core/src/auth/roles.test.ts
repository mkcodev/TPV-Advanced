import { describe, expect, it } from 'vitest';
import { hasActiveApprover, isManagerOrAbove } from './roles';

describe('isManagerOrAbove', () => {
  it('rejects worker, null and undefined', () => {
    expect(isManagerOrAbove('worker')).toBe(false);
    expect(isManagerOrAbove(null)).toBe(false);
    expect(isManagerOrAbove(undefined)).toBe(false);
  });

  it('accepts manager and admin', () => {
    expect(isManagerOrAbove('manager')).toBe(true);
    expect(isManagerOrAbove('admin')).toBe(true);
  });
});

describe('hasActiveApprover', () => {
  it('is false for an empty list', () => {
    expect(hasActiveApprover([])).toBe(false);
  });

  it('is false when there are only workers', () => {
    expect(
      hasActiveApprover([
        { role: 'worker', isActive: true },
        { role: 'worker', isActive: true },
      ]),
    ).toBe(false);
  });

  it('is false when the only manager is deactivated', () => {
    expect(
      hasActiveApprover([
        { role: 'worker', isActive: true },
        { role: 'manager', isActive: false },
      ]),
    ).toBe(false);
  });

  it('is true with an active manager or admin', () => {
    expect(hasActiveApprover([{ role: 'manager', isActive: true }])).toBe(true);
    expect(hasActiveApprover([{ role: 'admin', isActive: true }])).toBe(true);
  });
});
