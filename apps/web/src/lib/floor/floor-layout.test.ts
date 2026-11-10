import { describe, expect, it } from 'vitest';
import { TABLE_MIN_SIZE_CLASS } from '../tpv/floor-state';
import {
  FLOOR_GRID_PX,
  type FloorTableRect,
  TABLE_MIN_HEIGHT_PX,
  TABLE_MIN_WIDTH_PX,
  layoutFloor,
  nextFreePosition,
  sanitizeTableRect,
} from './floor-layout';

function rect(
  id: string,
  posX: number,
  posY: number,
  width: number,
  height: number,
  shape: 'square' | 'round' = 'square',
): FloorTableRect {
  return { id, posX, posY, width, height, shape };
}

function box(layout: ReturnType<typeof layoutFloor>, id: string) {
  const found = layout.boxes.find((b) => b.id === id);
  if (found === undefined) throw new Error(`box ${id} not found`);
  return found;
}

describe('layoutFloor', () => {
  it('reduce el plano a la mitad cuando el contenedor es la mitad', () => {
    const layout = layoutFloor([rect('A', 0, 0, 1000, 1000), rect('B', 1000, 0, 1000, 1000)], {
      width: 1000,
      height: 500,
    });
    expect(layout.mode).toBe('positioned');
    expect(layout.scale).toBe(0.5);
    expect(box(layout, 'A')).toEqual({ id: 'A', x: 0, y: 0, width: 500, height: 500 });
    expect(box(layout, 'B')).toEqual({ id: 'B', x: 500, y: 0, width: 500, height: 500 });
  });

  it('manda el eje más limitante y centra en el otro', () => {
    const layout = layoutFloor([rect('A', 0, 0, 200, 200), rect('B', 200, 0, 200, 200)], {
      width: 1000,
      height: 200,
    });
    expect(layout.scale).toBe(1);
    expect(box(layout, 'A').x).toBe(300);
    expect(box(layout, 'B').x).toBe(500);
  });

  it('limita la ampliación a MAX_FLOOR_SCALE y centra', () => {
    const layout = layoutFloor([rect('A', 0, 0, 80, 80)], { width: 1200, height: 600 });
    expect(layout.scale).toBe(2);
    expect(box(layout, 'A')).toEqual({ id: 'A', x: 520, y: 220, width: 160, height: 160 });
  });

  it('descarta el vacío inicial: el plano empieza en la mesa más a la izquierda/arriba', () => {
    const layout = layoutFloor([rect('A', 400, 300, 100, 100), rect('B', 600, 300, 100, 100)], {
      width: 600,
      height: 200,
    });
    expect(box(layout, 'A').x).toBe(0);
    expect(box(layout, 'B').x).toBe(400);
    expect(box(layout, 'A').y).toBe(0);
  });

  it('mantiene las proporciones del admin', () => {
    const layout = layoutFloor([rect('A', 0, 0, 400, 400), rect('B', 1600, 0, 400, 400)], {
      width: 1000,
      height: 1000,
    });
    expect(box(layout, 'B').x - box(layout, 'A').x).toBe(1600 * layout.scale);
  });

  it('sube una mesa pequeña al mínimo táctil sin mover su centro', () => {
    const layout = layoutFloor(
      [rect('A', 0, 0, 40, 40), rect('B', 200, 0, 40, 40), rect('C', 400, 0, 40, 40)],
      { width: 880, height: 400 },
    );
    const b = box(layout, 'B');
    expect(b.width).toBe(TABLE_MIN_WIDTH_PX);
    expect(b.height).toBe(TABLE_MIN_HEIGHT_PX);
    expect(b.x + b.width / 2).toBe(440);
    expect(b.y + b.height / 2).toBe(200);
  });

  it('una mesa redonda pequeña es un círculo del lado mínimo ancho', () => {
    const layout = layoutFloor(
      [rect('A', 0, 0, 40, 40), rect('B', 200, 0, 40, 40, 'round'), rect('C', 400, 0, 40, 40)],
      { width: 880, height: 400 },
    );
    const b = box(layout, 'B');
    expect(b.width).toBe(TABLE_MIN_WIDTH_PX);
    expect(b.height).toBe(TABLE_MIN_WIDTH_PX);
  });

  it('encaja dentro del contenedor una mesa agrandada en el borde', () => {
    const layout = layoutFloor([rect('A', 0, 0, 40, 40), rect('B', 400, 0, 40, 40)], {
      width: 880,
      height: 400,
    });
    expect(box(layout, 'A').x).toBe(0);
    expect(box(layout, 'B').x).toBe(880 - TABLE_MIN_WIDTH_PX);
  });

  it('nunca da posiciones negativas aunque el contenedor sea menor que el mínimo', () => {
    const layout = layoutFloor([rect('A', 0, 0, 80, 80)], { width: 100, height: 50 });
    expect(box(layout, 'A').x).toBe(0);
    expect(box(layout, 'A').y).toBe(0);
  });

  it('dos mesas en la misma posición → fallback a lista', () => {
    const layout = layoutFloor([rect('A', 20, 20, 80, 80), rect('B', 20, 20, 80, 80)], {
      width: 1000,
      height: 600,
    });
    expect(layout.mode).toBe('fallback');
    expect(layout.boxes).toEqual([]);
  });

  it('sanea posiciones negativas, NaN y tamaños 0', () => {
    const clean = sanitizeTableRect(rect('A', -5, Number.NaN, 0, Number.NaN));
    expect(clean.posX).toBe(0);
    expect(clean.posY).toBe(0);
    expect(clean.width).toBe(40);
    expect(clean.height).toBe(40);
  });

  it('cuenta los solapes provocados por el mínimo táctil', () => {
    const layout = layoutFloor([rect('A', 0, 0, 40, 40), rect('B', 60, 0, 40, 40)], {
      width: 200,
      height: 100,
    });
    expect(layout.overlapCount).toBeGreaterThanOrEqual(1);
  });

  it('ordena las cajas por (posY, posX)', () => {
    const layout = layoutFloor(
      [rect('B', 100, 50, 80, 80), rect('A', 100, 0, 80, 80), rect('C', 0, 50, 80, 80)],
      { width: 1200, height: 800 },
    );
    expect(layout.boxes.map((b) => b.id)).toEqual(['A', 'C', 'B']);
  });

  it('lista vacía o contenedor 0×0 → sin cajas y sin NaN', () => {
    expect(layoutFloor([], { width: 800, height: 600 }).boxes).toEqual([]);
    const zero = layoutFloor([rect('A', 0, 0, 80, 80)], { width: 0, height: 0 });
    expect(zero.boxes).toEqual([]);
    expect(Number.isNaN(zero.scale)).toBe(false);
  });

  it('las constantes en px coinciden con TABLE_MIN_SIZE_CLASS', () => {
    // Tailwind: 1 unidad = 4 px (min-w-32 = 128 px, min-h-24 = 96 px).
    const h = /min-h-(\d+)/.exec(TABLE_MIN_SIZE_CLASS)?.[1];
    const w = /min-w-(\d+)/.exec(TABLE_MIN_SIZE_CLASS)?.[1];
    expect(Number(h) * 4).toBe(TABLE_MIN_HEIGHT_PX);
    expect(Number(w) * 4).toBe(TABLE_MIN_WIDTH_PX);
  });
});

