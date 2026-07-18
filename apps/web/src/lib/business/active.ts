import { cookies } from 'next/headers';

const COOKIE_NAME = 'tpv_active_business';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 año

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

/** Lee el business_id activo desde cookies del servidor (Server Components / Route Handlers). */
export async function getActiveBusinessServer(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}
