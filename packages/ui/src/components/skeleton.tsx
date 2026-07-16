import type * as React from 'react';
import { cn } from '../lib/cn';

/* Skeleton — placeholder de carga. Solo animate-pulse (opacity) conforme
   a la regla de no animar width/height. Ver DESIGN-SYSTEM.md §7 "Motion". */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
