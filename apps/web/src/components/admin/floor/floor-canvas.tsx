'use client';

import { trpc } from '@/lib/trpc/client';
import { Button } from '@tpv/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { TableEditorItem } from './table-editor-item';
import { TableFormDialog } from './table-form-dialog';

type Props = { zoneId: string | null };

export function FloorCanvas({ zoneId }: Props) {
  const t = useTranslations('admin.floor');
  const [newOpen, setNewOpen] = useState(false);

  const { data, refetch } = trpc.floor.tables.listByZone.useQuery(
    { zoneId: zoneId ?? '' },
    { enabled: zoneId !== null },
  );
  const tables = data ?? [];

  if (zoneId === null) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
        <p className="text-sm text-muted-foreground">{t('zones.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t('canvas.hint')}</p>
        <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
          <Plus size={14} strokeWidth={1.5} className="mr-1" />
          {t('tables.new')}
        </Button>
      </div>

      <div
        className="relative flex-1 rounded-lg border border-border bg-muted/30 overflow-hidden"
        style={{ minHeight: 480 }}
      >
        {tables.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <p className="text-sm text-muted-foreground">{t('canvas.empty')}</p>
            <p className="text-xs text-muted-foreground">{t('canvas.emptyCta')}</p>
          </div>
        )}

        {tables.map((table) => (
          <TableEditorItem
            key={table.id}
            table={table}
            zoneId={zoneId}
            onUpdated={() => {
              void refetch();
              toast.success(t('tables.toast.updated'));
            }}
          />
        ))}
      </div>

      <TableFormDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        zoneId={zoneId}
        onSuccess={() => {
          setNewOpen(false);
          void refetch();
          toast.success(t('tables.toast.created'));
        }}
      />
    </div>
  );
}
