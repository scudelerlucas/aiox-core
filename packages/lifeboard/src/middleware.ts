/**
 * OS-LIFEBOARD — Portão de acesso por LOGIN GOOGLE (Supabase Auth) + allowlist.
 *
 * Substitui o Basic Auth: só quem loga com uma conta Google cujo email está na
 * allowlist (`LIFEBOARD_ALLOWED_EMAILS`, default = os 2 emails de Lucas) acessa o
 * dashboard. A RLS do Supabase (owner = auth.uid()) é a segunda camada — mesmo se
 * outro email entrasse, só veria os próprios dados (vazios), nunca os de Lucas.
 *
 * Público (sem login): `/login`, `/auth/*` (callback/signout) e `/api/health`
 * (sonda de uptime + rollback, kill-switch nº 6).
 *
 * Se `NEXT_PUBLIC_SUPABASE_URL` não estiver setado (dev fixture), o gate fica
 * DESATIVADO — não atrapalha o desenvolvimento local.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const ALLOWED = (
  process.env.LIFEBOARD_ALLOWED_EMAILS ??
  "lucas.scudeler@pandoratreinamentos.com.br,lucasscudeler@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isPublicPath(path: string): boolean {
  return (
    path === "/login" ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/health")
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const path = request.nextUrl.pathname;

  // Gate desativado em dev/fixture (sem Supabase configurado).
  if (url === "" || anon === "") return NextResponse.next();
  if (isPublicPath(path)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = (user?.email ?? "").toLowerCase();
  if (!user || !ALLOWED.includes(email)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = user ? "?error=forbidden" : "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
