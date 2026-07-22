'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppRouter } from '@tpv/api';
import { TRPCClientError, httpBatchLink } from '@trpc/client';
import type { TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { useState } from 'react';
import { useDeviceStore } from '../stores/use-device-store';
import { useEmployeeStore } from '../stores/use-employee-store';
import { trpc } from './client';

// Intercepts auth errors so the gate can redirect without prop drilling.
// UNAUTHORIZED on device procedures (not "Invalid credentials" or "Employee login required") means the
// device token was revoked server-side — clear local state so TpvAuthGate shows the pairing screen.
const tpvErrorLink: TRPCLink<AppRouter> = () => (opts) => {
  return observable((observer) => {
    const sub = opts.next(opts.op).subscribe({
      next: observer.next.bind(observer),
      error: (err) => {
        if (err instanceof TRPCClientError) {
          const code = err.data?.code as string | undefined;
          const msg = err.message;
          if (
            code === 'UNAUTHORIZED' &&
            msg !== 'Invalid credentials' &&
            msg !== 'Employee login required'
          ) {
            // Device no longer recognised by the server.
            useDeviceStore.getState().clear();
            useEmployeeStore.getState().logout();
          } else if (code === 'UNAUTHORIZED' && msg === 'Employee login required') {
            // Valid device but the employee JWT expired mid-shift.
            useEmployeeStore.getState().logout();
          }
        }
        observer.error(err);
      },
      complete: observer.complete.bind(observer),
    });
    return () => sub.unsubscribe();
  });
};

export function TpvTRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Never retry on auth failures — they won't resolve on their own.
            retry: (failureCount, error) => {
              if (
                error instanceof TRPCClientError &&
                (error.data?.code === 'UNAUTHORIZED' || error.data?.code === 'FORBIDDEN')
              ) {
                return false;
              }
              return failureCount < 2;
            },
            staleTime: 30_000,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        tpvErrorLink,
        httpBatchLink({
          url: '/api/trpc',
          headers() {
            const { deviceToken } = useDeviceStore.getState();
            const { session } = useEmployeeStore.getState();
            return {
              ...(deviceToken ? { 'x-device-token': deviceToken } : {}),
              ...(session ? { 'x-employee-session': session } : {}),
            };
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
