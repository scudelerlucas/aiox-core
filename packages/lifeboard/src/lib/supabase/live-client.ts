/**
 * OS-LIFEBOARD — Cliente de leitura LIVE do Supabase (camada G, server-only).
 *
 * `import 'server-only'` no topo: este módulo carrega credenciais e o segredo da
 * RPC; se algum Client Component tentar importá-lo, o build QUEBRA (kill-switch
 * nº 3 do PRD — `_core-inalienavel`/credenciais nunca no bundle client).
 *
 * Estratégia de leitura (architecture.md — camada de leitura live): em vez de o
 * app carregar a service_role key (que não sai do painel Supabase) ou afrouxar a
 * RLS, lê tudo por UMA função Postgres `SECURITY DEFINER` protegida por segredo:
 *   POST {SUPABASE_URL}/rest/v1/rpc/lifeboard_load  body { p_secret }
 * A função só devolve as linhas do dono (Lucas) e só se o segredo bater. Mesmo
 * padrão já usado no ecossistema (`offerforge_load`). Segredo e chave vivem só em
 * env server-side / Vercel — nunca no git.
 *
 * `cache()` do React memoiza por request: /api/today, /api/sources e a page.tsx
 * compartilham 1 única chamada à RPC por render.
 */

import "server-only";

import { cache } from "react";

import { env } from "@/config/env";
import type {
  Project,
  Source,
  SyncLog,
  Task,
} from "@/types/canonical";

/** Forma exata do JSON retornado pela RPC `lifeboard_load` (já camelCase). */
export interface LifeboardState {
  sources: Source[];
  syncLogs: SyncLog[];
  projects: Project[];
  tasks: Task[];
}

/** Normaliza arrays possivelmente nulos vindos do JSON. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Garante que predecessor/successor nulos virem [] (defesa; motor espera array). */
function normalizeTask(raw: Task): Task {
  return {
    ...raw,
    predecessorIds: asArray<string>(raw.predecessorIds),
    successorIds: asArray<string>(raw.successorIds),
  };
}

/**
 * Busca o estado completo do lifeboard da RPC secret-gated. Memoizado por request.
 * Lança erro descritivo em falha de rede/HTTP (o handler decide como degradar).
 */
export const loadLifeboardState = cache(async (): Promise<LifeboardState> => {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/lifeboard_load`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_secret: env.LIFEBOARD_LOAD_SECRET }),
      // Sem cache de fetch: o dashboard serve o estado do dia via revalidação própria.
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `[lifeboard/live] Falha de rede ao chamar lifeboard_load: ${
        error instanceof Error ? error.message : "desconhecido"
      }`,
    );
  }

  // `fetch` não lança em 4xx/5xx (gotcha do projeto): cheque `ok` antes do .json().
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `[lifeboard/live] lifeboard_load respondeu ${response.status}: ${detail.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as Partial<LifeboardState> | null;
  return {
    sources: asArray<Source>(payload?.sources),
    syncLogs: asArray<SyncLog>(payload?.syncLogs),
    projects: asArray<Project>(payload?.projects),
    tasks: asArray<Task>(payload?.tasks).map(normalizeTask),
  };
});
