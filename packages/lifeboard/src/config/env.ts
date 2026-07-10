/**
 * OS-LIFEBOARD — Acesso validado a variáveis de ambiente.
 *
 * Coding standard (architecture.md §11): segredo/config só via `@/config/env`,
 * NUNCA `process.env` cru espalhado pelo código. `.env.example` sem valores reais
 * (camada G do CHC).
 *
 * `LIFEBOARD_DATA_MODE` é o flip que troca fixture (default, dev/test) por live
 * (produção, lê o Supabase real via RPC `lifeboard_load`). Ver `factory.ts`.
 *
 * As variáveis Supabase (URL, ANON_KEY, LOAD_SECRET) são server-only — NUNCA
 * prefixadas com `NEXT_PUBLIC_`, então nunca entram no bundle client (camada G).
 * O ACCESS_SECRET protege o dashboard publicado (Basic Auth no middleware).
 *
 * Extensão ADITIVA: novos campos são adicionados sem remover os existentes.
 */

import type { DataMode } from "@/adapters/types";

function readDataMode(): DataMode {
  return process.env.LIFEBOARD_DATA_MODE === "live" ? "live" : "fixture";
}

/** Lança erro claro quando uma var obrigatória do modo live está ausente. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `[lifeboard/env] Variável ${name} é obrigatória em LIFEBOARD_DATA_MODE=live ` +
        `mas está ausente. Configure-a (Vercel env / .env) antes de subir em modo live.`,
    );
  }
  return value;
}

export interface LifeboardEnv {
  /** 'fixture' (default, dev/test) | 'live' (produção, Supabase real). */
  readonly LIFEBOARD_DATA_MODE: DataMode;
  /** URL do projeto Supabase (ex: https://xxxx.supabase.co). Obrigatória em live. */
  readonly SUPABASE_URL: string;
  /** Chave anon/publishable (server-only aqui). Obrigatória em live. */
  readonly SUPABASE_ANON_KEY: string;
  /** Segredo que destrava a RPC `lifeboard_load`. Server-only. Obrigatória em live. */
  readonly LIFEBOARD_LOAD_SECRET: string;
  /** Senha do Basic Auth do dashboard publicado. '' = gate desativado (dev). */
  readonly LIFEBOARD_ACCESS_SECRET: string;
}

/** Config validada. Reavaliada por getter para respeitar overrides em teste. */
export const env: LifeboardEnv = {
  get LIFEBOARD_DATA_MODE(): DataMode {
    return readDataMode();
  },
  get SUPABASE_URL(): string {
    return readDataMode() === "live"
      ? requireEnv("SUPABASE_URL")
      : (process.env.SUPABASE_URL ?? "");
  },
  get SUPABASE_ANON_KEY(): string {
    return readDataMode() === "live"
      ? requireEnv("SUPABASE_ANON_KEY")
      : (process.env.SUPABASE_ANON_KEY ?? "");
  },
  get LIFEBOARD_LOAD_SECRET(): string {
    return readDataMode() === "live"
      ? requireEnv("LIFEBOARD_LOAD_SECRET")
      : (process.env.LIFEBOARD_LOAD_SECRET ?? "");
  },
  get LIFEBOARD_ACCESS_SECRET(): string {
    return process.env.LIFEBOARD_ACCESS_SECRET ?? "";
  },
};
