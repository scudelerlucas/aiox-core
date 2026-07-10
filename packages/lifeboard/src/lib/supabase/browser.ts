"use client";

/**
 * OS-LIFEBOARD — Supabase browser client (para o login Google).
 *
 * Usa a chave anon/publishable (PÚBLICA por design — segura no browser). Não
 * carrega segredo nenhum: o `LIFEBOARD_LOAD_SECRET` (leitura de dados) é
 * server-only e nunca chega aqui.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
