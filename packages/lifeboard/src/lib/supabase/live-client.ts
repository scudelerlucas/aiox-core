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
import type { FilaPromptsState } from "@/core/prompts/tipos";
import {
  normalizeAssimetria,
  normalizeEdge,
  normalizeHierarq,
  numeroOuNulo,
} from "@/lib/supabase/normalize-task";
import type { Project, Source, SyncLog, Task, TaskEdge, TaskNote } from "@/types/canonical";

/** Forma exata do JSON retornado pela RPC `lifeboard_load` (já camelCase). */
export interface LifeboardState {
  sources: Source[];
  syncLogs: SyncLog[];
  projects: Project[];
  tasks: Task[];
  /** v3 — arestas declaradas (RPC devolve `[]` em banco sem a migration 0004). */
  edges: TaskEdge[];
  /** v3 — notas em lista. */
  notes: TaskNote[];
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
    priorityHierarq: normalizeHierarq(raw.priorityHierarq),
    estimativaDias: numeroOuNulo(raw.estimativaDias),
    iniciadoEm: typeof raw.iniciadoEm === "string" ? raw.iniciadoEm : null,
    parentId: typeof raw.parentId === "string" ? raw.parentId : null,
    isGoal: raw.isGoal === true,
    assimetria: normalizeAssimetria(raw.assimetria),
  };
}

/** Descarta arestas de tipo desconhecido em vez de deixar o grafo cair. */
function normalizeEdges(raw: unknown[]): TaskEdge[] {
  const out: TaskEdge[] = [];
  let descartadas = 0;
  for (const r of raw) {
    const e = normalizeEdge(r);
    if (e) out.push(e);
    else descartadas++;
  }
  if (descartadas > 0) {
    console.warn(`[lifeboard/live] ${descartadas} aresta(s) com tipo desconhecido foram ignoradas`);
  }
  return out;
}

function normalizeNote(raw: unknown): TaskNote | null {
  if (typeof raw !== "object" || raw === null) return null;
  const n = raw as Partial<TaskNote>;
  if (typeof n.id !== "string" || typeof n.taskId !== "string" || typeof n.texto !== "string")
    return null;
  return {
    id: n.id,
    taskId: n.taskId,
    texto: n.texto,
    autor: typeof n.autor === "string" ? n.autor : null,
    createdAt: typeof n.createdAt === "string" ? n.createdAt : "",
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
    edges: normalizeEdges(asArray<unknown>(payload?.edges)),
    notes: asArray<unknown>(payload?.notes)
      .map(normalizeNote)
      .filter((n): n is TaskNote => n !== null),
  };
});

// ── P6 (13/09/2026) — escrita: RPC secret-gated `lifeboard_mutate` ──────────
//
// Mesmo segredo, mesmo padrão de chamada da leitura — a diferença é que aqui
// `p_op` escolhe a operação e `p_payload` carrega os campos dela (contrato
// exato em `supabase/migrations/0008_lifeboard_v3_escrita_ajustes.sql`, que
// substitui a RPC de `0006`). Nunca lança: falha de rede, HTTP não-2xx ou
// corpo sem `ok: true` viram `{ erro }`; quem chama
// (`src/app/tarefa/actions.ts`) decide o que mostrar.
//
// v2 (achado ALTO #2, pós-reprovação do crítico 13/09/2026): a RPC agora
// SEMPRE valida em português, mas nem todo erro Postgres passa por essa
// validação (uma falha de infra, um bug num CHECK que ninguém previu) — por
// isso o corpo cru NUNCA vai direto para a tela. `message` só chega ao
// operador quando o `code` (SQLSTATE que o PostgREST devolve) é um dos que a
// RPC deste app efetivamente usa para erro de validação: `23514`
// (check_violation) ou `42501` (insufficient_privilege — segredo errado).
// `F0000` (config_file_error — segredo não cadastrado em
// `private.lifeboard_config`) ganha uma frase própria, porque "tente de
// novo" seria mentira: só reconfigurar resolve. Qualquer outro código vira a
// frase genérica — e o corpo INTEIRO (não só a frase) vai para
// `console.error` deste processo (o log do servidor Next/Vercel), nunca para
// o cliente.
export type MutateLifeboardResult = { ok: true; id?: string } | { erro: string };

/** Códigos cujo `message` da RPC é seguro mostrar ao operador — validação de
 * forma feita pela própria `lifeboard_mutate`, já traduzida e sem eco de valor. */
const CODIGOS_MENSAGEM_SEGURA: ReadonlySet<string> = new Set(["23514", "42501"]);
/** `config_file_error` (segredo ausente em `private.lifeboard_config`) — mensagem fixa e acionável. */
const CODIGO_PAINEL_NAO_CONFIGURADO = "F0000";
const MENSAGEM_GENERICA = "Não foi possível salvar. Tente de novo em instantes.";

