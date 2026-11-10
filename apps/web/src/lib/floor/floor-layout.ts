// Lógica pura del plano de sala por posición (sin React, fácil de testear).
// Mismo modelo que el editor del admin (floor-canvas.tsx): píxeles lógicos, origen arriba-izquierda,
// rejilla de FLOOR_GRID_PX. El TPV escala ese plano para que quepa entero sin scroll.

export const FLOOR_GRID_PX = 10;
// Tope de ampliación: con 1–2 mesas no queremos una mesa gigante.
export const MAX_FLOOR_SCALE = 2;
// Suelo táctil en px. Debe coincidir con TABLE_MIN_SIZE_CLASS ('min-h-24 min-w-32') de
// lib/tpv/floor-state.ts: 32 * 4 = 128 px de ancho, 24 * 4 = 96 px de alto (≥ 44 px).
export const TABLE_MIN_WIDTH_PX = 128;
export const TABLE_MIN_HEIGHT_PX = 96;
// Mismo mínimo que el validador Zod de mesas (width/height ≥ 40).
const MIN_TABLE_DIMENSION_PX = 40;
// Posición de la primera mesa nueva en el admin.
const FIRST_SLOT_PX = 20;

export interface FloorTableRect {
  id: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: 'square' | 'round';
}

export interface FloorBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorLayout {
  // 'fallback' = mesas apiladas (nunca colocadas): la vista usa la lista de siempre.
  mode: 'positioned' | 'fallback';
  scale: number;
  boxes: FloorBox[];
  overlapCount: number;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

// Datos sucios (NaN, negativos, tamaño 0) se llevan a valores válidos en vez de romper el plano.
export function sanitizeTableRect(t: FloorTableRect): FloorTableRect {
  return {
    ...t,
    posX: Math.max(0, finiteOr(t.posX, 0)),
    posY: Math.max(0, finiteOr(t.posY, 0)),
    width: Math.max(MIN_TABLE_DIMENSION_PX, finiteOr(t.width, MIN_TABLE_DIMENSION_PX)),
    height: Math.max(MIN_TABLE_DIMENSION_PX, finiteOr(t.height, MIN_TABLE_DIMENSION_PX)),
  };
}

// false si dos o más mesas comparten exactamente la misma posición (nunca se colocaron).
export function hasUsableLayout(tables: readonly FloorTableRect[]): boolean {
  const seen = new Set<string>();
  for (const raw of tables) {
    const t = sanitizeTableRect(raw);
    const key = `${t.posX},${t.posY}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function boxesOverlap(a: FloorBox, b: FloorBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function layoutFloor(
  tables: readonly FloorTableRect[],
  container: { width: number; height: number },
): FloorLayout {
  if (!hasUsableLayout(tables)) {
    return { mode: 'fallback', scale: 1, boxes: [], overlapCount: 0 };
  }
  if (tables.length === 0 || !(container.width > 0) || !(container.height > 0)) {
    return { mode: 'positioned', scale: 1, boxes: [], overlapCount: 0 };
  }

  // Orden estable (arriba→abajo, izquierda→derecha): la de abajo/derecha queda encima al solapar.
  const rects = tables
    .map(sanitizeTableRect)
    .sort((a, b) => a.posY - b.posY || a.posX - b.posX || a.id.localeCompare(b.id));

  const minX = Math.min(...rects.map((r) => r.posX));
  const minY = Math.min(...rects.map((r) => r.posY));
  const bboxW = Math.max(...rects.map((r) => r.posX + r.width)) - minX;
  const bboxH = Math.max(...rects.map((r) => r.posY + r.height)) - minY;

  const scale = Math.min(container.width / bboxW, container.height / bboxH, MAX_FLOOR_SCALE);
  const offsetX = (container.width - bboxW * scale) / 2;
  const offsetY = (container.height - bboxH * scale) / 2;

  const boxes: FloorBox[] = rects.map((r) => {
    let width = Math.max(r.width * scale, TABLE_MIN_WIDTH_PX);
    let height = Math.max(r.height * scale, TABLE_MIN_HEIGHT_PX);
    if (r.shape === 'round') {
      // Las redondas son círculos: lado común, nunca por debajo del mínimo ancho.
      width = Math.max(width, height);
      height = width;
    }
    // Crece alrededor de su centro para no desplazar la disposición del admin.
    const centerX = offsetX + (r.posX - minX + r.width / 2) * scale;
    const centerY = offsetY + (r.posY - minY + r.height / 2) * scale;
    const x = Math.min(Math.max(0, centerX - width / 2), Math.max(0, container.width - width));
    const y = Math.min(Math.max(0, centerY - height / 2), Math.max(0, container.height - height));
    return {
      id: r.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  });

  let overlapCount = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a !== undefined && b !== undefined && boxesOverlap(a, b)) overlapCount++;
    }
  }

  return { mode: 'positioned', scale, boxes, overlapCount };
}

// Primer hueco de la rejilla, de izquierda a derecha y fila a fila, que no solape ninguna mesa.
// Usa la "huella TPV" (tamaño mínimo táctil + margen) para que las altas seguidas no se
// solapen tampoco cuando el TPV las agranda.
export function nextFreePosition(
  tables: readonly FloorTableRect[],
  size: { width: number; height: number },
  rowWidth: number,
): { posX: number; posY: number } {
  const footprint = (w: number, h: number) => ({
    w: Math.max(w, TABLE_MIN_WIDTH_PX),
    h: Math.max(h, TABLE_MIN_HEIGHT_PX),
  });
  const mine = footprint(size.width, size.height);
  const existing = tables.map((raw) => {
    const t = sanitizeTableRect(raw);
    const f = footprint(t.width, t.height);
    return { x: t.posX, y: t.posY, w: f.w, h: f.h };
  });
  const maxBottom = existing.reduce((m, e) => Math.max(m, e.y + e.h), FIRST_SLOT_PX);
  const margin = FLOOR_GRID_PX;
  // Primera fila de la rejilla por debajo de todas las mesas: ahí siempre hay hueco.
  const lastY = Math.ceil((maxBottom + margin) / FLOOR_GRID_PX) * FLOOR_GRID_PX;

  for (let y = FIRST_SLOT_PX; y <= lastY; y += FLOOR_GRID_PX) {
    for (let x = FIRST_SLOT_PX; ; x += FLOOR_GRID_PX) {
      // Fila llena: pasa a la siguiente (en x = 20 siempre se acepta aunque la mesa sea ancha).
      if (x > FIRST_SLOT_PX && x + mine.w > rowWidth) break;
      const collides = existing.some(
        (e) =>
          x < e.x + e.w + margin &&
          x + mine.w + margin > e.x &&
          y < e.y + e.h + margin &&
          y + mine.h + margin > e.y,
      );
      if (!collides) return { posX: x, posY: y };
    }
  }
  // Inalcanzable en la práctica (en lastY siempre hay hueco); red de seguridad, alineada a la rejilla.
  return { posX: FIRST_SLOT_PX, posY: lastY };
}
