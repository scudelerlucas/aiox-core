/**
 * OS-LIFEBOARD — Portão de acesso (HTTP Basic Auth) para o dashboard publicado.
 *
 * O dashboard é single-user (dados pessoais de Lucas). Publicado na Vercel, a URL
 * é pública; este middleware exige a senha `LIFEBOARD_ACCESS_SECRET` antes de
 * servir qualquer página/rota — EXCETO `/api/health`, que precisa responder sem
 * auth para o uptime-check e o rollback automático (kill-switch nº 6 do PRD).
 *
 * Se `LIFEBOARD_ACCESS_SECRET` não estiver setado (dev local em modo fixture), o
 * gate fica DESATIVADO — não atrapalha o desenvolvimento. Em produção (Vercel),
 * a env é obrigatória para o dashboard não ficar aberto.
 *
 * Basic Auth: usuário é ignorado (single-user), valida só a senha. Comparação
 * simples de string — o segredo é forte e aleatório (24 chars).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REALM = 'Basic realm="OS-LIFEBOARD", charset="UTF-8"';

function unauthorized(): NextResponse {
  return new NextResponse("Acesso restrito — OS-LIFEBOARD.", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

export function middleware(request: NextRequest): NextResponse {
  const secret = process.env.LIFEBOARD_ACCESS_SECRET ?? "";

  // Gate desativado em dev/fixture quando não há senha configurada.
  if (secret === "") {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password === secret) {
      return NextResponse.next();
    }
  }
  return unauthorized();
}

/**
 * Matcher: intercepta tudo EXCETO `/api/health` (health-check sem auth) e os
 * assets internos do Next (_next, favicon). A negative lookahead cobre ambos.
 */
export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
