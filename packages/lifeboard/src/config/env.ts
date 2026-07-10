/**
 * OS-LIFEBOARD — Acesso validado a variáveis de ambiente.
 *
 * Coding standard (architecture.md §11): segredo/config só via `@/config/env`,
 * NUNCA `process.env` cru espalhado pelo código.
 *
 * `LIFEBOARD_DATA_MODE` troca fixture (dev/test) por live (produção, Supabase real).
 *
 * A URL do Supabase e a chave anon/publishable são lidas de `NEXT_PUBLIC_*`
 * (necessárias no browser para o login Google) com fallback para as versões
 * server-only. A chave anon/publishable é PÚBLICA por design (Supabase) — pode ir
 * ao client. Já `LIFEBOARD_LOAD_SECRET` (destrava a RPC de leitura) é server-only.
 *
 * Proteção do dashboard: login Google (Supabase Auth) + allowlist de emails
 * (`LIFEBOARD_ALLOWED_EMAILS`). Só emails da lista entram (middleware).
 */

import type { DataMode } from "@/adapters/types";

function readDataMode(): DataMode {
  return process.env.LIFEBOARD_DATA_MODE === "live" ? "live" : "fixture";
}

function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) if (v !== undefined && v !== "") return v;
  return "";
}

function requireLive(name: string, value: string): string {
  if (readDataMode() === "live" && value === "") {
    throw new Error(
      `[lifeboard/env] ${name} é obrigatória em LIFEBOARD_DATA_MODE=live mas está ` +
        `ausente. Configure-a (Vercel env / .env) antes de subir em modo live.`,
    );
  }
  return value;
}

/** Allowlist default: os dois emails de Lucas (pandora + gmail). */
const DEFAULT_ALLOWED_EMAILS =
  "lucas.scudeler@pandoratreinamentos.com.br,lucasscudeler@gmail.com";

export interface LifeboardEnv {
  readonly LIFEBOARD_DATA_MODE: DataMode;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly LIFEBOARD_LOAD_SECRET: string;
  /** Emails autorizados a logar (lowercase, sem espaços). */
  readonly ALLOWED_EMAILS: string[];
}

export const env: LifeboardEnv = {
  get LIFEBOARD_DATA_MODE(): DataMode {
    return readDataMode();
  },
  get SUPABASE_URL(): string {
    return requireLive(
      "NEXT_PUBLIC_SUPABASE_URL",
      firstNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL),
    );
  },
  get SUPABASE_ANON_KEY(): string {
    return requireLive(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      firstNonEmpty(
        process.env.SUPABASE_ANON_KEY,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    );
  },
  get LIFEBOARD_LOAD_SECRET(): string {
    return requireLive(
      "LIFEBOARD_LOAD_SECRET",
      process.env.LIFEBOARD_LOAD_SECRET ?? "",
    );
  },
  get ALLOWED_EMAILS(): string[] {
    return firstNonEmpty(process.env.LIFEBOARD_ALLOWED_EMAILS, DEFAULT_ALLOWED_EMAILS)
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
};
