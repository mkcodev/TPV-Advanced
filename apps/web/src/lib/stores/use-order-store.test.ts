import { lineTotalCents, orderTaxBreakdown } from '@tpv/core';
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { type ProductForAdd, useOrderStore } from './use-order-store';

const PRODUCT_A: ProductForAdd = {
  id: 'prod-a',
  name: 'Café con leche',
  basePriceCents: 150,
  taxRate: 10,
  categoryId: 'cat-1',
  categoryColor: '#4CAF50',
  imageUrl: null,
};

const PRODUCT_B: ProductForAdd = {
  id: 'prod-b',
  name: 'Cerveza',
  basePriceCents: 250,
  taxRate: 10,
  categoryId: 'cat-1',
  categoryColor: '#4CAF50',
  imageUrl: null,
};

const PRODUCT_C: ProductForAdd = {
  id: 'prod-c',
  name: 'Copa de vino',
  basePriceCents: 350,
  taxRate: 21,
  categoryId: 'cat-2',
  categoryColor: null,
  imageUrl: null,
};

function getLine(index: number) {
  const line = useOrderStore.getState().lines[index];
  if (!line) throw new Error(`No existe línea en índice ${index}`);
  return line;
}

beforeEach(() => {
  useOrderStore.getState().clear();
});

describe('addProduct', () => {
  it('crea línea con qty=1 en store vacío', () => {
    useOrderStore.getState().addProduct(PRODUCT_A);
    const lines = useOrderStore.getState().lines;
    expect(lines).toHaveLength(1);
    const line = getLine(0);
    expect(line.quantity).toBe(1);
    expect(line.name).toBe('Café con leche');
    expect(line.unitPriceCents).toBe(150);
    expect(line.taxRate).toBe(10);
    expect(line.productId).toBe('prod-a');
  });

  it('snapshot almacena categoryColor e imageUrl', () => {
    useOrderStore.getState().addProduct(PRODUCT_A);
    const line = getLine(0);
    expect(line.categoryColor).toBe('#4CAF50');
    expect(line.imageUrl).toBeNull();
  });

  it('incrementa qty si el mismo productId ya existe', () => {
    const { addProduct } = useOrderStore.getState();
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_A);
    const lines = useOrderStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(getLine(0).quantity).toBe(3);
  });

  it('crea línea separada para producto distinto', () => {
    const { addProduct } = useOrderStore.getState();
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_B);
    expect(useOrderStore.getState().lines).toHaveLength(2);
  });
});

describe('incrementLine / decrementLine', () => {
  it('incrementa en 1', () => {
    useOrderStore.getState().addProduct(PRODUCT_A);
    const id = getLine(0).id;
    useOrderStore.getState().incrementLine(id);
    expect(getLine(0).quantity).toBe(2);
  });

  it('decrementa hasta mínimo 1 (no elimina)', () => {
    useOrderStore.getState().addProduct(PRODUCT_A);
    const id = getLine(0).id;
    useOrderStore.getState().decrementLine(id);
    useOrderStore.getState().decrementLine(id);
    expect(getLine(0).quantity).toBe(1);
    expect(useOrderStore.getState().lines).toHaveLength(1);
  });
});

describe('setQuantity', () => {
  it('sobreescribe la cantidad', () => {
    useOrderStore.getState().addProduct(PRODUCT_A);
    const id = getLine(0).id;
    useOrderStore.getState().setQuantity(id, 7);
    expect(getLine(0).quantity).toBe(7);
  });

  it('clampea a mínimo 1', () => {
    useOrderStore.getState().addProduct(PRODUCT_A);
    const id = getLine(0).id;
    useOrderStore.getState().setQuantity(id, 0);
    expect(getLine(0).quantity).toBe(1);
  });
});

describe('removeLine', () => {
  it('borra la línea y devuelve la línea + índice', () => {
    const { addProduct, removeLine } = useOrderStore.getState();
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_B);
    const id = getLine(0).id;
    const result = removeLine(id);
    expect(result).not.toBeNull();
    expect(result?.line.productId).toBe('prod-a');
    expect(result?.index).toBe(0);
    expect(useOrderStore.getState().lines).toHaveLength(1);
  });

  it('devuelve null si la línea no existe', () => {
    const result = useOrderStore.getState().removeLine('does-not-exist');
    expect(result).toBeNull();
  });
});

describe('restoreLine', () => {
  it('reinserta en la posición original', () => {
    const { addProduct } = useOrderStore.getState();
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_B);
    const id0 = getLine(0).id;
    const result = useOrderStore.getState().removeLine(id0);
    expect(useOrderStore.getState().lines).toHaveLength(1);
    if (!result) throw new Error('removeLine devolvió null');
    useOrderStore.getState().restoreLine(result.line, result.index);
    const restored = useOrderStore.getState().lines;
    expect(restored).toHaveLength(2);
    expect(restored[0]?.productId).toBe('prod-a');
    expect(restored[1]?.productId).toBe('prod-b');
  });
});

