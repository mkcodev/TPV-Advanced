'use client';

import { isLineLocked, useOrderStore } from '@/lib/stores/use-order-store';
import { formatCents, lineTotalCents } from '@tpv/core';
import { Button, cn } from '@tpv/ui';
import { Copy, Lock, Minus, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

interface TpvOrderLineProps {
  lineId: string;
  // Abre el diálogo de anulación (líneas guardadas: no se pueden quitar a pelo).
  onVoid: (lineId: string) => void;
}

export function TpvOrderLine({ lineId, onVoid }: TpvOrderLineProps) {
  const t = useTranslations('tpv.order');
  const line = useOrderStore((s) => s.lines.find((l) => l.id === lineId));
  const incrementLine = useOrderStore((s) => s.incrementLine);
  const decrementLine = useOrderStore((s) => s.decrementLine);
  const removeLine = useOrderStore((s) => s.removeLine);
  const restoreLine = useOrderStore((s) => s.restoreLine);
  const duplicateLine = useOrderStore((s) => s.duplicateLine);

  // Swipe state
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const isLocked = line !== undefined && isLineLocked(line);
  const swipeState = useRef<{
    startX: number;
    startY: number;
    axis: 'x' | 'y' | null;
    active: boolean;
  }>({ startX: 0, startY: 0, axis: null, active: false });

  const snapBack = useCallback(() => {
    setIsAnimating(true);
    setTranslateX(0);
    setTimeout(() => setIsAnimating(false), 250);
  }, []);

  const handleRemove = useCallback(() => {
    // Una línea guardada está fijada: en vez de borrarla se pide anularla (motivo + encargado).
    if (isLocked) {
      onVoid(lineId);
      return;
    }
    const result = removeLine(lineId);
    if (!result) return;
    const { line: removed, index } = result;
    toast(t('lineDeleted'), {
      duration: 5000,
      action: {
        label: t('undo'),
        onClick: () => restoreLine(removed, index),
      },
    });
  }, [lineId, isLocked, onVoid, removeLine, restoreLine, t]);

  const handleDuplicate = useCallback(() => {
    duplicateLine(lineId);
  }, [lineId, duplicateLine]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swipeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      active: true,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeState.current;
    if (!state.active) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (state.axis === null && dist > 8) {
      if (absDx > absDy * 1.2) {
        state.axis = 'x';
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (absDy > absDx * 1.2) {
        state.axis = 'y';
        state.active = false;
        return;
      }
    }

    if (state.axis === 'x') {
      e.preventDefault();
      setTranslateX(dx);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeState.current;
    if (!state.active || state.axis !== 'x') {
      swipeState.current = { startX: 0, startY: 0, axis: null, active: false };
      return;
    }

    const dx = e.clientX - state.startX;
    swipeState.current = { startX: 0, startY: 0, axis: null, active: false };

    if (dx < -80) {
      snapBack();
      handleRemove();
    } else if (dx > 80) {
      snapBack();
      handleDuplicate();
    } else {
      snapBack();
    }
  };

  const onPointerCancel = () => {
    swipeState.current = { startX: 0, startY: 0, axis: null, active: false };
    snapBack();
  };

  if (!line) return null;

  const lineTotal = lineTotalCents(line.unitPriceCents, line.quantity);
  // Fijada: solo "+" si sigue pendiente de enviar, y "−" solo hasta lo ya guardado.
  const canIncrease = line.status !== 'sent';
  const canDecrease = !isLocked || line.quantity > (line.savedQuantity ?? 1);
  const showLeft = translateX < -8;
  const showRight = translateX > 8;

  return (
    <div className="relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {/* Fondo anular (izquierda) */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end bg-destructive px-4 transition-opacity',
          showLeft ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      >
        <span className="text-xs font-medium text-destructive-foreground">{t('swipeLeft')}</span>
      </div>

      {/* Fondo duplicar (derecha) */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex items-center bg-primary px-4 transition-opacity',
          showRight ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      >
        <span className="text-xs font-medium text-primary-foreground">{t('swipeRight')}</span>
      </div>

      {/* Contenido de la línea */}
      <div
        className={cn(
          'relative border-l-4 bg-card px-3 py-2',
          isAnimating &&
            'transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)]',
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          borderLeftColor: line.categoryColor ?? 'var(--border)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="flex items-center gap-2">
          {/* Nombre */}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
              {isLocked && (
                <Lock
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{line.name}</span>
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatCents(line.unitPriceCents)} × {line.quantity}
            </p>
          </div>

          {/* Stepper */}
          <div className="flex shrink-0 items-center gap-1">
            {canDecrease ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={t('decreaseQty')}
                onClick={() => decrementLine(lineId)}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            ) : (
              <span className="h-7 w-7" aria-hidden="true" />
            )}
            <span className="w-5 text-center text-sm tabular-nums font-medium">
              {line.quantity}
            </span>
            {canIncrease ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={t('increaseQty')}
                onClick={() => incrementLine(lineId)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            ) : (
              <span className="h-7 w-7" aria-hidden="true" />
            )}
          </div>

          {/* Importe de la línea */}
          <span className="w-14 shrink-0 text-right text-sm tabular-nums font-medium text-foreground">
            {formatCents(lineTotal)}
          </span>

          {/* Acciones de escritorio */}
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              aria-label={t('duplicateItem')}
              onClick={handleDuplicate}
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </Button>
            {isLocked ? (
              <span className="h-7 w-7" aria-hidden="true" />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label={t('removeItem')}
                onClick={handleRemove}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>

        {/* Línea guardada: estado y "Anular" en su propia fila, para no ensanchar la comanda. */}
        {isLocked && (
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {line.status === 'sent' ? t('lineSent') : t('lineSaved')}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-3 text-xs text-destructive hover:text-destructive"
              onClick={handleRemove}
            >
              {t('voidLine')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
