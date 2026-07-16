'use client';

import type { ComponentProps } from 'react';
import { Toaster as Sonner } from 'sonner';

/* Toaster — sistema de toasts basado en sonner.
   Ubicar <Toaster /> en el layout raíz de apps/web.
   Para acciones destructivas leves usar:
     toast('Línea eliminada', { action: { label: 'Deshacer', onClick: fn } })
   El modal Dialog queda para anulaciones de comanda entera o cierre de caja.
   Ver DESIGN-SYSTEM.md §0 "Principio 7 — Optimista por defecto". */
type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}
