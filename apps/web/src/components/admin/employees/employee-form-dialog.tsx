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
  FormDescription,
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
import { EMPLOYEE_ROLES, type Employee } from './employee-types';

type Props = {
  open: boolean;
  onClose: () => void;
  // Sin empleado = alta nueva (pide PIN). Con empleado = edición (nombre y rol).
  employee?: Employee;
  onSuccess: () => void;
};

type FormValues = {
  name: string;
  role: Employee['role'];
  pin: string;
};

const EMPTY: FormValues = { name: '', role: 'worker', pin: '' };

export function EmployeeFormDialog({ open, onClose, employee, onSuccess }: Props) {
  const t = useTranslations('admin.employees');
  const tc = useTranslations('common');
  const utils = trpc.useUtils();
  const isEdit = Boolean(employee);

  const form = useForm<FormValues>({ defaultValues: EMPTY });

  useEffect(() => {
    if (open) {
      form.reset(employee ? { name: employee.name, role: employee.role, pin: '' } : EMPTY);
    }
  }, [open, employee, form]);

  const onDone = async () => {
    await utils.employees.list.invalidate();
    onSuccess();
  };

  const createMutation = trpc.employees.create.useMutation({ onSuccess: onDone });
  const updateMutation = trpc.employees.update.useMutation({ onSuccess: onDone });
  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error ?? updateMutation.error;

  function onSubmit(values: FormValues) {
    if (employee) {
      updateMutation.mutate({ id: employee.id, name: values.name, role: values.role });
    } else {
      createMutation.mutate({ name: values.name, role: values.role, pin: values.pin });
    }
  }

  const role = form.watch('role');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('edit') : t('new')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: true, validate: (v) => v.trim().length > 0 }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('fields.namePlaceholder')}
                      maxLength={80}
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.role')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EMPLOYEE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(`roles.${r}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Explica qué puede hacer el rol elegido (el rol de empleado no da acceso al panel). */}
                  <FormDescription>{t(`roleHelp.${role}`)}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && (
              <FormField
                control={form.control}
                name="pin"
                rules={{
                  required: t('fields.pinInvalid'),
                  pattern: { value: /^\d{4,6}$/, message: t('fields.pinInvalid') },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.pin')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={6}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    <FormDescription>{t('fields.pinHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {t('toast.error')}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
