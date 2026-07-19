'use client';

import { trpc } from '@/lib/trpc/client';
import { formatCents } from '@tpv/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tpv/ui';
import { ProductThumbnail } from '@/components/catalog/product-thumbnail';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductFormDialog } from './product-form-dialog';

type Category = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  basePriceCents: number;
  taxRate: number;
  allergens: string[];
  sku: string | null;
  imageUrl: string | null;
  isActive: boolean;
  displayOrder: number;
};

type Props = {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
};

export function ProductsTable({ products, categories, isLoading }: Props) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);

  const setActiveMutation = trpc.catalog.products.setActive.useMutation({
    onSuccess: async (_, vars) => {
      await utils.catalog.products.list.invalidate();
      toast.success(
        vars.isActive
          ? t('admin.catalog.products.toast.activated')
          : t('admin.catalog.products.toast.deactivated'),
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('admin.catalog.products.toast.error'));
    },
  });

  const reorderMutation = trpc.catalog.products.reorder.useMutation({
    onSuccess: async () => {
      await utils.catalog.products.list.invalidate();
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('admin.catalog.products.toast.error'));
    },
  });

  function handleToggleActive(product: Product, newValue: boolean) {
    if (!newValue) {
      setDeactivateTarget(product);
    } else {
      setActiveMutation.mutate({ id: product.id, isActive: true });
    }
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    setActiveMutation.mutate({ id: deactivateTarget.id, isActive: false });
    setDeactivateTarget(null);
  }

  function handleMove(index: number, direction: 'up' | 'down') {
    const sorted = [...products].sort((a, b) => a.displayOrder - b.displayOrder);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const current = sorted[index];
    const neighbor = sorted[swapIndex];
    if (!current || !neighbor) return;

    const newOrder = sorted.map((p, i) => {
      if (i === index) return { id: p.id, displayOrder: neighbor.displayOrder };
      if (i === swapIndex) return { id: p.id, displayOrder: current.displayOrder };
      return { id: p.id, displayOrder: p.displayOrder };
    });
    reorderMutation.mutate({ items: newOrder });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => `sk-${i}`).map((k) => (
          <Skeleton key={k} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const sorted = [...products].sort((a, b) => a.displayOrder - b.displayOrder);
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">{t('admin.catalog.products.columns.image')}</TableHead>
            <TableHead>{t('admin.catalog.products.columns.name')}</TableHead>
            <TableHead>{t('admin.catalog.products.columns.category')}</TableHead>
            <TableHead className="text-right">
              {t('admin.catalog.products.columns.price')}
            </TableHead>
            <TableHead className="w-20">{t('admin.catalog.products.columns.taxRate')}</TableHead>
            <TableHead className="w-20 text-center">
              {t('admin.catalog.products.columns.allergens')}
            </TableHead>
            <TableHead className="w-24 text-center">
              {t('admin.catalog.products.columns.order')}
            </TableHead>
            <TableHead className="w-20 text-center">
              {t('admin.catalog.products.columns.active')}
            </TableHead>
            <TableHead className="w-16">{t('admin.catalog.products.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((product, index) => (
            <TableRow key={product.id}>
              <TableCell>
                <ProductThumbnail src={product.imageUrl} name={product.name} size="sm" />
              </TableCell>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {categoryMap[product.categoryId] ?? '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCents(product.basePriceCents)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {product.taxRate}%
                </Badge>
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {product.allergens.length > 0 ? product.allergens.length : '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Subir"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className="h-7 w-7"
                  >
                    <ChevronUp size={14} strokeWidth={1.5} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Bajar"
                    disabled={index === sorted.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className="h-7 w-7"
                  >
                    <ChevronDown size={14} strokeWidth={1.5} />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={product.isActive}
                  onCheckedChange={(v) => handleToggleActive(product, v)}
                  aria-label={t('admin.catalog.products.columns.active')}
                />
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('common.edit')}
                  onClick={() => setEditTarget(product)}
                  className="h-8 w-8"
                >
                  <Pencil size={14} strokeWidth={1.5} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ProductFormDialog
        open={Boolean(editTarget)}
        product={editTarget ?? undefined}
        categories={categories}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setEditTarget(null);
          toast.success(t('admin.catalog.products.toast.updated'));
        }}
      />

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.catalog.products.deactivate.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.catalog.products.deactivate.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>
              {t('admin.catalog.products.deactivate.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
