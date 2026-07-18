'use client';

import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CategoriesTable } from './categories-table';
import { CategoryFormDialog } from './category-form-dialog';

export function CategoriesPanel() {
  const t = useTranslations();
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading, isError } = trpc.catalog.categories.list.useQuery({
    includeInactive: true,
  });

  if (isError) {
    toast.error(t('common.error'));
  }

  const categories = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('admin.catalog.categories.title')}</h2>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus size={16} strokeWidth={1.5} />
          {t('admin.catalog.categories.new')}
        </Button>
      </div>

      {!isLoading && categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('admin.catalog.categories.empty')}</p>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setNewOpen(true)}>
            {t('admin.catalog.categories.emptyCta')}
          </Button>
        </div>
      ) : (
        <CategoriesTable categories={categories} isLoading={isLoading} />
      )}

      <CategoryFormDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSuccess={() => {
          setNewOpen(false);
          toast.success(t('admin.catalog.categories.toast.created'));
        }}
      />
    </div>
  );
}
