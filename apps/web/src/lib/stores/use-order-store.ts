import { type OrderTaxBreakdown, lineTotalCents, orderTaxBreakdown } from '@tpv/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface OrderLine {
  id: string;
  productId: string;
  name: string;
  unitPriceCents: number;
  taxRate: number;
  categoryId: string;
  categoryColor: string | null;
  imageUrl: string | null;
  quantity: number;
  notes?: string;
}

export interface ProductForAdd {
  id: string;
  name: string;
  basePriceCents: number;
  taxRate: number;
  categoryId: string;
  categoryColor: string | null;
  imageUrl: string | null;
}

interface RemoveResult {
  line: OrderLine;
  index: number;
}

interface SavedTotals {
  subtotalCents: number;
  taxTotalCents: number;
  totalCents: number;
}

// Shape of a server order response (from orders.upsert or orders.getById).
export interface ServerOrder {
  id: string;
  orderNumber: number;
  status: string;
  subtotalCents: number;
  taxTotalCents: number;
  totalCents: number;
  version: number;
  lines: Array<{
    id: string;
    productId: string | null;
    nameSnapshot: string;
    unitPriceCents: number;
    taxRate: number;
    quantity: number;
    lineTotalCents: number;
    notes: string | null;
  }>;
}

interface OrderState {
  lines: OrderLine[];
  // Persistence fields — set after first successful save.
  orderId: string | null;
  savedOrderNumber: number | null;
  savedTotals: SavedTotals | null;
  savedVersion: number | null;

  addProduct: (p: ProductForAdd) => void;
  incrementLine: (lineId: string) => void;
  decrementLine: (lineId: string) => void;
  setQuantity: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => RemoveResult | null;
  restoreLine: (line: OrderLine, index: number) => void;
  duplicateLine: (lineId: string) => void;
  clear: () => void;
  countForProduct: (productId: string) => number;
  getBreakdown: () => OrderTaxBreakdown;
  // Persistence actions.
  ensureOrderId: () => string;
  hydrateFromServer: (order: ServerOrder) => void;
  shouldHydrateFromServer: () => boolean;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      lines: [],
      orderId: null,
      savedOrderNumber: null,
      savedTotals: null,
      savedVersion: null,

      addProduct: (p) =>
        set((state) => {
          const existing = state.lines.find((l) => l.productId === p.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l,
              ),
            };
          }
          const newLine: OrderLine = {
            id: crypto.randomUUID(),
            productId: p.id,
            name: p.name,
            unitPriceCents: p.basePriceCents,
            taxRate: p.taxRate,
            categoryId: p.categoryId,
            categoryColor: p.categoryColor,
            imageUrl: p.imageUrl,
            quantity: 1,
          };
          return { lines: [...state.lines, newLine] };
        }),

      incrementLine: (lineId) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.id === lineId ? { ...l, quantity: l.quantity + 1 } : l)),
        })),

      decrementLine: (lineId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === lineId ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l,
          ),
        })),

      setQuantity: (lineId, qty) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === lineId ? { ...l, quantity: Math.max(1, qty) } : l,
          ),
        })),

      removeLine: (lineId) => {
        const state = get();
        const index = state.lines.findIndex((l) => l.id === lineId);
        if (index === -1) return null;
        const line = state.lines[index];
        if (!line) return null;
        set({ lines: state.lines.filter((l) => l.id !== lineId) });
        return { line, index };
      },

      restoreLine: (line, index) =>
        set((state) => {
          const next = [...state.lines];
          next.splice(index, 0, line);
          return { lines: next };
        }),

      duplicateLine: (lineId) =>
        set((state) => {
          const idx = state.lines.findIndex((l) => l.id === lineId);
          if (idx === -1) return state;
          const source = state.lines[idx];
          if (!source) return state;
          const copy: OrderLine = { ...source, id: crypto.randomUUID(), quantity: 1 };
          const next = [...state.lines];
          next.splice(idx + 1, 0, copy);
          return { lines: next };
        }),

      clear: () =>
        set({
          lines: [],
          orderId: null,
          savedOrderNumber: null,
          savedTotals: null,
          savedVersion: null,
        }),

      countForProduct: (productId) =>
        get()
          .lines.filter((l) => l.productId === productId)
          .reduce((sum, l) => sum + l.quantity, 0),

      getBreakdown: () => {
        const { lines } = get();
        return orderTaxBreakdown(
          lines.map((l) => ({
            grossCents: lineTotalCents(l.unitPriceCents, l.quantity),
            taxRate: l.taxRate,
          })),
        );
      },

      ensureOrderId: () => {
        const { orderId } = get();
        if (orderId) return orderId;
        const newId = crypto.randomUUID();
        set({ orderId: newId });
        return newId;
      },

      hydrateFromServer: (order) =>
        set({
          orderId: order.id,
          savedOrderNumber: order.orderNumber,
          savedTotals: {
            subtotalCents: order.subtotalCents,
            taxTotalCents: order.taxTotalCents,
            totalCents: order.totalCents,
          },
          savedVersion: order.version,
          lines: order.lines.map((l) => ({
            id: l.id,
            productId: l.productId ?? '',
            name: l.nameSnapshot,
            unitPriceCents: l.unitPriceCents,
            taxRate: l.taxRate,
            quantity: l.quantity,
            notes: l.notes ?? undefined,
            // Category display fields not available from server order_items —
            // hydrated lines show without category color/image (acceptable for 1.6).
            categoryId: '',
            categoryColor: null,
            imageUrl: null,
          })),
        }),

      // True when the client has a saved orderId but no local lines:
      // the client can safely fetch and restore the order from the server.
      // If lines exist, they are the source of truth for this device.
      shouldHydrateFromServer: () => {
        const { orderId, lines } = get();
        return orderId !== null && lines.length === 0;
      },
    }),
    {
      name: 'tpv.orderStore.v1',
      storage: createJSONStorage(() => localStorage),
      // Prevent SSR hydration mismatch — call rehydrate() explicitly in client boot.
      skipHydration: true,
    },
  ),
);
