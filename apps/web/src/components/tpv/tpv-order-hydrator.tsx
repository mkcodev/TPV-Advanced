'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { useEffect } from 'react';

// Mounts once in the TPV sidebar. Responsibilities:
//   1. Triggers manual rehydration of the order store from localStorage.
//   2. When the store is empty but has a saved orderId (clean client / new tab),
//      fetches the order from the server and restores it.
// Rule: NEVER overwrites local lines that exist — those are the source of truth.
export function TpvOrderHydrator() {
  useEffect(() => {
    useOrderStore.persist.rehydrate();
  }, []);

  const orderId = useOrderStore((s) => s.orderId);
  const shouldHydrate = useOrderStore((s) => s.shouldHydrateFromServer());
  const hydrateFromServer = useOrderStore((s) => s.hydrateFromServer);
  const clear = useOrderStore((s) => s.clear);

  // Query is disabled unless shouldHydrate — prevents fetching when local lines exist.
  const { data, isError } = trpc.orders.getById.useQuery(
    { orderId: orderId ?? '' },
    { enabled: shouldHydrate, retry: false },
  );

  useEffect(() => {
    if (!shouldHydrate) return;
    if (isError) {
      clear();
      return;
    }
    if (data) {
      if (data.status === 'open') {
        hydrateFromServer(data);
      } else {
        // Order was paid/cancelled from elsewhere — start fresh.
        clear();
      }
    }
  }, [data, isError, shouldHydrate, hydrateFromServer, clear]);

  return null;
}
