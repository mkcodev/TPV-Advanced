'use client';

import { FloorCanvas } from '@/components/admin/floor/floor-canvas';
import { ZonesPanel } from '@/components/admin/floor/zones-panel';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function FloorClient() {
  const t = useTranslations('admin.floor');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <div className="flex gap-6 min-h-[600px]">
        <aside className="w-64 shrink-0">
          <ZonesPanel selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />
        </aside>
        <div className="flex-1 min-w-0">
          <FloorCanvas zoneId={selectedZoneId} />
        </div>
      </div>
    </div>
  );
}