describe('duplicateLine', () => {
  it('copia con nuevo id y qty=1 justo después', () => {
    const { addProduct } = useOrderStore.getState();
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_B);
    const idA = getLine(0).id;
    useOrderStore.getState().duplicateLine(idA);
    const lines = useOrderStore.getState().lines;
    expect(lines).toHaveLength(3);
    expect(lines[1]?.productId).toBe('prod-a');
    expect(lines[1]?.quantity).toBe(1);
    expect(lines[1]?.id).not.toBe(idA);
    expect(lines[2]?.productId).toBe('prod-b');
  });
});

describe('clear', () => {
  it('vacía todas las líneas', () => {
    const { addProduct, clear } = useOrderStore.getState();
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_B);
    clear();
    expect(useOrderStore.getState().lines).toHaveLength(0);
  });

  it('resetea orderId, savedOrderNumber, savedTotals y savedVersion a null', () => {
    useOrderStore.getState().ensureOrderId();
    useOrderStore.getState().clear();
    const s = useOrderStore.getState();
    expect(s.orderId).toBeNull();
    expect(s.savedOrderNumber).toBeNull();
    expect(s.savedTotals).toBeNull();
    expect(s.savedVersion).toBeNull();
  });
});

describe('countForProduct', () => {
  it('devuelve la cantidad total de un producto', () => {
    useOrderStore.getState().addProduct(PRODUCT_A);
    useOrderStore.getState().addProduct(PRODUCT_A);
    useOrderStore.getState().addProduct(PRODUCT_A);
    expect(useOrderStore.getState().countForProduct('prod-a')).toBe(3);
  });

  it('devuelve 0 si el producto no está en la comanda', () => {
    expect(useOrderStore.getState().countForProduct('prod-z')).toBe(0);
  });
});

describe('ensureOrderId', () => {
  it('genera un uuid la primera vez', () => {
    const id = useOrderStore.getState().ensureOrderId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(useOrderStore.getState().orderId).toBe(id);
  });

  it('devuelve el mismo id en llamadas sucesivas', () => {
    const first = useOrderStore.getState().ensureOrderId();
    const second = useOrderStore.getState().ensureOrderId();
    expect(first).toBe(second);
  });
});

const SERVER_ORDER = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  orderNumber: 7,
  status: 'open',
  subtotalCents: 1000,
  taxTotalCents: 100,
  totalCents: 1100,
  version: 2,
  lines: [
    {
      id: 'bbbbbbbb-0000-0000-0000-000000000001',
      productId: 'prod-a',
      nameSnapshot: 'Café con leche',
      unitPriceCents: 150,
      taxRate: 10,
      quantity: 2,
      lineTotalCents: 300,
      notes: null,
    },
  ],
};

describe('hydrateFromServer', () => {
  it('reemplaza el estado completo con los datos del servidor', () => {
    useOrderStore.getState().hydrateFromServer(SERVER_ORDER);
    const s = useOrderStore.getState();
    expect(s.orderId).toBe(SERVER_ORDER.id);
    expect(s.savedOrderNumber).toBe(7);
    expect(s.savedTotals).toEqual({ subtotalCents: 1000, taxTotalCents: 100, totalCents: 1100 });
    expect(s.savedVersion).toBe(2);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]?.name).toBe('Café con leche');
    expect(s.lines[0]?.quantity).toBe(2);
  });
});

describe('shouldHydrateFromServer', () => {
  it('devuelve false si no hay orderId', () => {
    expect(useOrderStore.getState().shouldHydrateFromServer()).toBe(false);
  });

  it('devuelve true si hay orderId y no hay líneas', () => {
    useOrderStore.setState({ orderId: 'aaaaaaaa-0000-0000-0000-000000000001', lines: [] });
    expect(useOrderStore.getState().shouldHydrateFromServer()).toBe(true);
  });

  it('devuelve false si hay orderId pero también hay líneas locales (local wins)', () => {
    useOrderStore.getState().addProduct(PRODUCT_A); // crea una línea
    useOrderStore.setState({ orderId: 'aaaaaaaa-0000-0000-0000-000000000001' });
    // Las líneas locales no guardadas son fuente de verdad — no se debe reemplazar.
    expect(useOrderStore.getState().shouldHydrateFromServer()).toBe(false);
  });
});

