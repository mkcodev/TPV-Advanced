'use client';

import { ProductThumbnail } from '@/components/catalog/product-thumbnail';
import { useOrderStore } from '@/lib/stores/use-order-store';
import { formatCents } from '@tpv/core';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useLongPress } from './use-long-press';

interface TpvProductCardProps {
  product: {
    id: string;
    name: string;
    basePriceCents: number;
    taxRate: number;
    categoryId: string;
    categoryColor: string | null;
    imageUrl: string | null;
    hasVariants?: boolean;
  };
}

export function TpvProductCard({ product }: TpvProductCardProps) {
  const t = useTranslations('tpv.content');
  const addProduct = useOrderStore((s) => s.addProduct);
  const incrementLine = useOrderStore((s) => s.incrementLine);
  // Selector primitivo (número): re-render solo cuando la cantidad de este producto cambia
  const count = useOrderStore((s) => s.countForProduct(product.id));
  const [pressed, setPressed] = useState(false);

  const handleAdd = useCallback(() => {
    // TODO: if product.hasVariants → open variant selector (tarea 1.4)
    const existingLine = useOrderStore.getState().lines.find((l) => l.productId === product.id);
    if (existingLine) {
      incrementLine(existingLine.id);
    } else {
      addProduct({
        id: product.id,
        name: product.name,
        basePriceCents: product.basePriceCents,
        taxRate: product.taxRate,
        categoryId: product.categoryId,
        categoryColor: product.categoryColor,
        imageUrl: product.imageUrl,
      });
    }
  }, [product, addProduct, incrementLine]);

  const longPressHandlers = useLongPress({
    onTap: handleAdd,
    onHoldTick: handleAdd,
  });

  return (
    <button
      type="button"
      aria-label={`${product.name} — ${formatCents(product.basePriceCents)}${product.hasVariants ? `. ${t('variantsTodo')}` : ''}`}
      className="relative flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-2 text-left transition-[border-color,box-shadow] duration-[var(--duration-base)] hover:border-border/60 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] active:transition-transform active:duration-[100ms]"
      data-pressed={pressed || undefined}
      onPointerDown={(e) => {
        setPressed(true);
        longPressHandlers.onPointerDown(e);
      }}
      onPointerMove={longPressHandlers.onPointerMove}
      onPointerUp={(e) => {
        setPressed(false);
        longPressHandlers.onPointerUp(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        longPressHandlers.onPointerLeave(e);
      }}
      onPointerCancel={(e) => {
        setPressed(false);
        longPressHandlers.onPointerCancel(e);
      }}
    >
      {/* Badge de cantidad */}
      {count > 0 && (
        <span
          className="tpv-badge absolute right-1.5 top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground"
          aria-hidden="true"
        >
          {count}
        </span>
      )}

      <ProductThumbnail src={product.imageUrl} name={product.name} size="lg" className="w-full" />

      <div className="w-full">
        <p className="line-clamp-2 text-center text-xs font-medium leading-tight text-foreground">
          {product.name}
        </p>
        <p className="mt-0.5 text-center text-xs tabular-nums text-muted-foreground">
          {formatCents(product.basePriceCents)}
        </p>
      </div>
    </button>
  );
}
