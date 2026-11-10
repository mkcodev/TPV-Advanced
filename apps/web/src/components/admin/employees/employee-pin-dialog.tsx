'use client';

import { trpc } from '@/lib/trpc/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { Employee } from './employee-types';

type Props = {
  // null = diálogo cerrado.
  employee: Employee | null;
  onClose: () => void;
  onSuccess: () => void;
};

type FormValues = { pin: string; repeat: string };

export function EmployeePinDialog({ employee, onClose, onSuccess }: Props) {
  const t = useTranslations('admin.employees');
  const tc = useTranslations('common');
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({ defaultValues: { pin: '', repeat: '' } });

  useEffect(() => {
    if (employee) form.reset({ pin: '', repeat: '' });
  }, [employee, form]);

  const mutation = trpc.employees.setPin.useMutation({
    onSuccess: async () => {
      // Cambiar el PIN también desbloquea: refrescamos la lista para quitar el aviso de bloqueo.
      await utils.employees.list.invalidate();
      onSuccess();
    },
  });

  const digitsOnly = (v: string) => v.replace(/\D/g, '');

  return (
    <Dialog open={Boolean(employee)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pinDialog.title', { name: employee?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('pinDialog.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              if (employee) mutation.mutate({ id: employee.id, pin: values.pin });
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="pin"
              rules={{
                required: t('fields.pinInvalid'),
                pattern: { value: /^\d{4,6}$/, message: t('fields.pinInvalid') },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.newPin')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      {...field}
                      onChange={(e) => field.onChange(digitsOnly(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="repeat"
              rules={{ validate: (v) => v === form.getValues('pin') || t('fields.pinMismatch') }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.repeatPin')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      {...field}
                      onChange={(e) => field.onChange(digitsOnly(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {t('toast.error')}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
