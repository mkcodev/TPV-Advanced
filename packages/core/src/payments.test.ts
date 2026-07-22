import { describe, expect, it } from 'vitest';
import { calculateChangeCents, summarizePayments } from './payments';

describe('calculateChangeCents', () => {
  it('devuelve el cambio correcto', () => {
    expect(calculateChangeCents(1000, 2000)).toBe(1000);
  });

  it('devuelve 0 cuando se paga el importe exacto', () => {
    expect(calculateChangeCents(1250, 1250)).toBe(0);
  });

  it('lanza cuando cashReceivedCents < amountCents', () => {
    expect(() => calculateChangeCents(1000, 500)).toThrow();
  });
});

describe('summarizePayments', () => {
  it('suma un único pago en efectivo correctamente', () => {
    const summary = summarizePayments([
      { method: 'cash', amountCents: 1250, cashReceivedCents: 2000 },
    ]);
    expect(summary.totalPaidCents).toBe(1250);
    expect(summary.totalTipCents).toBe(0);
    expect(summary.totalChangeCents).toBe(750);
  });

  it('suma un pago mixto (tarjeta + efectivo)', () => {
    const summary = summarizePayments([
      { method: 'card', amountCents: 500 },
      { method: 'cash', amountCents: 750, cashReceivedCents: 1000 },
    ]);
    expect(summary.totalPaidCents).toBe(1250);
    expect(summary.totalChangeCents).toBe(250);
  });

  it('la propina se acumula pero no cuenta en totalPaidCents', () => {
    const summary = summarizePayments([{ method: 'card', amountCents: 1000, tipCents: 100 }]);
    expect(summary.totalPaidCents).toBe(1000);
    expect(summary.totalTipCents).toBe(100);
  });

  it('suma propinas de múltiples pagos', () => {
    const summary = summarizePayments([
      { method: 'card', amountCents: 500, tipCents: 50 },
      { method: 'bizum', amountCents: 500, tipCents: 25 },
    ]);
    expect(summary.totalTipCents).toBe(75);
  });

  it('lista vacía devuelve ceros', () => {
    const summary = summarizePayments([]);
    expect(summary.totalPaidCents).toBe(0);
    expect(summary.totalTipCents).toBe(0);
    expect(summary.totalChangeCents).toBe(0);
  });
});
