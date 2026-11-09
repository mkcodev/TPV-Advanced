// Pure functions for cash session expected/difference calculation.
// Inputs come from server-side aggregates — client never sends expectedAmountCents.

export interface CashSessionExpectedInput {
  openingAmountCents: number;
  cashPaymentsCents: number; // SUM(payments.amountCents) where method='cash', status='completed'
  payInCents: number; // SUM(cash_movements.amountCents) where type='pay_in'
  payOutCents: number; // SUM(cash_movements.amountCents) where type='pay_out'
}

export function computeExpectedCashCents(input: CashSessionExpectedInput): number {
  return input.openingAmountCents + input.cashPaymentsCents + input.payInCents - input.payOutCents;
}

export function computeDifferenceCents(countedCents: number, expectedCents: number): number {
  return countedCents - expectedCents;
}

// Rol del empleado en el TPV (mismo conjunto que employees.role en la BD).
export type CashViewerRole = 'admin' | 'manager' | 'worker';

// Decide si quien pregunta puede ver el efectivo esperado de la caja.
// Solo un worker con cierre ciego activo NO puede. Fail-closed: rol desconocido (null)
// cuenta como worker, y el servidor pasa blindCashClose=true si no encuentra el negocio.
export function canSeeExpectedCash(
  role: CashViewerRole | null | undefined,
  blindCashClose: boolean,
): boolean {
  if (!blindCashClose) return true;
  return role === 'manager' || role === 'admin';
}
