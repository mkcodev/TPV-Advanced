import { describe, expect, it } from 'vitest';
import { canSeeItem } from './roles';

describe('canSeeItem', () => {
  it('staff ve ítems de staff', () => expect(canSeeItem('staff', 'staff')).toBe(true));
  it('staff no ve ítems de admin', () => expect(canSeeItem('staff', 'admin')).toBe(false));
  it('staff no ve ítems de owner', () => expect(canSeeItem('staff', 'owner')).toBe(false));
  it('admin ve ítems de staff', () => expect(canSeeItem('admin', 'staff')).toBe(true));
  it('admin ve ítems de admin', () => expect(canSeeItem('admin', 'admin')).toBe(true));
  it('admin no ve ítems de owner', () => expect(canSeeItem('admin', 'owner')).toBe(false));
  it('owner ve todo', () => {
    expect(canSeeItem('owner', 'staff')).toBe(true);
    expect(canSeeItem('owner', 'admin')).toBe(true);
    expect(canSeeItem('owner', 'owner')).toBe(true);
  });
});
