import { COOKIE_NAME, MAX_AGE } from './constants';

/** Lee el business_id activo desde document.cookie (browser only). */
export function getActiveBusinessClient(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const value = match?.[1];
  return value !== undefined ? decodeURIComponent(value) : null;
}

/** Persiste el business_id activo en una cookie (browser only). */
export function setActiveBusinessClient(businessId: string): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(businessId)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

/** Limpia el business_id activo (browser only). */
export function clearActiveBusinessClient(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
