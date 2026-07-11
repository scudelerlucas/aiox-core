/**
 * OS-LIFEBOARD — Signout. Encerra a sessão Supabase e volta pro login.
 */

import { NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { origin } = new URL(request.url);
  const supabase = await createSupabaseRouteClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/login`);
}
