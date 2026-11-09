import { useEffect, useId, useSyncExternalStore } from 'react';
import { cn } from './cn';

// Registro de los overlays de diálogo montados, del más antiguo al más reciente.
// Radix pinta un overlay por cada diálogo abierto; si se abre un diálogo desde otro
// (p. ej. "Abrir caja" desde el cobro), dos overlays oscuros se suman y el fondo queda casi
// negro. Por eso solo el más antiguo oscurece; los anidados son transparentes (pero siguen
// bloqueando los clics fuera del diálogo interior, como cualquier modal).
const stack: string[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Clases del overlay de Dialog, AlertDialog y Sheet. Todo sale de tokens.css:
// --overlay (color), --overlay-blur (desenfoque) y --z-overlay (capa).
export function useOverlayClassName(className?: string): string {
  const id = useId();

  useEffect(() => {
    stack.push(id);
    emit();
    return () => {
      stack.splice(stack.indexOf(id), 1);
      emit();
    };
  }, [id]);

  // Oscurece si no hay otro overlay más antiguo. En el primer render (antes del efecto) la pila
  // está vacía para el primero, así que no parpadea transparente.
  const dims = useSyncExternalStore(
    subscribe,
    () => stack.length === 0 || stack[0] === id,
    () => true,
  );

  return cn(
    'fixed inset-0 z-(--z-overlay)',
    dims ? 'bg-overlay backdrop-blur-(--overlay-blur)' : 'bg-transparent',
    className,
  );
}
