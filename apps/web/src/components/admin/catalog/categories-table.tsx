'use client';

import { trpc } from '@/lib/trpc/client';
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
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CategoryFormDialog } from './category-form-dialog';

type Category = {
  id: string;
  name: string;
  printDestination: 'kitchen' | 'bar' | 'none';
  displayOrder: number;
  isActive: boolean;
};

type Props = {
  categories: Category[];
  isLoading: boolean;
};

export function CategoriesTable({ categories, isLoading }: Props) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Category | null>(null);

  const setActiveMutation = trpc.catalog.categories.setActive.useMutation({
    onSuccess: async (_, vars) => {
      await utils.catalog.categories.list.invalidate();
      toast.success(
        vars.isActive
          ? t('admin.catalog.categories.toast.activated')
          : t('admin.catalog.categories.toast.deactivated'),
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('admin.catalog.categories.toast.error'));
    },
  });

  const reorderMutation = trpc.catalog.categories.reorder.useMutation({
    onSuccess: async () => {
      await utils.catalog.categories.list.invalidate();
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('admin.catalog.categories.toast.error'));
    },
  });

  function handleToggleActive(category: Category, newValue: boolean) {
    if (!newValue) {
      setDeactivateTarget(category);
    } else {
      setActiveMutation.mutate({ id: category.id, isActive: true });
    }
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    setActiveMutation.mutate({ id: deactivateTarget.id, isActive: false });
    setDeactivateTarget(null);
  }

  function handleMove(index: number, direction: 'up' | 'down') {
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const current = sorted[index];
    const neighbor = sorted[swapIndex];
    if (!current || !neighbor) return;

    const newOrder = sorted.map((c, i) => {
      if (i === index) return { id: c.id, displayOrder: neighbor.displayOrder };
      if (i === swapIndex) return { id: c.id, displayOrder: current.displayOrder };
      return { id: c.id, displayOrder: c.displayOrder };
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

  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin.catalog.categories.columns.name')}</TableHead>
            <TableHead>{t('admin.catalog.categories.columns.printDestination')}</TableHead>
            <TableHead className="w-24 text-center">
              {t('admin.catalog.categories.columns.order')}
            </TableHead>
            <TableHead className="w-20 text-center">
              {t('admin.catalog.categories.columns.active')}
            </TableHead>
            <TableHead className="w-16">{t('admin.catalog.categories.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((category, index) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {t(`admin.catalog.printDestination.${category.printDestination}`)}
                </Badge>
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
                  checked={category.isActive}
                  onCheckedChange={(v) => handleToggleActive(category, v)}
                  aria-label={t('admin.catalog.categories.columns.active')}
                />
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('common.edit')}
                  onClick={() => setEditTarget(category)}
                  className="h-8 w-8"
                >
                  <Pencil size={14} strokeWidth={1.5} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CategoryFormDialog
        open={Boolean(editTarget)}
        category={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setEditTarget(null);
          toast.success(t('admin.catalog.categories.toast.updated'));
        }}
      />

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.catalog.categories.deactivate.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.catalog.categories.deactivate.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>
              {t('admin.catalog.categories.deactivate.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
