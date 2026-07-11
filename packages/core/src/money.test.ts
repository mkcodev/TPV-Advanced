import { describe, expect, it } from 'vitest';
import { eurosToCents, lineTotalCents, taxBreakdownFromGross } from './money';

describe('utilidades de dinero', () => {
  it('convierte euros a céntimos', () => {
    expect(eurosToCents(4.5)).toBe(450);
    expect(eurosToCents(0.1)).toBe(10);
    expect(eurosToCents(19.99)).toBe(1999);
  });

  it('calcula el total de una línea (con y sin modificadores)', () => {
    expect(lineTotalCents(150, 3)).toBe(450);
    expect(lineTotalCents(150, 2, 50)).toBe(400);
  });

  it('desglosa el IVA de un precio con IVA incluido', () => {
    expect(taxBreakdownFromGross(1100, 10)).toEqual({ baseCents: 1000, taxCents: 100 });
    expect(taxBreakdownFromGross(1210, 21)).toEqual({ baseCents: 1000, taxCents: 210 });
  });
});
