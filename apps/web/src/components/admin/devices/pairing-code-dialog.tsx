'use client';

import { formatCountdown } from '@/lib/admin/time-format';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DEVICE_TYPES, type DeviceTypeName } from './device-types';

type Props = {
  open: boolean;
  onClose: () => void;
};

type FormValues = { name: string; type: DeviceTypeName };

// Código ya generado: la cuenta atrás se mide con el reloj de ESTE navegador a partir de
// ttlMs (lo manda el servidor), así no depende de que ambos relojes coincidan.
type IssuedCode = { code: string; ttlMs: number; receivedAt: number };

const EMPTY: FormValues = { name: '', type: 'pos_terminal' };

// "12345678" → "1234 5678": se lee y se teclea mejor en grupos.
const groupCode = (code: string) => code.replace(/(\d{4})(?=\d)/g, '$1 ');

export function PairingCodeDialog({ open, onClose }: Props) {
  const t = useTranslations('admin.devices');
  const tc = useTranslations('common');
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({ defaultValues: EMPTY });
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (open) {
      form.reset(EMPTY);
      setIssued(null);
    }
  }, [open, form]);

  // Reloj de 1 s solo mientras hay un código en pantalla.
  useEffect(() => {
    if (!issued) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [issued]);

  const mutation = trpc.auth.createPairingCode.useMutation({
    onSuccess: (result) => {
      setIssued({ code: result.code, ttlMs: result.ttlMs, receivedAt: Date.now() });
    },
  });

  function close() {
    // El terminal nuevo puede haberse vinculado mientras el código estaba abierto.
    utils.auth.listDevices.invalidate();
    onClose();
  }

  const remainingMs = issued ? issued.ttlMs - (now - issued.receivedAt) : 0;
  const expired = issued !== null && remainingMs <= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pairDialog.title')}</DialogTitle>
          {!issued && <DialogDescription>{t('pairDialog.description')}</DialogDescription>}
        </DialogHeader>

        {issued ? (
          <div className="space-y-4">
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">{t('pairDialog.codeLabel')}</p>
              <p
                className={`text-4xl font-semibold tabular-nums tracking-widest ${
                  expired ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
              >
                {groupCode(issued.code)}
              </p>
              <p
                role="timer"
                aria-live="off"
                className={`text-sm font-medium ${expired ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {expired
                  ? t('pairDialog.expired')
                  : t('pairDialog.expiresIn', { time: formatCountdown(remainingMs) })}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{t('pairDialog.codeHelp')}</p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIssued(null);
                  mutation.reset();
                }}
              >
                {t('pairDialog.another')}
              </Button>
              <Button type="button" onClick={close}>
                {t('pairDialog.done')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                rules={{ required: true, validate: (v) => v.trim().length > 0 }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pairDialog.fields.name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('pairDialog.fields.namePlaceholder')}
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pairDialog.fields.type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEVICE_TYPES.map((d) => (
                          <SelectItem key={d} value={d}>
                            {t(`types.${d}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  onClick={close}
                  disabled={mutation.isPending}
                >
                  {tc('cancel')}
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {t('pairDialog.generate')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
