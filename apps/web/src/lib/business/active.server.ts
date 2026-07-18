import 'server-only';

import { cookies } from 'next/headers';
import { COOKIE_NAME } from './constants';

/** Lee el business_id activo desde cookies del servidor (Server Components / Route Handlers). */
export async function getActiveBusinessServer(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}
