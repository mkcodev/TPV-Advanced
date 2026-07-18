import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { orderTaxBreakdown } from './order-totals';

describe('orderTaxBreakdown — unit cases', () => {
  it('empty order returns all zeros and no buckets', () => {
    const result = orderTaxBreakdown([]);
    expect(result).toEqual({
      buckets: [],
      subtotalCents: 0,
      taxTotalCents: 0,
      totalCents: 0,
    });
  });

  it('single tax rate: two lines at 10%', () => {
    // 11,00 € + 22,00 € = 33,00 € brutos al 10% → base 30,00 €, cuota 3,00 €.
    const result = orderTaxBreakdown([
      { grossCents: 1100, taxRate: 10 },
      { grossCents: 2200, taxRate: 10 },
    ]);
    expect(result.buckets).toEqual([
      { taxRate: 10, baseCents: 3000, taxCents: 300, grossCents: 3300 },
    ]);
    expect(result.subtotalCents).toBe(3000);
    expect(result.taxTotalCents).toBe(300);
    expect(result.totalCents).toBe(3300);
  });

  it('mixed rates 10% + 21%: buckets sorted ascending, exact figures', () => {
    const result = orderTaxBreakdown([
      { grossCents: 1210, taxRate: 21 },
      { grossCents: 1100, taxRate: 10 },
      { grossCents: 2200, taxRate: 10 },
    ]);
    expect(result.buckets).toEqual([
      { taxRate: 10, baseCents: 3000, taxCents: 300, grossCents: 3300 },
      { taxRate: 21, baseCents: 1000, taxCents: 210, grossCents: 1210 },
    ]);
    expect(result.subtotalCents).toBe(4000);
    expect(result.taxTotalCents).toBe(510);
    // Total = suma de brutos de las líneas, nunca base+cuota recalculada.
    expect(result.totalCents).toBe(1210 + 1100 + 2200);
  });

  it('0% rate: tax is zero and base equals gross', () => {
    const result = orderTaxBreakdown([{ grossCents: 500, taxRate: 0 }]);
    expect(result.buckets).toEqual([{ taxRate: 0, baseCents: 500, taxCents: 0, grossCents: 500 }]);
    expect(result.taxTotalCents).toBe(0);
    expect(result.totalCents).toBe(500);
  });

  it('rounds once per bucket, not per line', () => {
    // 2 líneas de 9,99 € al 21%.
    // Por línea:  999/1.21 = 825,62 → base 826 cada una → base 1652, cuota 346.
    // Por bloque: 1998/1.21 = 1651,24 → base 1651, cuota 347.
    // La política del esquema es por bloque: minimiza el error acumulado.
    const result = orderTaxBreakdown([
      { grossCents: 999, taxRate: 21 },
      { grossCents: 999, taxRate: 21 },
    ]);
    expect(result.buckets).toEqual([
      { taxRate: 21, baseCents: 1651, taxCents: 347, grossCents: 1998 },
    ]);
    expect(result.subtotalCents + result.taxTotalCents).toBe(result.totalCents);
  });
});

describe('orderTaxBreakdown — properties', () => {
  const arbLines = fc.array(
    fc.record({
      grossCents: fc.integer({ min: 0, max: 10_000_000 }),
      taxRate: fc.constantFrom(0, 4, 10, 21),
    }),
  );

  it('invariant: subtotalCents + taxTotalCents === totalCents', () => {
    fc.assert(
      fc.property(arbLines, (lines) => {
        const r = orderTaxBreakdown(lines);
        expect(r.subtotalCents + r.taxTotalCents).toBe(r.totalCents);
      }),
    );
  });

  it('totalCents equals the sum of all line grossCents', () => {
    fc.assert(
      fc.property(arbLines, (lines) => {
        const r = orderTaxBreakdown(lines);
        const expected = lines.reduce((sum, l) => sum + l.grossCents, 0);
        expect(r.totalCents).toBe(expected);
      }),
    );
  });

  it('bucket count equals number of distinct tax rates, sorted ascending', () => {
    fc.assert(
      fc.property(arbLines, (lines) => {
        const r = orderTaxBreakdown(lines);
        const distinctRates = new Set(lines.map((l) => l.taxRate));
        expect(r.buckets.length).toBe(distinctRates.size);
        const rates = r.buckets.map((b) => b.taxRate);
        expect(rates).toEqual([...rates].sort((a, b) => a - b));
      }),
    );
  });

  it('every bucket has baseCents >= 0 and taxCents >= 0', () => {
    fc.assert(
      fc.property(arbLines, (lines) => {
        for (const b of orderTaxBreakdown(lines).buckets) {
          expect(b.baseCents).toBeGreaterThanOrEqual(0);
          expect(b.taxCents).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it('per bucket: baseCents + taxCents === grossCents', () => {
    fc.assert(
      fc.property(arbLines, (lines) => {
        for (const b of orderTaxBreakdown(lines).buckets) {
          expect(b.baseCents + b.taxCents).toBe(b.grossCents);
        }
      }),
    );
  });
});
