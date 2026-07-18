'use client';

import { trpc } from '@/lib/trpc/client';
import { eurosToCents, formatCents } from '@tpv/core';
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
  Textarea,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AllergensPicker } from './allergens-picker';
import { ImageUploader } from './image-uploader';
import { TaxRateSelect } from './tax-rate-select';

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
};

type Props = {
  open: boolean;
  onClose: () => void;
  product?: Product;
  categories: Category[];
  onSuccess: () => void;
};

type FormValues = {
  name: string;
  description: string;
  categoryId: string;
  priceEuros: string;
  taxRate: string;
  allergens: string[];
  sku: string;
  imageUrl: string | null;
};

export function ProductFormDialog({ open, onClose, product, categories, onSuccess }: Props) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
      priceEuros: '',
      taxRate: '10',
      allergens: [],
      sku: '',
      imageUrl: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        product
          ? {
              name: product.name,
              description: product.description ?? '',
              categoryId: product.categoryId,
              priceEuros: (product.basePriceCents / 100).toFixed(2),
              taxRate: String(product.taxRate),
              allergens: product.allergens,
              sku: product.sku ?? '',
              imageUrl: product.imageUrl,
            }
          : {
              name: '',
              description: '',
              categoryId: categories[0]?.id ?? '',
              priceEuros: '',
              taxRate: '10',
              allergens: [],
              sku: '',
              imageUrl: null,
            },
      );
    }
  }, [open, product, categories, form]);

  const createMutation = trpc.catalog.products.create.useMutation({
    onSuccess: async () => {
      await utils.catalog.products.list.invalidate();
      onSuccess();
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('admin.catalog.products.toast.error'));
    },
  });

  const updateMutation = trpc.catalog.products.update.useMutation({
    onSuccess: async () => {
      await utils.catalog.products.list.invalidate();
      onSuccess();
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('admin.catalog.products.toast.error'));
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: FormValues) {
    const basePriceCents = eurosToCents(Number.parseFloat(values.priceEuros) || 0);
    const taxRate = Number.parseFloat(values.taxRate) || 0;
    const payload = {
      name: values.name,
      description: values.description || undefined,
      categoryId: values.categoryId,
      basePriceCents,
      taxRate,
      allergens: values.allergens as Parameters<typeof createMutation.mutate>[0]['allergens'],
      sku: values.sku || undefined,
      imageUrl: values.imageUrl || undefined,
    };

    if (product) {
      updateMutation.mutate({ id: product.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const priceEuros = form.watch('priceEuros');
  const previewCents = eurosToCents(Number.parseFloat(priceEuros) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? t('admin.catalog.products.edit') : t('admin.catalog.products.new')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Columna izquierda */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: true, minLength: 1 }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.products.fields.name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('admin.catalog.products.fields.namePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.products.fields.description')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('admin.catalog.products.fields.descriptionPlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.products.fields.category')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
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
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.products.fields.sku')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('admin.catalog.products.fields.skuPlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Columna derecha */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.products.fields.image')}</FormLabel>
                      <FormControl>
                        <ImageUploader
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priceEuros"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.products.fields.price')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={t('admin.catalog.products.fields.pricePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      {previewCents > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          = {formatCents(previewCents)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.catalog.products.fields.taxRate')}</FormLabel>
                      <FormControl>
                        <TaxRateSelect
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Alérgenos — ancho completo */}
            <FormField
              control={form.control}
              name="allergens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalog.products.fields.allergens')}</FormLabel>
                  <FormControl>
                    <AllergensPicker
                      value={field.value as Parameters<typeof AllergensPicker>[0]['value']}
                      onChange={field.onChange}
                      disabled={isPending}
                    />
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
