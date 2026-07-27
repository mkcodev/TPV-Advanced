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
