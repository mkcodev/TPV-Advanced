import { type OrderTaxBreakdown, lineTotalCents, orderTaxBreakdown } from '@tpv/core';
import { create } from 'zustand';

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

interface OrderState {
  lines: OrderLine[];
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
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  lines: [],

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
      lines: state.lines.map((l) => (l.id === lineId ? { ...l, quantity: Math.max(1, qty) } : l)),
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

  clear: () => set({ lines: [] }),

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
}));
