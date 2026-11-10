'use client';

import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Device } from './device-types';
import { DevicesTable } from './devices-table';
import { PairingCodeDialog } from './pairing-code-dialog';
import { RevokeDeviceDialog } from './revoke-device-dialog';

export function DevicesPanel() {
  const t = useTranslations('admin.devices');
  const [pairOpen, setPairOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Device | null>(null);

  const { data, isLoading, isError } = trpc.auth.listDevices.useQuery();

  if (isError) {
    toast.error(t('loadError'));
  }

  const devices = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setPairOpen(true)}>
          <Plus size={16} strokeWidth={1.5} />
          {t('pair')}
        </Button>
      </div>

      {!isLoading && devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setPairOpen(true)}>
            {t('emptyCta')}
          </Button>
        </div>
      ) : (
        <DevicesTable devices={devices} isLoading={isLoading} onRevoke={setRevokeTarget} />
      )}

      <PairingCodeDialog open={pairOpen} onClose={() => setPairOpen(false)} />
      <RevokeDeviceDialog device={revokeTarget} onClose={() => setRevokeTarget(null)} />
    </div>
  );
}
