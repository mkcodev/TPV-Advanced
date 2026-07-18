'use client';

import { trpc } from '@/lib/trpc/client';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tpv/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductFormDialog } from './product-form-dialog';
import { ProductsTable } from './products-table';

export function ProductsPanel() {
  const t = useTranslations();
  const [newOpen, setNewOpen] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');

  const { data: categories = [] } = trpc.catalog.categories.list.useQuery({
    includeInactive: false,
  });

  const {
    data: products = [],
    isLoading,
    isError,
  } = trpc.catalog.products.list.useQuery({
    categoryId: filterCategoryId === 'all' ? undefined : filterCategoryId,
    includeInactive: true,
  });

  if (isError) {
    toast.error(t('common.error'));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{t('admin.catalog.products.title')}</h2>
          <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.catalog.products.filterAll')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus size={16} strokeWidth={1.5} />
          {t('admin.catalog.products.new')}
        </Button>
      </div>

      {!isLoading && products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.catalog.products.empty')}</p>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setNewOpen(true)}>
            {t('admin.catalog.products.emptyCta')}
          </Button>
        </div>
      ) : (
        <ProductsTable products={products} categories={categories} isLoading={isLoading} />
      )}

      <ProductFormDialog
        open={newOpen}
        categories={categories}
        onClose={() => setNewOpen(false)}
        onSuccess={() => {
          setNewOpen(false);
          toast.success(t('admin.catalog.products.toast.created'));
        }}
      />
    </div>
  );
}