describe('nextFreePosition', () => {
  const size = { width: 80, height: 80 };

  it('zona vacía → (20, 20)', () => {
    expect(nextFreePosition([], size, 800)).toEqual({ posX: 20, posY: 20 });
  });

  it('con una mesa existente no solapa su huella táctil', () => {
    expect(nextFreePosition([rect('A', 20, 20, 80, 80)], size, 800)).toEqual({
      posX: 160,
      posY: 20,
    });
  });

  it('respeta la rejilla aunque las mesas existentes estén fuera de ella', () => {
    const pos = nextFreePosition([rect('A', 25, 33, 70, 70)], size, 800);
    expect(pos.posX % FLOOR_GRID_PX).toBe(0);
    expect(pos.posY % FLOOR_GRID_PX).toBe(0);
  });

  it('fila llena → salta a la siguiente fila y vuelve a x = 20', () => {
    expect(nextFreePosition([rect('A', 20, 20, 80, 80)], size, 200)).toEqual({
      posX: 20,
      posY: 130,
    });
  });

  it('tres altas seguidas no se solapan y el plano queda posicionado', () => {
    const tables: FloorTableRect[] = [];
    for (const id of ['A', 'B', 'C']) {
      const { posX, posY } = nextFreePosition(tables, size, 800);
      tables.push(rect(id, posX, posY, size.width, size.height));
    }
    const layout = layoutFloor(tables, { width: 1200, height: 600 });
    expect(layout.mode).toBe('positioned');
    expect(layout.overlapCount).toBe(0);
  });
});
