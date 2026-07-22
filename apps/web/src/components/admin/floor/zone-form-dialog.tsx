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
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

type Zone = { id: string; name: string };
type Props = { open: boolean; onClose: () => void; zone?: Zone; onSuccess: () => void };
type FormValues = { name: string };

export function ZoneFormDialog({ open, onClose, zone, onSuccess }: Props) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const form = useForm<FormValues>({ defaultValues: { name: '' } });

  useEffect(() => {
    if (open) form.reset({ name: zone?.name ?? '' });
  }, [open, zone, form]);

  const createMutation = trpc.floor.zones.create.useMutation({
    onSuccess: async () => {
      await utils.floor.zones.list.invalidate();
      onSuccess();
    },
  });
  const updateMutation = trpc.floor.zones.update.useMutation({
    onSuccess: async () => {
      await utils.floor.zones.list.invalidate();
      onSuccess();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit({ name }: FormValues) {
    if (zone) {
      updateMutation.mutate({ id: zone.id, name });
    } else {
      createMutation.mutate({ name });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {zone ? t('admin.floor.zones.edit') : t('admin.floor.zones.new')}
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
                  <FormLabel>{t('admin.floor.zones.fields.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.floor.zones.fields.namePlaceholder')} {...field} />
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
