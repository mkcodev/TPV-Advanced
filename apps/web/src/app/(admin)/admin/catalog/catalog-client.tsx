'use client';

import { CategoriesPanel } from '@/components/admin/catalog/categories-panel';
import { ProductsPanel } from '@/components/admin/catalog/products-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tpv/ui';
import { useTranslations } from 'next-intl';

export function CatalogClient() {
  const t = useTranslations('admin.catalog.tabs');

  return (
    <Tabs defaultValue="categories">
      <TabsList className="mb-6">
        <TabsTrigger value="categories">{t('categories')}</TabsTrigger>
        <TabsTrigger value="products">{t('products')}</TabsTrigger>
      </TabsList>
      <TabsContent value="categories">
        <CategoriesPanel />
      </TabsContent>
      <TabsContent value="products">
        <ProductsPanel />
      </TabsContent>
    </Tabs>
  );
}
