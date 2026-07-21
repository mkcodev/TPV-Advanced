'use client';

import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  onTap: () => void;
  onHoldTick: () => void;
  holdDelayMs?: number;
  tickIntervalMs?: number;
  moveTolerancePx?: number;
}

export interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

export function useLongPress({
  onTap,
  onHoldTick,
  holdDelayMs = 500,
  tickIntervalMs = 100,
  moveTolerancePx = 12,
}: UseLongPressOptions): UseLongPressHandlers {
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const didHold = useRef(false);

  const cancel = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (tickInterval.current) clearInterval(tickInterval.current);
    holdTimer.current = null;
    tickInterval.current = null;
    startPos.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      didHold.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };

      holdTimer.current = setTimeout(() => {
        didHold.current = true;
        onHoldTick();
        tickInterval.current = setInterval(onHoldTick, tickIntervalMs);
      }, holdDelayMs);
    },
    [onHoldTick, holdDelayMs, tickIntervalMs],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPos.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > moveTolerancePx) {
        cancel();
      }
    },
    [cancel, moveTolerancePx],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      const held = didHold.current;
      cancel();
      if (!held) onTap();
    },
    [onTap, cancel],
  );

  const onPointerLeave = useCallback((_e: React.PointerEvent) => cancel(), [cancel]);

  const onPointerCancel = useCallback((_e: React.PointerEvent) => cancel(), [cancel]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel };
}
