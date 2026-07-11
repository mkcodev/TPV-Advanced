import { z } from 'zod';

// Convención: validar SIEMPRE los datos externos en los bordes (API, formularios).
// Ejemplo: alta de un empleado del TPV.
export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  pin: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos'),
  role: z.enum(['admin', 'manager', 'worker']).default('worker'),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
