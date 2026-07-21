'use client';

import { trpc } from '@/lib/trpc/client';
import { useState } from 'react';
import { TpvCategoryTabs } from './tpv-category-tabs';
import { TpvProductGrid } from './tpv-product-grid';
import { TpvSearchInput } from './tpv-search-input';

export function TpvShell() {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categories = [], isLoading: catsLoading } = trpc.catalog.categories.list.useQuery(
    { includeInactive: false },
    { staleTime: 60_000 },
  );

  const {
    data: products = [],
    isLoading: prodsLoading,
    isError,
  } = trpc.catalog.products.list.useQuery({}, { staleTime: 60_000 });

  // Merge categoryColor into products (categories already have it)
  const categoryColorMap = new Map(categories.map((c) => [c.id, c.color ?? null]));

  const enrichedProducts = products.map((p) => ({
    ...p,
    categoryColor: categoryColorMap.get(p.categoryId) ?? null,
  }));

  // Default to first category when loaded
  const resolvedCategoryId =
    activeCategoryId ?? (categories.length > 0 ? (categories[0]?.id ?? null) : null);

  const handleCategorySelect = (id: string) => {
    setActiveCategoryId(id);
    setSearchQuery('');
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barra de búsqueda */}
      <div className="shrink-0 border-b border-border px-4 py-2">
        <TpvSearchInput value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Tabs de categoría (se ocultan cuando hay búsqueda activa) */}
      {!searchQuery.trim() && (
        <TpvCategoryTabs
          categories={categories}
          isLoading={catsLoading}
          activeId={resolvedCategoryId}
          onSelect={handleCategorySelect}
        />
      )}

      {/* Rejilla de productos */}
      <TpvProductGrid
        products={enrichedProducts}
        isLoading={prodsLoading}
        isError={isError}
        searchQuery={searchQuery}
        activeCategoryId={resolvedCategoryId}
      />
    </div>
  );
}
