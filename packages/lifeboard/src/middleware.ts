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
 * FONTE DUPLA DE AUTORIZAÇÃO (12/09/2026): além da env `LIFEBOARD_ALLOWED_EMAILS`,
 * vale estar na tabela `painel_frentes_leitores` — assim liberar a esposa (ou
 * qualquer pessoa) é INSERT no banco, sem redeploy. A policy
 * `painel_frentes_leitores_proprio` deixa cada um ler só a própria linha, então a
 * consulta vai na identidade de quem está entrando. O resultado fica 5 min em
 * memória por e-mail para não bater no banco a cada requisição.
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

/** Cache do "pode ler" por e-mail (5 min) — uma instância do middleware. */
const CACHE_MS = 5 * 60_000;
const cacheLeitores = new Map<string, { pode: boolean; expira: number }>();

type ClienteLeitura = {
  from: (tabela: string) => {
    select: (colunas: string) => {
      eq: (coluna: string, valor: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

/** Está na env OU tem linha em `painel_frentes_leitores`? */
async function podeLer(supabase: ClienteLeitura, email: string): Promise<boolean> {
  if (ALLOWED.includes(email)) return true;

  const agora = Date.now();
  const guardado = cacheLeitores.get(email);
  if (guardado && guardado.expira > agora) return guardado.pode;

  let pode = false;
  try {
    const { data, error } = await supabase
      .from("painel_frentes_leitores")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    pode = !error && data !== null;
  } catch {
    // Banco fora do ar não é autorização: quem não está na env continua fora.
    pode = false;
  }
  cacheLeitores.set(email, { pode, expira: agora + CACHE_MS });
  return pode;
}

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
  const autorizado = user ? await podeLer(supabase as unknown as ClienteLeitura, email) : false;
  if (!user || !autorizado) {
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
