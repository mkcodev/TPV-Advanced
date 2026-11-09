import { describe, expect, it, vi } from 'vitest';
import {
  type FloorTableLike,
  TABLE_MIN_SIZE_CLASS,
  counterSummary,
  elapsedMinutes,
  markTableOccupied,
  saveAndSyncFloor,
  splitElapsed,
  tableVisualState,
} from './floor-state';

const free: FloorTableLike = {
  id: 't1',
  openOrderId: null,
  openedAt: null,
  billRequestedAt: null,
  totalCents: null,
  paidCents: null,
  pendingCents: null,
  employeeName: null,
};
const occupied: FloorTableLike = {
  ...free,
  id: 't2',
  openOrderId: 'o2',
  openedAt: '2026-11-09T20:00:00.000Z',
  totalCents: 1500,
  paidCents: 0,
  pendingCents: 1500,
  employeeName: 'Ana',
};

describe('tableVisualState', () => {
  it('sin comanda abierta → free', () => {
    expect(tableVisualState({ openOrderId: null, billRequestedAt: null })).toBe('free');
  });
  it('comanda abierta sin cuenta pedida → occupied', () => {
    expect(tableVisualState({ openOrderId: 'o1', billRequestedAt: null })).toBe('occupied');
  });
  it('comanda abierta con cuenta pedida → billing', () => {
    expect(tableVisualState({ openOrderId: 'o1', billRequestedAt: '2026-11-09T20:30:00Z' })).toBe(
      'billing',
    );
  });
  it('sin comanda pero con billRequestedAt suelto → free (manda la comanda)', () => {
    expect(tableVisualState({ openOrderId: null, billRequestedAt: '2026-11-09T20:30:00Z' })).toBe(
      'free',
    );
  });
});

describe('elapsedMinutes / splitElapsed', () => {
  const opened = '2026-11-09T20:00:00.000Z';
  const at = (min: number, sec = 0) => new Date(Date.parse(opened) + (min * 60 + sec) * 1000);

  it('minutos enteros hacia abajo', () => {
    expect(elapsedMinutes(opened, at(5, 59))).toBe(5);
  });
  it('acepta Date y número', () => {
    expect(elapsedMinutes(new Date(opened), at(90).getTime())).toBe(90);
  });
  it('reloj adelantado (apertura en el futuro) → 0, nunca negativo', () => {
    expect(elapsedMinutes(opened, at(-3))).toBe(0);
  });
  it('splitElapsed reparte horas y minutos', () => {
    expect(splitElapsed(5)).toEqual({ hours: 0, minutes: 5 });
    expect(splitElapsed(65)).toEqual({ hours: 1, minutes: 5 });
    expect(splitElapsed(120)).toEqual({ hours: 2, minutes: 0 });
  });
});

describe('counterSummary', () => {
  it('sin líneas → 0 artículos y 0 €', () => {
    expect(counterSummary([])).toEqual({ itemCount: 0, totalCents: 0 });
  });
  it('suma cantidades y total con IVA incluido', () => {
    const summary = counterSummary([
      { unitPriceCents: 250, taxRate: 10, quantity: 2 }, // 500
      { unitPriceCents: 300, taxRate: 21, quantity: 1 }, // 300
    ]);
    expect(summary).toEqual({ itemCount: 3, totalCents: 800 });
  });
  it('IVA mixto: el total es la suma de brutos (el precio ya lleva IVA)', () => {
    const { totalCents } = counterSummary([
      { unitPriceCents: 1100, taxRate: 10, quantity: 1 },
      { unitPriceCents: 1210, taxRate: 21, quantity: 1 },
    ]);
    expect(totalCents).toBe(2310);
  });
});

