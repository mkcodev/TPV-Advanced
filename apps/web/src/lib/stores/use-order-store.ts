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

// Shape of a server order response (from orders.upsert, orders.getById, orders.getByTable).
export interface ServerOrder {
  id: string;
  orderNumber: number;
  status: string;
  tableId?: string | null;
  zoneId?: string | null;
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

// ── Multi-session types ───────────────────────────────────────────────────────

type OrderType = 'counter' | 'dine_in';
export type SessionKeyString = 'counter' | `table:${string}`;

interface OrderSession {
  lines: OrderLine[];
  orderId: string | null;
  savedOrderNumber: number | null;
  savedTotals: SavedTotals | null;
  savedVersion: number | null;
  tableId: string | null;
  tableName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  type: OrderType;
}

const EMPTY_SESSION: OrderSession = {
  lines: [],
  orderId: null,
  savedOrderNumber: null,
  savedTotals: null,
  savedVersion: null,
  tableId: null,
  tableName: null,
  zoneId: null,
  zoneName: null,
  type: 'counter',
};

// ── Store interface ───────────────────────────────────────────────────────────

interface OrderState extends OrderSession {
  // Parked sessions (not the active one — active session lives in the flat props above).
  sessions: Partial<Record<SessionKeyString, OrderSession>>;
  activeKey: SessionKeyString | null;

  addProduct: (p: ProductForAdd) => void;
  incrementLine: (lineId: string) => void;
  decrementLine: (lineId: string) => void;
  setQuantity: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => RemoveResult | null;
  restoreLine: (line: OrderLine, index: number) => void;
  duplicateLine: (lineId: string) => void;
  // Clears active session (lines + ids) AND removes it from sessions Map.
  clear: () => void;
  countForProduct: (productId: string) => number;
  getBreakdown: () => OrderTaxBreakdown;
  ensureOrderId: () => string;
  hydrateFromServer: (order: ServerOrder) => void;
  shouldHydrateFromServer: () => boolean;
  // True when on a table with no local orderId/lines — should try getByTable.
  shouldFetchOpenByTable: () => boolean;

  // Session navigation — save current flat state to Map, restore target.
  setActiveCounter: () => void;
  setActiveTable: (tableId: string, zoneId: string, tableName?: string, zoneName?: string) => void;
  clearActive: () => void; // alias for clear()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function snapshotFlat(state: OrderState): OrderSession {
  return {
    lines: state.lines,
    orderId: state.orderId,
    savedOrderNumber: state.savedOrderNumber,
    savedTotals: state.savedTotals,
    savedVersion: state.savedVersion,
    tableId: state.tableId,
    tableName: state.tableName,
    zoneId: state.zoneId,
    zoneName: state.zoneName,
    type: state.type,
  };
}

function switchToSession(
  state: OrderState,
  newKey: SessionKeyString,
  freshSession: OrderSession,
): Partial<OrderState> {
  // Park current session.
  const updatedSessions: Partial<Record<SessionKeyString, OrderSession>> = {
    ...state.sessions,
    ...(state.activeKey !== null ? { [state.activeKey]: snapshotFlat(state) } : {}),
  };
  // Restore from parked sessions or start fresh.
  const target = updatedSessions[newKey] ?? freshSession;
  // Remove the target from parked Map (it's now the active session in flat props).
  const { [newKey]: _, ...remainingSessions } = updatedSessions;
  return {
    ...target,
    sessions: remainingSessions,
    activeKey: newKey,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      ...EMPTY_SESSION,
      sessions: {},
      activeKey: null,

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
        set((state) => {
          const { [state.activeKey as SessionKeyString]: _, ...remainingSessions } =
            state.sessions as Record<SessionKeyString, OrderSession>;
          return {
            lines: [],
            orderId: null,
            savedOrderNumber: null,
            savedTotals: null,
            savedVersion: null,
            sessions: state.activeKey !== null ? remainingSessions : state.sessions,
          };
        }),

      clearActive: () => get().clear(),

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
            // Category display fields not available from server — hydrated lines show without them.
            categoryId: '',
            categoryColor: null,
            imageUrl: null,
          })),
        }),

      // True when the client has a saved orderId but no local lines — safe to fetch from server.
      shouldHydrateFromServer: () => {
        const { orderId, lines } = get();
        return orderId !== null && lines.length === 0;
      },

      // True when on a fresh table session with no local data — try getByTable.
      shouldFetchOpenByTable: () => {
        const { orderId, lines, tableId } = get();
        return orderId === null && lines.length === 0 && tableId !== null;
      },

      setActiveCounter: () =>
        set((state) => switchToSession(state, 'counter', { ...EMPTY_SESSION, type: 'counter' })),

      setActiveTable: (tableId, zoneId, tableName, zoneName) =>
        set((state) =>
          switchToSession(state, `table:${tableId}`, {
            ...EMPTY_SESSION,
            tableId,
            tableName: tableName ?? null,
            zoneId,
            zoneName: zoneName ?? null,
            type: 'dine_in',
          }),
        ),
    }),
    {
      name: 'tpv.orderStore.v2',
      storage: createJSONStorage(() => localStorage),
      // Prevent SSR hydration mismatch — call rehydrate() explicitly in client boot.
      skipHydration: true,
    },
  ),
);
