'use client';

import { trpc } from '@/lib/trpc/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tpv/ui';
import type { createCategorySchema } from '@tpv/validators';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

type Category = {
  id: string;
  name: string;
  printDestination: 'kitchen' | 'bar' | 'none';
  displayOrder: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  category?: Category;
  onSuccess: () => void;
};

type CreateInput = z.infer<typeof createCategorySchema>;
type FormValues = {
  name: string;
  printDestination: 'kitchen' | 'bar' | 'none';
  displayOrder: string;
};

const PRINT_DESTINATIONS = ['kitchen', 'bar', 'none'] as const;

export function CategoryFormDialog({ open, onClose, category, onSuccess }: Props) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    defaultValues: { name: '', printDestination: 'none', displayOrder: '0' },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        category
          ? {
              name: category.name,
              printDestination: category.printDestination,
              displayOrder: String(category.displayOrder),
            }
          : { name: '', printDestination: 'none', displayOrder: '0' },
      );
    }
  }, [open, category, form]);

  const createMutation = trpc.catalog.categories.create.useMutation({
    onSuccess: async () => {
      await utils.catalog.categories.list.invalidate();
      onSuccess();
    },
  });

  const updateMutation = trpc.catalog.categories.update.useMutation({
    onSuccess: async () => {
      await utils.catalog.categories.list.invalidate();
      onSuccess();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: FormValues) {
    const displayOrder = Number.parseInt(values.displayOrder, 10) || 0;
    if (category) {
      updateMutation.mutate({ id: category.id, ...values, displayOrder });
    } else {
      createMutation.mutate({ ...values, displayOrder } as CreateInput);
    }
  }

  const isEdit = Boolean(category);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('admin.catalog.categories.edit') : t('admin.catalog.categories.new')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: true, minLength: 1 }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.categories.fields.name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('admin.catalog.categories.fields.namePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="printDestination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.categories.fields.printDestination')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRINT_DESTINATIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {t(`admin.catalog.printDestination.${d}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.categories.fields.displayOrder')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
