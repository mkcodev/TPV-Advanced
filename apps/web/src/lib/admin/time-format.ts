// Utilidades puras de tiempo para el panel admin (sin textos: el texto va por i18n).

// "mm:ss" para la cuenta atrás del código de vinculación. Nunca negativo.
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export type RelativeTime = { unit: 'now' } | { unit: 'minutes' | 'hours' | 'days'; value: number };

// Distancia entre dos instantes en la unidad más grande que quepa ("visto hace X").
export function relativeTime(then: Date, now: Date): RelativeTime {
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return { unit: 'now' };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { unit: 'minutes', value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'hours', value: hours };
  return { unit: 'days', value: Math.floor(hours / 24) };
}
