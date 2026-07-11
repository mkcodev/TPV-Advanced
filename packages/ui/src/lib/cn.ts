import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind resolviendo conflictos. Úsalo SIEMPRE en componentes. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
