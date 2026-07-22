'use client';

import { trpc } from '@/lib/trpc/client';
import { cn } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { TpvFloorView } from './tpv-floor-view';

export function TpvFloorZoneTabs() {
  const t = useTranslations('tpv.floor');
  const { data } = trpc.floor.zones.list.useQuery({});
  const zones = data ?? [];
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const currentZoneId = activeZoneId ?? zones[0]?.id ?? null;

  if (zones.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">{t('noZones')}</p>
        <p className="text-xs text-muted-foreground">{t('noZonesCta')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {zones.length > 1 && (
        <div className="flex shrink-0 gap-1 border-b border-border px-4 pt-2 overflow-x-auto">
          {zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => setActiveZoneId(zone.id)}
              className={cn(
                'shrink-0 rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
                currentZoneId === zone.id
                  ? 'border border-b-0 border-border bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {zone.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {currentZoneId !== null && (
          <TpvFloorView
            zoneId={currentZoneId}
            zoneName={zones.find((z) => z.id === currentZoneId)?.name ?? ''}
          />
        )}
      </div>
    </div>
  );
}
