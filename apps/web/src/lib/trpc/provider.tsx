'use client';

import { getActiveBusinessClient } from '@/lib/business/active';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from './client';

export function AdminTRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          async headers() {
            const supabase = getSupabaseBrowser();
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const businessId = getActiveBusinessClient();
            return {
              ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
              ...(businessId ? { 'x-business-id': businessId } : {}),
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
