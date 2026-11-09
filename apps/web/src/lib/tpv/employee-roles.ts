// Roles de empleado del TPV (mismo conjunto que employees.role en la BD).
export type EmployeeRole = 'admin' | 'manager' | 'worker';

// Solo decide si se MUESTRA el enlace al panel admin. La seguridad real no depende de esto:
// /admin exige sesión de Supabase y membresía, y un PIN de empleado no da ninguna de las dos.
export function canAccessAdmin(role: EmployeeRole): boolean {
  return role === 'manager' || role === 'admin';
}
