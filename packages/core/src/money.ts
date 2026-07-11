// Utilidades de dinero.
// REGLA DE ORO: el dinero SIEMPRE en céntimos (enteros). Nunca floats.
// 4,50 € => 450. Así se evitan los errores de redondeo típicos de los decimales.

/** Convierte euros (número) a céntimos enteros. 4.5 => 450 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/** Formatea céntimos como texto en euros. 450 => "4,50 €" */
export function formatCents(cents: number, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/**
 * Total de una línea de comanda, en céntimos.
 * (precio unitario + suma de modificadores) * cantidad.
 */
export function lineTotalCents(
  unitPriceCents: number,
  quantity: number,
  modifierDeltaCents = 0,
): number {
  return (unitPriceCents + modifierDeltaCents) * quantity;
}

/**
 * Desglosa el IVA de un precio que YA lo incluye (lo habitual en hostelería).
 * Devuelve base imponible y cuota, en céntimos.
 * Ej: 1100 céntimos con IVA 10% => { baseCents: 1000, taxCents: 100 }.
 */
export function taxBreakdownFromGross(
  grossCents: number,
  taxRatePercent: number,
): { baseCents: number; taxCents: number } {
  const baseCents = Math.round(grossCents / (1 + taxRatePercent / 100));
  const taxCents = grossCents - baseCents;
  return { baseCents, taxCents };
}
