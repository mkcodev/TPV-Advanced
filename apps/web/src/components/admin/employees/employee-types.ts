// Forma de un empleado tal y como la devuelve employees.list (sin pinHash).
// lockedUntil llega como texto ISO porque tRPC no usa transformer.
export type Employee = {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'worker';
  isActive: boolean;
  lockedUntil: string | null;
};

export const EMPLOYEE_ROLES = ['worker', 'manager', 'admin'] as const;
