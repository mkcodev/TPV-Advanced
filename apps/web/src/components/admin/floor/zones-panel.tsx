'use client';

import { trpc } from '@/lib/trpc/client';
import { Button, cn } from '@tpv/ui';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ZoneFormDialog } from './zone-form-dialog';

type Zone = { id: string; name: string; isActive: boolean; displayOrder: number };

type Props = {
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
};

export function ZonesPanel({ selectedZoneId, onSelectZone }: Props) {
  const t = useTranslations();
  const [newOpen, setNewOpen] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);

  const { data, isLoading } = trpc.floor.zones.list.useQuery({ includeInactive: true });
  const zones: Zone[] = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t('admin.floor.zones.title')}</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setNewOpen(true)}
          aria-label={t('admin.floor.zones.new')}
        >
          <Plus size={16} strokeWidth={1.5} />
        </Button>
      </div>

      {!isLoading && zones.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('admin.floor.zones.empty')}</p>
      )}

      <div className="flex flex-col gap-1">
        {zones.map((zone) => (
          <div key={zone.id} className={cn('group relative', !zone.isActive && 'opacity-50')}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center rounded-md px-2 py-1.5 text-left transition-colors',
                selectedZoneId === zone.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50',
              )}
              onClick={() => onSelectZone(zone.id)}
              aria-pressed={selectedZoneId === zone.id}
            >
              <span className="truncate pr-6 text-sm">{zone.name}</span>
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              aria-label={t('common.edit')}
              onClick={() => setEditZone(zone)}
            >
              <Pencil size={12} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>

      <ZoneFormDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSuccess={() => {
          setNewOpen(false);
          toast.success(t('admin.floor.zones.toast.created'));
        }}
      />

      {editZone && (
        <ZoneFormDialog
          open={true}
          zone={editZone}
          onClose={() => setEditZone(null)}
          onSuccess={() => {
            setEditZone(null);
            toast.success(t('admin.floor.zones.toast.updated'));
          }}
        />
      )}
    </div>
  );
}
