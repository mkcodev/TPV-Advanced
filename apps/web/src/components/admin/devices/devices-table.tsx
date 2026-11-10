'use client';

import { relativeTime } from '@/lib/admin/time-format';
import {
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tpv/ui';
import { Ban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Device } from './device-types';

type Props = {
  devices: Device[];
  isLoading: boolean;
  onRevoke: (device: Device) => void;
};

export function DevicesTable({ devices, isLoading, onRevoke }: Props) {
  const t = useTranslations('admin.devices');

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => `sk-${i}`).map((k) => (
          <Skeleton key={k} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  function lastSeenLabel(device: Device): string {
    if (!device.lastSeenAt) return t('lastSeen.never');
    const rel = relativeTime(new Date(device.lastSeenAt), new Date());
    return rel.unit === 'now' ? t('lastSeen.now') : t(`lastSeen.${rel.unit}`, { count: rel.value });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.name')}</TableHead>
          <TableHead>{t('columns.type')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
          <TableHead>{t('columns.lastSeen')}</TableHead>
          <TableHead className="w-20">{t('columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.map((device) => (
          <TableRow key={device.id}>
            <TableCell className="font-medium">{device.name}</TableCell>
            <TableCell>
              <Badge variant="outline">{t(`types.${device.type}`)}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={device.isActive ? 'success' : 'secondary'}>
                {device.isActive ? t('status.active') : t('status.revoked')}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{lastSeenLabel(device)}</TableCell>
            <TableCell>
              {device.isActive && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('actions.revoke')}
                  onClick={() => onRevoke(device)}
                  className="h-11 w-11"
                >
                  <Ban size={16} strokeWidth={1.5} />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
