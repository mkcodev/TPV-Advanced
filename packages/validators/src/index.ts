import { z } from 'zod';

// Convención: validar SIEMPRE los datos externos en los bordes (API, formularios).

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  pin: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos'),
  role: z.enum(['admin', 'manager', 'worker']).default('worker'),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// Auth schemas

export const createPairingCodeSchema = z.object({
  name: z.string().min(1, 'Device name is required'),
  type: z.enum(['pos_terminal', 'waiter_tablet', 'kds', 'printer']),
});
export type CreatePairingCodeInput = z.infer<typeof createPairingCodeSchema>;

export const pairDeviceSchema = z.object({
  code: z.string().regex(/^\d{6,8}$/, 'Pairing code must be 6–8 digits'),
});
export type PairDeviceInput = z.infer<typeof pairDeviceSchema>;

export const employeeLoginSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
});
export type EmployeeLoginInput = z.infer<typeof employeeLoginSchema>;

export const revokeDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
});
export type RevokeDeviceInput = z.infer<typeof revokeDeviceSchema>;
