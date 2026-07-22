import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface EmployeeInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'admin' | 'manager' | 'worker';
}

interface SessionState {
  session: string | null;
  employee: EmployeeInfo | null;
  expiresAt: number | null;
  isLocked: boolean;
  login: (session: string, employee: EmployeeInfo, expiresAt: number) => void;
  lock: () => void;
  logout: () => void;
  touch: () => void;
}

export const useEmployeeStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      employee: null,
      expiresAt: null,
      isLocked: false,

      login: (session, employee, expiresAt) =>
        set({ session, employee, expiresAt, isLocked: false }),

      // Lock clears the session but keeps device identity.
      lock: () => set({ session: null, employee: null, expiresAt: null, isLocked: true }),

      // Full logout also resets the isLocked flag.
      logout: () => set({ session: null, employee: null, expiresAt: null, isLocked: false }),

      // touch is a no-op here — idle timeout is managed by IdleWatcher in memory.
      touch: () => undefined,
    }),
    {
      name: 'tpv.employeeSession.v1',
      storage: createJSONStorage(() => sessionStorage),
      // Prevent SSR hydration mismatch — call rehydrate() explicitly in client boot.
      skipHydration: true,
    },
  ),
);