describe('multi-sesión: setActiveTable / setActiveCounter', () => {
  beforeEach(() => {
    // Full reset — also clears sessions Map and activeKey.
    useOrderStore.setState({
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
      sessions: {},
      activeKey: null,
    });
  });

  it('aísla líneas entre mesas distintas', () => {
    useOrderStore.getState().setActiveTable('T1', 'Z1');
    useOrderStore.getState().addProduct(PRODUCT_A);

    useOrderStore.getState().setActiveTable('T2', 'Z1');
    useOrderStore.getState().addProduct(PRODUCT_B);

    useOrderStore.getState().setActiveTable('T1', 'Z1');
    const lines = useOrderStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.productId).toBe('prod-a');
  });

  it('aísla líneas entre mesa y barra', () => {
    useOrderStore.getState().setActiveTable('T1', 'Z1');
    useOrderStore.getState().addProduct(PRODUCT_A);

    useOrderStore.getState().setActiveCounter();
    useOrderStore.getState().addProduct(PRODUCT_B);

    useOrderStore.getState().setActiveTable('T1', 'Z1');
    const lines = useOrderStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.productId).toBe('prod-a');
  });

  it('setActiveTable expone tableId y type dine_in', () => {
    useOrderStore.getState().setActiveTable('T3', 'Z2');
    const s = useOrderStore.getState();
    expect(s.tableId).toBe('T3');
    expect(s.zoneId).toBe('Z2');
    expect(s.type).toBe('dine_in');
    expect(s.activeKey).toBe('table:T3');
  });

  it('setActiveCounter expone tableId null y type counter', () => {
    useOrderStore.getState().setActiveCounter();
    const s = useOrderStore.getState();
    expect(s.tableId).toBeNull();
    expect(s.type).toBe('counter');
    expect(s.activeKey).toBe('counter');
  });

  it('shouldFetchOpenByTable es true solo en sesión de mesa vacía sin orderId', () => {
    useOrderStore.getState().setActiveTable('T1', 'Z1');
    // Sin líneas ni orderId → debería buscar en servidor.
    expect(useOrderStore.getState().shouldFetchOpenByTable()).toBe(true);
  });

  it('shouldFetchOpenByTable es false si hay líneas locales (local wins)', () => {
    useOrderStore.getState().setActiveTable('T1', 'Z1');
    useOrderStore.getState().addProduct(PRODUCT_A);
    expect(useOrderStore.getState().shouldFetchOpenByTable()).toBe(false);
  });

  it('shouldFetchOpenByTable es false en sesión de barra', () => {
    useOrderStore.getState().setActiveCounter();
    expect(useOrderStore.getState().shouldFetchOpenByTable()).toBe(false);
  });

  it('clear en sesión de mesa borra las líneas pero mantiene el contexto de mesa', () => {
    useOrderStore.getState().setActiveTable('T1', 'Z1');
    useOrderStore.getState().addProduct(PRODUCT_A);
    useOrderStore.getState().clear();
    const s = useOrderStore.getState();
    expect(s.lines).toHaveLength(0);
    expect(s.orderId).toBeNull();
    expect(s.tableId).toBe('T1');
    expect(s.activeKey).toBe('table:T1');
  });
});

describe('getBreakdown', () => {
  it('comanda vacía → totales cero', () => {
    const bd = useOrderStore.getState().getBreakdown();
    expect(bd.totalCents).toBe(0);
    expect(bd.subtotalCents).toBe(0);
    expect(bd.taxTotalCents).toBe(0);
    expect(bd.buckets).toHaveLength(0);
  });

  it('coincide con orderTaxBreakdown directo', () => {
    const { addProduct } = useOrderStore.getState();
    addProduct(PRODUCT_A);
    addProduct(PRODUCT_A); // qty=2, gross=300
    addProduct(PRODUCT_B); // qty=1, gross=250
    addProduct(PRODUCT_C); // qty=1, gross=350 al 21%

    const { lines } = useOrderStore.getState();
    const expected = orderTaxBreakdown(
      lines.map((l) => ({
        grossCents: lineTotalCents(l.unitPriceCents, l.quantity),
        taxRate: l.taxRate,
      })),
    );
    const actual = useOrderStore.getState().getBreakdown();
    expect(actual).toEqual(expected);
  });

  it('invariante subtotal + tax === total (property-based)', () => {
    const arbProducts = fc.array(
      fc.record({
        id: fc.constantFrom('prod-a', 'prod-b', 'prod-c'),
        name: fc.constant('Producto'),
        basePriceCents: fc.integer({ min: 1, max: 5000 }),
        taxRate: fc.constantFrom(0, 4, 10, 21),
        categoryId: fc.constant('cat-1'),
        categoryColor: fc.constant(null),
        imageUrl: fc.constant(null),
      }),
      { minLength: 1, maxLength: 10 },
    );

    fc.assert(
      fc.property(arbProducts, (products) => {
        useOrderStore.getState().clear();
        for (const p of products) {
          useOrderStore.getState().addProduct(p);
        }
        const bd = useOrderStore.getState().getBreakdown();
        expect(bd.subtotalCents + bd.taxTotalCents).toBe(bd.totalCents);
      }),
    );
  });
});