describe('markTableOccupied', () => {
  const now = new Date('2026-11-09T21:00:00.000Z');

  it('marca la mesa libre como ocupada con la hora de ahora', () => {
    const result = markTableOccupied([free, occupied], 't1', 'o-new', now);
    expect(result[0]).toMatchObject({
      id: 't1',
      openOrderId: 'o-new',
      openedAt: '2026-11-09T21:00:00.000Z',
      totalCents: null,
      employeeName: null,
    });
  });
  it('no muta la lista original ni el resto de mesas', () => {
    const list = [free, occupied];
    const result = markTableOccupied(list, 't1', 'o-new', now);
    expect(list[0]).toBe(free);
    expect(free.openOrderId).toBeNull();
    expect(result[1]).toBe(occupied);
    expect(result).not.toBe(list);
  });
  it('una mesa que ya tenía comanda no se toca', () => {
    const result = markTableOccupied([occupied], 't2', 'o-other', now);
    expect(result[0]).toBe(occupied);
  });
  it('mesa inexistente → lista igual', () => {
    expect(markTableOccupied([free], 'nope', 'o', now)).toEqual([free]);
  });
});

describe('saveAndSyncFloor', () => {
  function setup(
    save: () => Promise<unknown>,
    opts: { snapshot?: FloorTableLike[] } = { snapshot: [free] },
  ) {
    const snapshot = opts.snapshot;
    const setData = vi.fn();
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const notifyError = vi.fn();
    const optimistic = (cur: FloorTableLike[]) =>
      markTableOccupied(cur, 't1', 'o-new', new Date('2026-11-09T21:00:00.000Z'));
    return {
      setData,
      invalidate,
      notifyError,
      run: () => saveAndSyncFloor({ snapshot, optimistic, setData, save, invalidate, notifyError }),
    };
  }

  it('éxito: pinta ocupada, guarda, refresca y no avisa', async () => {
    const s = setup(() => Promise.resolve({ ok: true }));
    await expect(s.run()).resolves.toBe(true);
    expect(s.setData).toHaveBeenCalledTimes(1);
    expect(s.setData.mock.calls[0]?.[0][0].openOrderId).toBe('o-new');
    expect(s.invalidate).toHaveBeenCalledTimes(1);
    expect(s.notifyError).not.toHaveBeenCalled();
  });

  it('la mesa se pinta ocupada ANTES de que acabe el guardado', async () => {
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const s = setup(() => pending);
    const run = s.run();
    expect(s.setData).toHaveBeenCalledTimes(1); // optimista ya aplicado
    expect(s.invalidate).not.toHaveBeenCalled();
    release();
    await run;
    expect(s.invalidate).toHaveBeenCalledTimes(1);
  });

  it('fallo: restaura el estado anterior, avisa y refresca', async () => {
    const snapshot = [free];
    const s = setup(() => Promise.reject(new Error('boom')), { snapshot });
    await expect(s.run()).resolves.toBe(false);
    expect(s.setData).toHaveBeenCalledTimes(2);
    expect(s.setData.mock.calls[1]?.[0]).toBe(snapshot); // vuelve al estado real anterior
    expect(s.notifyError).toHaveBeenCalledTimes(1);
    expect(s.invalidate).toHaveBeenCalledTimes(1);
  });

  it('sin caché cargada: no pinta nada pero guarda y refresca', async () => {
    const s = setup(() => Promise.resolve(), {});
    await s.run();
    expect(s.setData).not.toHaveBeenCalled();
    expect(s.invalidate).toHaveBeenCalledTimes(1);
  });

  it('sin caché cargada y con fallo: avisa sin restaurar', async () => {
    const s = setup(() => Promise.reject(new Error('boom')), {});
    await s.run();
    expect(s.setData).not.toHaveBeenCalled();
    expect(s.notifyError).toHaveBeenCalledTimes(1);
  });
});

describe('TABLE_MIN_SIZE_CLASS', () => {
  it('es una sola constante con altura y anchura mínimas', () => {
    expect(TABLE_MIN_SIZE_CLASS).toBe('min-h-24 min-w-32');
  });
});
