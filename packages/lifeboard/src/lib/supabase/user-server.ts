import "server-only";

/**
 * OS-LIFEBOARD — Supabase client do USUÁRIO LOGADO, para Server Components.
 *
 * Diferente de `live-client.ts` (que lê tudo por uma RPC protegida por segredo),
 * aqui a leitura vai na identidade de quem está logado: os cookies da sessão
 * Google viajam na requisição e a RLS das tabelas `painel_frentes_*` libera as
 * linhas para os e-mails da allowlist. Nenhum segredo novo entra no projeto.
 *
 * `setAll` é engolido num try/catch porque, dentro de um Server Component, os
 * cookies são só de leitura — renovar o token é papel do middleware. Esse é o
 * padrão recomendado pelo `@supabase/ssr`.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/config/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createSupabaseUserClient() {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
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
          // Server Component: cookie é read-only. O middleware já renova a sessão.
        }
      },
    },
  });
}
