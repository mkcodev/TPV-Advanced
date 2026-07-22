// Lógica pura de pagos.
// REGLA DE ORO: el dinero SIEMPRE en céntimos. Nunca floats.
// El servidor es autoritativo — estas funciones solo hacen aritmética.

export interface PaymentInput {
  readonly method: 'cash' | 'card' | 'bizum' | 'other';
  readonly amountCents: number;
  readonly tipCents?: number;
  readonly cashReceivedCents?: number;
}

export interface PaymentsSummary {
  readonly totalPaidCents: number;
  readonly totalTipCents: number;
  readonly totalChangeCents: number;
}

/**
 * Devuelve el cambio para una línea de pago en efectivo.
 * Lanza si cashReceivedCents < amountCents (no se puede dar más cambio del que se recibe).
 */
export function calculateChangeCents(amountCents: number, cashReceivedCents: number): number {
  if (cashReceivedCents < amountCents) {
    throw new Error(
      `cashReceivedCents (${cashReceivedCents}) must be >= amountCents (${amountCents})`,
    );
  }
  return cashReceivedCents - amountCents;
}

/**
 * Suma todos los pagos de una operación (posiblemente mixta).
 * tipCents no cuenta para cubrir el total de la comanda.
 */
export function summarizePayments(payments: readonly PaymentInput[]): PaymentsSummary {
  let totalPaidCents = 0;
  let totalTipCents = 0;
  let totalChangeCents = 0;

  for (const p of payments) {
    totalPaidCents += p.amountCents;
    totalTipCents += p.tipCents ?? 0;
    if (p.method === 'cash' && p.cashReceivedCents !== undefined) {
      totalChangeCents += calculateChangeCents(p.amountCents, p.cashReceivedCents);
    }
  }

  return { totalPaidCents, totalTipCents, totalChangeCents };
}
