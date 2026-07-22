import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DeviceInfo {
  id: string;
  name: string;
  type: string;
}

interface DeviceState {
  deviceToken: string | null;
  device: DeviceInfo | null;
  setPaired: (token: string, device: DeviceInfo) => void;
  clear: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      deviceToken: null,
      device: null,
      setPaired: (token, device) => set({ deviceToken: token, device }),
      clear: () => set({ deviceToken: null, device: null }),
    }),
    {
      name: 'tpv.deviceToken.v1',
      storage: createJSONStorage(() => localStorage),
      // Prevent SSR hydration mismatch — call rehydrate() explicitly in client boot.
      skipHydration: true,
    },
  ),
);
