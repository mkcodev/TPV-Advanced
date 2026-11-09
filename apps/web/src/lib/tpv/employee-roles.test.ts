import { describe, expect, it } from 'vitest';
import { canAccessAdmin } from './employee-roles';

describe('canAccessAdmin', () => {
  it('muestra el enlace a manager y admin', () => {
    expect(canAccessAdmin('manager')).toBe(true);
    expect(canAccessAdmin('admin')).toBe(true);
  });

  it('lo oculta al empleado de sala', () => {
    expect(canAccessAdmin('worker')).toBe(false);
  });
});
