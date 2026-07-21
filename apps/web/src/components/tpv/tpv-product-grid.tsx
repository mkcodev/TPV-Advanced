'use client';

import { Skeleton } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { TpvProductCard } from './tpv-product-card';

interface Product {
  id: string;
  name: string;
  basePriceCents: number;
  taxRate: number;
  categoryId: string;
  categoryColor: string | null;
  imageUrl: string | null;
}

interface TpvProductGridProps {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  searchQuery: string;
  activeCategoryId: string | null;
}

export function TpvProductGrid({
  products,
  isLoading,
  isError,
  searchQuery,
  activeCategoryId,
}: TpvProductGridProps) {
  const t = useTranslations('tpv.content');

  const filtered = searchQuery.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : activeCategoryId
      ? products.filter((p) => p.categoryId === activeCategoryId)
      : products;

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-destructive">{t('errorLoading')}</p>
      </div>
    );
  }

  if (isLoading) {
    const skeletonKeys = [
      's1',
      's2',
      's3',
      's4',
      's5',
      's6',
      's7',
      's8',
      's9',
      's10',
      's11',
      's12',
      's13',
      's14',
      's15',
    ];
    return (
      <div className="grid grid-cols-3 gap-3 overflow-y-auto p-4 sm:grid-cols-4 lg:grid-cols-5">
        {skeletonKeys.map((k) => (
          <Skeleton key={k} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {searchQuery.trim() ? t('noResults', { query: searchQuery.trim() }) : t('noProducts')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 overflow-y-auto p-4 sm:grid-cols-4 lg:grid-cols-5">
      {filtered.map((product) => (
        <TpvProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
