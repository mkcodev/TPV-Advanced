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
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

type Table = {
  id: string;
  name: string;
  seats: number;
  shape: 'square' | 'round';
  posX: number;
  posY: number;
  width: number;
  height: number;
};
type Props = {
  open: boolean;
  onClose: () => void;
  zoneId: string;
  table?: Table;
  onSuccess: () => void;
};
type FormValues = {
  name: string;
  seats: string;
  shape: 'square' | 'round';
  width: string;
  height: string;
};

const SHAPES = ['square', 'round'] as const;

export function TableFormDialog({ open, onClose, zoneId, table, onSuccess }: Props) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const form = useForm<FormValues>({
    defaultValues: { name: '', seats: '4', shape: 'square', width: '80', height: '80' },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        table
          ? {
              name: table.name,
              seats: String(table.seats),
              shape: table.shape,
              width: String(table.width),
              height: String(table.height),
            }
          : { name: '', seats: '4', shape: 'square', width: '80', height: '80' },
      );
    }
  }, [open, table, form]);

  const invalidate = () => utils.floor.tables.listByZone.invalidate({ zoneId });

  const createMutation = trpc.floor.tables.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      onSuccess();
    },
  });
  const updateMutation = trpc.floor.tables.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      onSuccess();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: FormValues) {
    const seats = Math.max(1, Number.parseInt(values.seats, 10) || 1);
    const width = Math.max(40, Number.parseInt(values.width, 10) || 80);
    const height = Math.max(40, Number.parseInt(values.height, 10) || 80);
    if (table) {
      updateMutation.mutate({
        id: table.id,
        name: values.name,
        seats,
        shape: values.shape,
        width,
        height,
      });
    } else {
      createMutation.mutate({
        zoneId,
        name: values.name,
        seats,
        shape: values.shape,
        width,
        height,
        posX: 20,
        posY: 20,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {table ? t('admin.floor.tables.edit') : t('admin.floor.tables.new')}
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
                  <FormLabel>{t('admin.floor.tables.fields.name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('admin.floor.tables.fields.namePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="seats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.floor.tables.fields.seats')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={20} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shape"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.floor.tables.fields.shape')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SHAPES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`admin.floor.tables.shape.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
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
