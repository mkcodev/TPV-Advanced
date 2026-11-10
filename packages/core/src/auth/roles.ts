// Reglas de rol de empleado (lógica pura, sin BD).
// Los valores coinciden con EMPLOYEE_ROLES de @tpv/db; core no depende de db,
// por eso el tipo se declara aquí.

export type EmployeeRoleName = 'admin' | 'manager' | 'worker';

// manager y admin pueden autorizar acciones sensibles (anular líneas enviadas, etc.).
export function isManagerOrAbove(role: EmployeeRoleName | null | undefined): boolean {
  return role === 'manager' || role === 'admin';
}

// ¿Queda alguien activo que pueda autorizar? Si no, el admin debe ver un aviso:
// sin encargado activo, nadie podría autorizar una anulación.
export function hasActiveApprover(
  employees: readonly { role: EmployeeRoleName; isActive: boolean }[],
): boolean {
  return employees.some((e) => e.isActive && isManagerOrAbove(e.role));
}