export async function mutateLifeboard(
  op: string,
  payload: Record<string, unknown>,
): Promise<MutateLifeboardResult> {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/lifeboard_mutate`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_secret: env.LIFEBOARD_LOAD_SECRET, p_op: op, p_payload: payload }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: `Não consegui falar com o banco agora: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }.`,
    };
  }

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; id?: string; message?: string; code?: string }
    | null;

  if (!response.ok) {
    // Sempre logado por inteiro server-side — é o único lugar em que o
    // detalhe cru (inclusive de um código que a UI nunca traduz) sobrevive.
    console.error(`[lifeboard/live] lifeboard_mutate (${op}) falhou:`, response.status, body);
    if (body?.code === CODIGO_PAINEL_NAO_CONFIGURADO) {
      return { erro: "O painel não está configurado — avise o Lucas." };
    }
    if (body?.code && CODIGOS_MENSAGEM_SEGURA.has(body.code) && body.message) {
      return { erro: body.message };
    }
    return { erro: MENSAGEM_GENERICA };
  }
  if (!body || body.ok !== true) {
    return { erro: "A operação não confirmou sucesso — tente de novo." };
  }
  return { ok: true, id: body.id };
}

// ── P7 (13/09/2026) — fila de prompts entre as 3 contas (mapa !4z R1/R2/R6) ──
//
// Mesmo padrão secret-gated de `loadLifeboardState`/`mutateLifeboard`, contra
// as RPCs de `supabase/migrations/0007_lifeboard_v3_fila_prompts.sql` +
// `0009_lifeboard_v3_fila_ajustes.sql`. A leitura é `cache()`-memoizada por
// request (mesma razão de `loadLifeboardState`: a página e qualquer
// revalidação dentro do mesmo render batem 1 vez só).
//
// Achado MÉDIO #10 do crítico hostil (rodada de correção, 13/09/2026): antes,
// qualquer erro Postgres — inclusive "violates foreign key constraint…" cru
// — virava `error.message` direto na tela (via `enfileirarPrompt`/
// `cancelarPromptFila`, que só faziam `error instanceof Error ? error.message
// : …`). `RpcError` carrega o `code` (SQLSTATE) junto da mensagem; só quando
// o code é `23514` (check_violation — nossas PRÓPRIAS mensagens em
// português, do trigger ou da validação da RPC) o texto atravessa. Qualquer
// outro código vira a frase genérica (mesmas constantes de `mutateLifeboard`,
// reuso — não uma cópia nova).

class RpcError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code: string | undefined) {
    super(message);
    this.code = code;
  }
}

async function chamarRpc(nome: string, corpo: Record<string, unknown>): Promise<unknown> {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/${nome}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | { message?: unknown; code?: unknown }
    | null;
  if (!response.ok) {
    console.error(`[lifeboard/live] ${nome} falhou:`, response.status, body);
    const message =
      body && typeof body === "object" && "message" in body
        ? String(body.message)
        : `${nome} respondeu ${response.status}.`;
    const code = body && typeof body === "object" && typeof body.code === "string" ? body.code : undefined;
    throw new RpcError(message, code);
  }
  return body;
}

/** Traduz um `RpcError` para a mensagem que pode chegar à tela (achado MÉDIO #10). */
function traduzirErroFila(error: unknown): string {
  if (error instanceof RpcError) {
    if (error.code === CODIGO_PAINEL_NAO_CONFIGURADO) {
      return "O painel não está configurado — avise o Lucas.";
    }
    if (error.code && CODIGOS_MENSAGEM_SEGURA.has(error.code)) {
      return error.message;
    }
    return MENSAGEM_GENERICA;
  }
  return "Não consegui falar com o banco agora.";
}

function asFilaPromptsState(raw: unknown): FilaPromptsState {
  const payload = (raw ?? {}) as Partial<FilaPromptsState>;
  return {
    fila: asArray(payload.fila),
    consumo: asArray(payload.consumo),
  };
}

/** Lê a fila inteira + consumo/teto das 3 contas. Memoizado por request. */
export const loadFilaPromptsState = cache(async (): Promise<FilaPromptsState> => {
  try {
    const body = await chamarRpc("fila_prompts_listar", { p_secret: env.LIFEBOARD_LOAD_SECRET });
    return asFilaPromptsState(body);
  } catch (error) {
    throw new Error(
      `[lifeboard/live] Falha ao chamar fila_prompts_listar: ${
        error instanceof Error ? error.message : "desconhecido"
      }`,
    );
  }
});

export type MutateFilaResult =
  | { ok: true; id?: string; conta?: string; motivo?: string }
  | { erro: string };

/** `p_payload.conta` ausente = roteamento automático (menor consumo hoje). */
export async function enfileirarPrompt(payload: {
  prompt: string;
  complexidade: string;
  conta?: string | null;
  criado_por?: string | null;
  task_id?: string | null;
}): Promise<MutateFilaResult> {
  try {
    const body = (await chamarRpc("fila_prompts_enfileirar", {
      p_secret: env.LIFEBOARD_LOAD_SECRET,
      p_payload: payload,
    })) as { ok?: boolean; id?: string; conta?: string; modelo_sugerido?: string; motivo?: string };
    if (!body || body.ok !== true) {
      return { erro: "A operação não confirmou sucesso — tente de novo." };
    }
    return { ok: true, id: body.id, conta: body.conta, motivo: body.motivo };
  } catch (error) {
    return { erro: traduzirErroFila(error) };
  }
}

/** Só cancela item ainda `na_fila` — a RPC recusa qualquer outro estado. */
export async function cancelarPromptFila(id: string): Promise<MutateFilaResult> {
  try {
    const body = (await chamarRpc("fila_prompts_cancelar", {
      p_secret: env.LIFEBOARD_LOAD_SECRET,
      p_id: id,
    })) as { ok?: boolean };
    if (!body || body.ok !== true) {
      return { erro: "A operação não confirmou sucesso — tente de novo." };
    }
    return { ok: true };
  } catch (error) {
    return { erro: traduzirErroFila(error) };
  }
}
