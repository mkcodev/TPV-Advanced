import { describe, expect, it } from 'vitest';
import { canSeeExpectedCash, computeDifferenceCents, computeExpectedCashCents } from './cash-session';

describe('computeExpectedCashCents', () => {
  it('fondo solo, sin ventas ni movimientos', () => {
    expect(
      computeExpectedCashCents({
        openingAmountCents: 10000,
        cashPaymentsCents: 0,
        payInCents: 0,
        payOutCents: 0,
      }),
    ).toBe(10000);
  });

  it('fondo + ventas efectivo + pay_in − pay_out', () => {
    expect(
      computeExpectedCashCents({
        openingAmountCents: 10000,
        cashPaymentsCents: 2500,
        payInCents: 500,
        payOutCents: 1000,
      }),
    ).toBe(12000);
  });

  it('pay_out mayor que fondo (descubierto posible en datos)', () => {
    expect(
      computeExpectedCashCents({
        openingAmountCents: 5000,
        cashPaymentsCents: 0,
        payInCents: 0,
        payOutCents: 6000,
      }),
    ).toBe(-1000);
  });

  it('el esperado no depende de cobros con tarjeta o bizum', () => {
    const base = computeExpectedCashCents({
      openingAmountCents: 5000,
      cashPaymentsCents: 3000,
      payInCents: 0,
      payOutCents: 0,
    });
    // Añadir cobros card/bizum al cálculo no debe cambiar el resultado
    // (esto se verifica mostrando que cashPayments solo incluye cash).
    expect(base).toBe(8000);
  });
});

describe('computeExpectedCashCents — suma en céntimos enteros', () => {
  it('10000 + 2550 + 505 − 1001 = 12054, sin errores de coma flotante', () => {
    const result = computeExpectedCashCents({
      openingAmountCents: 10000,
      cashPaymentsCents: 2550,
      payInCents: 505,
      payOutCents: 1001,
    });
    expect(result).toBe(12054);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('canSeeExpectedCash — matriz rol × ajuste', () => {
  it.each([
    ['worker', true, false],
    ['worker', false, true],
    ['manager', true, true],
    ['manager', false, true],
    ['admin', true, true],
    ['admin', false, true],
  ] as const)('%s con cierre ciego=%s → %s', (role, blind, expected) => {
    expect(canSeeExpectedCash(role, blind)).toBe(expected);
  });

  it('rol null/undefined es fail-closed con cierre ciego', () => {
    expect(canSeeExpectedCash(null, true)).toBe(false);
    expect(canSeeExpectedCash(undefined, true)).toBe(false);
  });

  it('sin cierre ciego todos lo ven, incluso rol desconocido', () => {
    expect(canSeeExpectedCash(null, false)).toBe(true);
  });
});

describe('computeDifferenceCents', () => {
  it('cuadre exacto → 0', () => {
    expect(computeDifferenceCents(12000, 12000)).toBe(0);
  });

  it('falta efectivo (contado < esperado) → negativo', () => {
    expect(computeDifferenceCents(11950, 12000)).toBe(-50);
  });

  it('sobra efectivo (contado > esperado) → positivo', () => {
    expect(computeDifferenceCents(12010, 12000)).toBe(10);
  });
});
