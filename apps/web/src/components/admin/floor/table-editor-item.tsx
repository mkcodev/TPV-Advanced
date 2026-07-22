'use client';

import { trpc } from '@/lib/trpc/client';
import { Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { TableFormDialog } from './table-form-dialog';

type Table = {
  id: string;
  name: string;
  seats: number;
  shape: 'square' | 'round';
  posX: number;
  posY: number;
  width: number;
  height: number;
};

type Props = {
  table: Table;
  zoneId: string;
  onUpdated: () => void;
};

const GRID = 10;

function snapToGrid(value: number): number {
  return Math.round(value / GRID) * GRID;
}

export function TableEditorItem({ table, zoneId, onUpdated }: Props) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.floor.tables.update.useMutation({
    onSuccess: async () => {
      await utils.floor.tables.listByZone.invalidate({ zoneId });
      onUpdated();
    },
  });

  const [pos, setPos] = useState({ x: table.posX, y: table.posY });
  const [editOpen, setEditOpen] = useState(false);

  const dragRef = useRef<{
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const isDraggingRef = useRef(false);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
    isDraggingRef.current = false;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startPointerX;
    const dy = e.clientY - dragRef.current.startPointerY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      isDraggingRef.current = true;
    }
    if (!isDraggingRef.current) return;
    setPos({
      x: Math.max(0, snapToGrid(dragRef.current.startX + dx)),
      y: Math.max(0, snapToGrid(dragRef.current.startY + dy)),
    });
  }

  function handlePointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    updateMutation.mutate({ id: table.id, posX: pos.x, posY: pos.y });
  }

  function handleDoubleClick() {
    if (isDraggingRef.current) return;
    setEditOpen(true);
  }

  const borderRadius = table.shape === 'round' ? '50%' : '0.5rem';

  return (
    <>
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        aria-label={`${table.name} — doble clic para editar`}
        style={{
          position: 'absolute',
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          width: table.width,
          height: table.height,
          borderRadius,
          touchAction: 'none',
        }}
        className="flex flex-col items-center justify-center gap-0.5 border-2 border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary hover:bg-accent active:border-primary cursor-grab active:cursor-grabbing select-none"
      >
        <span className="text-xs font-semibold leading-tight truncate px-1 max-w-full">
          {table.name}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Users size={10} strokeWidth={1.5} aria-hidden />
          {table.seats}
        </span>
      </button>

      <TableFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        zoneId={zoneId}
        table={table}
        onSuccess={() => {
          setEditOpen(false);
          onUpdated();
        }}
      />
    </>
  );
}
