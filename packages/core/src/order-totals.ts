// Desglose de IVA de una comanda completa, por bloques de tipo de IVA.
// Es la primitiva AUTORITATIVA de totales: el servidor recalcula con ella
// antes de persistir, cobrar o facturar (ver docs/DATABASE-SCHEMA.md,
// "Política de redondeo de IVA").

import { taxBreakdownFromGross } from './money';

/**
 * Línea ya calculada de una comanda.
 * grossCents = line_total_cents del esquema: total FINAL con IVA incluido,
 * con cantidad, modificadores y descuento de línea ya aplicados.
 */
export interface OrderLine {
  grossCents: number;
  /** Tipo de IVA en porcentaje. Ej: 0, 4, 10, 21. */
  taxRate: number;
}

/** Un bloque de IVA del desglose. Mapea 1:1 a invoice_tax_lines. */
export interface TaxBucket {
  taxRate: number;
  baseCents: number;
  taxCents: number;
  grossCents: number;
}

export interface OrderTaxBreakdown {
  /** Bloques ordenados por taxRate ascendente. */
  buckets: TaxBucket[];
  /** Suma de las bases imponibles de todos los bloques. */
  subtotalCents: number;
  /** Suma de las cuotas de IVA de todos los bloques. */
  taxTotalCents: number;
  /** Total de la comanda = suma de los brutos de TODAS las líneas. */
  totalCents: number;
}

// TODO: descuento a nivel de comanda (orders.discount_total_cents) repartido
// entre bloques — requiere prorrateo proporcional + regla de redondeo del
// resto. Se abordará cuando se construya la función de descuentos.

/**
 * Desglosa el IVA de una comanda por bloques de tipo de IVA.
 *
 * Política (docs/DATABASE-SCHEMA.md):
 * 1. Agrupar las líneas por taxRate.
 * 2. Sumar el bruto de cada bloque.
 * 3. Redondear UNA sola vez por bloque (taxBreakdownFromGross), nunca por línea.
 * 4. El total = suma de brutos de las líneas, nunca recalculado de base+cuota.
 *
 * Invariante garantizado: subtotalCents + taxTotalCents === totalCents.
 */
export function orderTaxBreakdown(lines: readonly OrderLine[]): OrderTaxBreakdown {
  // Acumular el bruto por tipo de IVA.
  const grossByRate = new Map<number, number>();
  for (const line of lines) {
    grossByRate.set(line.taxRate, (grossByRate.get(line.taxRate) ?? 0) + line.grossCents);
  }

  const buckets: TaxBucket[] = [...grossByRate.entries()]
    .sort(([rateA], [rateB]) => rateA - rateB)
    .map(([taxRate, grossCents]) => {
      const { baseCents, taxCents } = taxBreakdownFromGross(grossCents, taxRate);
      return { taxRate, baseCents, taxCents, grossCents };
    });

  return {
    buckets,
    subtotalCents: buckets.reduce((sum, b) => sum + b.baseCents, 0),
    taxTotalCents: buckets.reduce((sum, b) => sum + b.taxCents, 0),
    totalCents: lines.reduce((sum, line) => sum + line.grossCents, 0),
  };
}
