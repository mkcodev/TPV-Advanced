import { createServerClient } from '@supabase/ssr';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: Partial<ResponseCookie> };

export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Faltan variables NEXT_PUBLIC_SUPABASE_URL / ANON_KEY');

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // En Server Components, setAll lanza si se llama fuera de Route Handler.
          // Las cookies de auth se refrescan correctamente desde middleware.
        }
      },
    },
  });
}
