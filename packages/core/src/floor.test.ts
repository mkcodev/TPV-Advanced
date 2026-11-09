import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { pendingCents } from './floor';

describe('pendingCents — casos', () => {
  it('sin pagos: pendiente = total', () => {
    expect(pendingCents(1500, 0)).toBe(1500);
  });

  it('pago parcial: descuenta lo pagado', () => {
    expect(pendingCents(1500, 500)).toBe(1000);
  });

  it('pagado del todo: 0', () => {
    expect(pendingCents(1500, 1500)).toBe(0);
  });

  it('pagado de más (total bajó tras quitar líneas): nunca negativo', () => {
    expect(pendingCents(1000, 1500)).toBe(0);
  });

  it('comanda vacía: 0', () => {
    expect(pendingCents(0, 0)).toBe(0);
  });
});

describe('pendingCents — invariantes', () => {
  it('0 <= pendiente <= total y entero, para cualquier total y pagado', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (total, paid) => {
          const pending = pendingCents(total, paid);
          expect(pending).toBeGreaterThanOrEqual(0);
          expect(pending).toBeLessThanOrEqual(total);
          expect(Number.isInteger(pending)).toBe(true);
        },
      ),
    );
  });

  it('pendiente + pagado = total mientras no se pague de más', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.nat(100), (total, pct) => {
        const paid = Math.floor((total * pct) / 100);
        expect(pendingCents(total, paid) + paid).toBe(total);
      }),
    );
  });
});
