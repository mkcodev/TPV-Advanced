// Lógica pura del plano de sala del TPV (sin React, fácil de testear).
// Los TOTALES de las mesas nunca se calculan aquí: salen del servidor (regla 8).
// Lo único calculado en cliente es feedback: tiempo abierta, resumen de la barra y la mesa
// "ocupada" optimista mientras se guarda.

import { lineTotalCents, orderTaxBreakdown } from '@tpv/core';

// Tamaño mínimo táctil de una mesa (≥44 px) en UN solo sitio. En PR-D3 (plano por posición)
// el contenedor posicionado manda sobre el tamaño dibujado en el admin, y esta constante
// sigue siendo el suelo: ninguna mesa baja de aquí aunque se dibuje pequeña.
export const TABLE_MIN_SIZE_CLASS = 'min-h-24 min-w-32';

export type TableVisualState = 'free' | 'occupied' | 'billing';

// libre = sin comanda abierta; por cobrar = comanda abierta con la cuenta pedida;
// ocupada = comanda abierta sin pedir cuenta. Se deriva de la comanda, no de tables.status.
export function tableVisualState(table: {
  openOrderId: string | null;
  billRequestedAt: string | Date | null;
}): TableVisualState {
  if (table.openOrderId === null) return 'free';
  return table.billRequestedAt !== null ? 'billing' : 'occupied';
}

// Minutos enteros desde la apertura (nunca negativo: tolera relojes algo desfasados).
export function elapsedMinutes(openedAt: string | Date, now: number | Date): number {
  const opened = new Date(openedAt).getTime();
  const current = typeof now === 'number' ? now : now.getTime();
  return Math.max(0, Math.floor((current - opened) / 60_000));
}

// Reparte los minutos en horas + minutos para el texto ("1 h 05 min").
export function splitElapsed(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

// Resumen de la venta rápida de barra: artículos y total. La barra vive solo en el store
// hasta que se guarda/cobra, así que es feedback; el servidor recalcula al cobrar.
export function counterSummary(
  lines: ReadonlyArray<{ unitPriceCents: number; taxRate: number; quantity: number }>,
): { itemCount: number; totalCents: number } {
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const totalCents = orderTaxBreakdown(
    lines.map((l) => ({
      grossCents: lineTotalCents(l.unitPriceCents, l.quantity),
      taxRate: l.taxRate,
    })),
  ).totalCents;
  return { itemCount, totalCents };
}

// Campos de comanda que trae cada mesa de floor.tables.listWithOpenOrders.
// Las fechas llegan como texto ISO (tRPC sin transformer).
export interface FloorTableLike {
  id: string;
  openOrderId: string | null;
  openedAt: string | null;
  billRequestedAt: string | null;
  totalCents: number | null;
  paidCents: number | null;
  pendingCents: number | null;
  employeeName: string | null;
}

// Copia con la mesa pintada como ocupada al instante (actualización optimista, #21).
// Solo marca mesas libres: si ya tenía comanda no se toca. Los importes y el empleado quedan
// a null hasta que llegue el dato real del servidor.
export function markTableOccupied<T extends FloorTableLike>(
  list: readonly T[],
  tableId: string,
  orderId: string,
  now: Date,
): T[] {
  return list.map((table) =>
    table.id === tableId && table.openOrderId === null
      ? { ...table, openOrderId: orderId, openedAt: now.toISOString() }
      : table,
  );
}

export interface SaveAndSyncDeps<T> {
  // Estado actual de la caché del plano; undefined si aún no estaba cargada.
  snapshot: T | undefined;
  // Cómo pintar la mesa ocupada a partir del estado actual.
  optimistic: (current: T) => T;
  setData: (data: T) => void;
  // El guardado real (debe lanzar si falla: nada de fire-and-forget).
  save: () => Promise<unknown>;
  // Refresca la consulta del plano con los datos reales del servidor.
  invalidate: () => Promise<unknown> | undefined;
  // Aviso visible al usuario cuando el guardado falla.
  notifyError: () => void;
}

// Pinta optimista → guarda → refresca. Si el guardado falla: restaura el estado anterior,
// avisa y refresca igualmente (la mesa vuelve a su estado real). Devuelve si se guardó.
export async function saveAndSyncFloor<T>(deps: SaveAndSyncDeps<T>): Promise<boolean> {
  const { snapshot, optimistic, setData, save, invalidate, notifyError } = deps;
  if (snapshot !== undefined) setData(optimistic(snapshot));
  try {
    await save();
    await invalidate();
    return true;
  } catch {
    if (snapshot !== undefined) setData(snapshot);
    notifyError();
    await invalidate();
    return false;
  }
}
