import { getSupabaseServer } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/admin/login', req.url));
  response.cookies.delete('tpv_active_business');
  return response;
}
