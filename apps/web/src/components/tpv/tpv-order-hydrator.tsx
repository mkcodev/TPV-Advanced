'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { trpc } from '@/lib/trpc/client';
import { useEffect } from 'react';

// Mounts once in the order screen. Responsibilities:
//   1. Triggers manual rehydration of the order store from localStorage.
//   2. If there is a saved orderId but no local lines → getById (device restart scenario).
//   3. If on a table session with no orderId and no lines → getByTable (fresh table entry).
// Rule: NEVER overwrites local lines that exist — those are the source of truth.
export function TpvOrderHydrator() {
  useEffect(() => {
    useOrderStore.persist.rehydrate();
  }, []);

  const orderId = useOrderStore((s) => s.orderId);
  const tableId = useOrderStore((s) => s.tableId);
  const shouldHydrate = useOrderStore((s) => s.shouldHydrateFromServer());
  const shouldFetchByTable = useOrderStore((s) => s.shouldFetchOpenByTable());
  const hydrateFromServer = useOrderStore((s) => s.hydrateFromServer);
  const clear = useOrderStore((s) => s.clear);

  // Path 1: orderId exists but no lines (e.g. page reload) → getById.
  const { data: byIdData, isError: byIdError } = trpc.orders.getById.useQuery(
    { orderId: orderId ?? '' },
    { enabled: shouldHydrate, retry: false },
  );

  // Path 2: fresh table session, no orderId, no lines → try getByTable.
  const { data: byTableData, isError: byTableError } = trpc.orders.getByTable.useQuery(
    { tableId: tableId ?? '' },
    { enabled: shouldFetchByTable, retry: false },
  );

  useEffect(() => {
    if (!shouldHydrate) return;
    if (byIdError) {
      clear();
      return;
    }
    if (byIdData) {
      if (byIdData.status === 'open') {
        hydrateFromServer(byIdData);
      } else {
        clear();
      }
    }
  }, [byIdData, byIdError, shouldHydrate, hydrateFromServer, clear]);

  useEffect(() => {
    if (!shouldFetchByTable) return;
    if (byTableError) return; // no open order — stay fresh
    if (byTableData) {
      hydrateFromServer(byTableData);
    }
  }, [byTableData, byTableError, shouldFetchByTable, hydrateFromServer]);

  return null;
}
