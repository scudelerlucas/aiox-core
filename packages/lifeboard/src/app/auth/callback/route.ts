/**
 * OS-LIFEBOARD — Callback OAuth do login Google.
 *
 * Fluxo: signInWithOAuth → Google → Supabase (/auth/v1/callback) → aqui com
 * `?code=...`. Trocamos o code por uma sessão (cookies httpOnly) e redirecionamos
 * pro dashboard. O middleware faz a checagem de allowlist a cada request.
 */

import { NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  // Falha na troca → volta pro login com flag de erro.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
