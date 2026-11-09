// Cálculos puros del plano de sala. Sin IO: el servidor los usa para pintar cada mesa.

// Lo que queda por cobrar de una comanda abierta, en céntimos.
// total = orders.total_cents (ya recalculado en servidor con orderTaxBreakdown);
// paid = suma de pagos 'completed'. Acotado a [0, total]: un pago "de más" (p. ej. un total
// que bajó tras quitar líneas) nunca da pendiente negativo.
export function pendingCents(totalCents: number, paidCents: number): number {
  const total = Math.max(0, totalCents);
  return Math.min(total, Math.max(0, total - paidCents));
}
