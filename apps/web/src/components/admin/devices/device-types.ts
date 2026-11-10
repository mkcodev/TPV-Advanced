// Forma de un terminal tal y como lo devuelve auth.listDevices (sin deviceTokenHash).
// Las fechas llegan como texto ISO porque tRPC no usa transformer.
export const DEVICE_TYPES = ['pos_terminal', 'waiter_tablet', 'kds', 'printer'] as const;
export type DeviceTypeName = (typeof DEVICE_TYPES)[number];

export type Device = {
  id: string;
  name: string;
  type: DeviceTypeName;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};
