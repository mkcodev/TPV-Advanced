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
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Device } from './device-types';

type Props = {
  // null = diálogo cerrado.
  device: Device | null;
  onClose: () => void;
};

export function RevokeDeviceDialog({ device, onClose }: Props) {
  const t = useTranslations('admin.devices');
  const tc = useTranslations('common');
  const utils = trpc.useUtils();

  const mutation = trpc.auth.revokeDevice.useMutation({
    onSuccess: async () => {
      await utils.auth.listDevices.invalidate();
      toast.success(t('toast.revoked'));
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('toast.error'));
    },
  });

  function confirm() {
    if (!device) return;
    mutation.mutate({ deviceId: device.id });
    onClose();
  }

  return (
    <AlertDialog open={Boolean(device)} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('revoke.title', { name: device?.name ?? '' })}</AlertDialogTitle>
          {/* Aviso: revocar no cierra la caja que tuviera abierta ese terminal. */}
          <AlertDialogDescription>{t('revoke.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>{t('revoke.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
