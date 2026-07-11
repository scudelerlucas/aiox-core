/**
 * OS-LIFEBOARD · E3 — Normalização da entrada semi-manual → modelo canônico.
 *
 * Pega a saída ESTRUTURAL do parser (`parser.ts`, zero token) + o texto residual
 * (linhas de texto livre não classificadas) e produz `{ projects, tasks }` no
 * modelo canônico (`@/types/canonical`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GUARDA INVIOLÁVEL (PRD §10 / §11 stress-3):
 *   "se a normalização perde fidelidade (tarefa some ou vira errada), reverte
 *    para parsing bruto sem LLM. Token-saving sem quality-gate é proibido."
 *
 *   Implementação: computamos DUAS versões do conjunto de tarefas —
 *     • BRUTO      = estrutural + (1 tarefa por linha residual)  ← piso de fidelidade
 *     • ENRIQUECIDO = estrutural + heurística/LLM sobre o resíduo ← economiza token
 *   Se o ENRIQUECIDO tiver MENOS tarefas que o BRUTO, DESCARTAMOS o enriquecido e
 *   devolvemos o BRUTO. Assim nenhuma tarefa que o parsing bruto capturaria é
 *   jamais perdida (diff = 0).
 *
 * APPEND-ONLY (PRD §8-E3 / architecture.md §5.1):
 *   `mergeAppendOnly` NUNCA sobrescreve tarefas já existentes — inclusive as que
 *   vieram de OUTRAS fontes (Calendar/Gmail/Drive). Só ADICIONA o que é novo.
 *   A escrita real (upsert) é responsabilidade do repository (`lib/repositories/
 *   tasks.ts`, ainda inexistente nesta rodada); aqui garantimos a semântica.
 *
 * Camada R do CHC: server-side, puro/testável.
 */

import {
  DEFAULT_HIERARQ,
  type Project,
  type SourceKind,
  type Task,
} from "@/types/canonical";
import {
  extractDueDate,
  parseStructural,
  type ParsedTask,
  type ResidualLine,
  type StructuralParseResult,
} from "@/adapters/manual/parser";

export type ManualSourceKind = Extract<SourceKind, "notes" | "claude_chat">;

export interface NormalizeManualOptions {
  /** Fonte a que estas tarefas pertencem (idempotência do upsert). */
  sourceId?: string;
  /** notes (Notas iPhone) ou claude_chat (export de chat). Default: notes. */
  sourceKind?: ManualSourceKind;
  /** Se false, pula a heurística e usa direto o bruto. Default: true. */
  useLLM?: boolean;
  /** ISO para updatedAt determinístico (testes). Default: agora. */
  now?: string;
  /** Data de referência p/ datas dd/mm sem ano. Default: agora. */
  referenceDate?: Date;
}

export type NormalizeStrategy = "enriched" | "brute-fallback" | "brute-only";

export interface NormalizeManualResult {
  projects: Project[];
  tasks: Task[];
  /** Qual caminho de resíduo venceu (auditoria da guarda). */
  strategy: NormalizeStrategy;
  /** Quantas tarefas a guarda "resgatou" ao cair pro bruto (0 se enriquecido venceu). */
  rescuedByGuard: number;
}

// ---------------------------------------------------------------------------
// Helpers determinísticos (sem I/O, sem aleatoriedade → append-only idempotente)
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** djb2 → hex; base para ids/refs estáveis (mesma entrada ⇒ mesmo id). */
function hashHex(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  // Expande p/ 32 hex chars misturando o hash com o índice do chunk.
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < 8; i++) {
    x = (x * 1103515245 + 12345 + i) >>> 0;
    out += x.toString(16).padStart(8, "0");
  }
  return out.slice(0, 32);
}

/** id determinístico em formato uuid-like a partir de uma seed estável. */
function stableId(seed: string): string {
  const h = hashHex(seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(
    17,
    20,
  )}-${h.slice(20, 32)}`;
}

/** Converte uma linha residual em tarefa candidata (extrai data; status open). */
function residualLineToTask(line: ResidualLine, referenceDate: Date): ParsedTask {
  const { title, dueDate } = extractDueDate(line.text, referenceDate);
  return {
    title,
    dueDate,
    status: "open",
    raw: line.text,
    blockIndex: line.blockIndex,
    lineIndex: line.lineIndex,
  };
}

// ---------------------------------------------------------------------------
// Heurística que SIMULA o LLM (interface pronta p/ plugar o modelo real)
// ---------------------------------------------------------------------------

/** Palavras/estruturas que sinalizam uma linha livre acionável (pt-BR). */
const ACTION_HINTS = [
  "ligar", "enviar", "mandar", "responder", "escrever", "revisar", "revisao",
  "comprar", "agendar", "marcar", "fazer", "preparar", "finalizar", "terminar",
  "criar", "definir", "validar", "testar", "publicar", "subir", "corrigir",
  "atualizar", "pagar", "contratar", "chamar", "montar", "organizar", "planejar",
  "confirmar", "avaliar", "decidir", "entregar", "preciso", "precisa", "devo",
  "tenho que", "falta", "pendente", "checar", "verificar", "revisar",
];

/**
 * Normaliza o texto RESIDUAL (linhas livres) em tarefas.
 *
 * ▶ EM PRODUÇÃO, é AQUI que entra a chamada real ao LLM (Claude), conforme
 *   PRD §10 (roteamento de tokens):
 *     - prompt caching do CONTEXTO FIXO (schema canônico + regras de normalização)
 *     - SAÍDA ESTRUTURADA por template JSON (array de {title,dueDate,status})
 *     - Batch API (não-tempo-real; roda no cron)
 *   Esboço da integração real:
 *     // const res = await claude.messages.create({
 *     //   system: [{ type: "text", text: CANONICAL_CONTEXT, cache_control: { type: "ephemeral" } }],
 *     //   messages: [{ role: "user", content: residualText }],
 *     //   tools: [MANUAL_TASK_JSON_SCHEMA],   // saída estruturada
 *     // });
 *     // return parseToolResultToParsedTasks(res);
 *
 * ▶ NESTA RODADA não há LLM determinístico/testável disponível, então usamos uma
 *   HEURÍSTICA determinística equivalente: mantém linhas acionáveis (verbo/ação
 *   ou data) e descarta ruído (comentário puro). Esse descarte é justamente o
 *   risco que a GUARDA INVIOLÁVEL de `normalizeManual` cobre — se a heurística
 *   perder qualquer tarefa vs. o bruto, o sistema cai pro bruto.
 *
 * INVARIANTE DE PROJETO: a saída é sempre um SUBCONJUNTO das linhas residuais
 * (mesmos títulos, quantidade ≤). Nunca inventa nem funde tarefas — o que
 * mantém `diff = 0 tarefas perdidas` garantido pela guarda por contagem.
 */
export function normalizeResidualWithLLM(
  residualText: string,
  structural: StructuralParseResult,
  options: { referenceDate?: Date } = {},
): ParsedTask[] {
  const referenceDate = options.referenceDate ?? new Date();
  // `residualText` é exatamente o payload que iria ao LLM em produção; aqui
  // percorremos as linhas estruturadas (com blockIndex/lineIndex) do parser.
  void residualText;

  return structural.residualLines
    .filter((line) => isActionable(line.text))
    .map((line) => residualLineToTask(line, referenceDate));
}

function isActionable(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  // Contém uma data dd/mm → provavelmente um prazo acionável.
  if (/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(text)) return true;
  return ACTION_HINTS.some((hint) => normalized.includes(hint));
}

// ---------------------------------------------------------------------------
// Construção canônica (blocos → projects; ParsedTask → Task)
// ---------------------------------------------------------------------------

function buildCanonical(
  structural: StructuralParseResult,
  residualTasks: ParsedTask[],
  opts: Required<Pick<NormalizeManualOptions, "sourceId" | "sourceKind">> & {
    now: string;
  },
): { projects: Project[]; tasks: Task[] } {
  const { sourceId, sourceKind, now } = opts;

  // Agrupa TODAS as tarefas (estruturais + residuais escolhidas) por bloco.
  const byBlock = new Map<number, ParsedTask[]>();
  for (const t of [...structural.tasks, ...residualTasks]) {
    const arr = byBlock.get(t.blockIndex) ?? [];
    arr.push(t);
    byBlock.set(t.blockIndex, arr);
  }

  const projects: Project[] = [];
  const tasks: Task[] = [];

  for (const block of structural.blocks) {
    const blockTasks = byBlock.get(block.index);
    if (!blockTasks || blockTasks.length === 0) continue; // sem tarefa ⇒ sem projeto

    const projectExternalRef = `${sourceKind}:proj:${slugify(block.title) || `bloco-${block.index}`}`;
    const projectId = stableId(`${sourceId}:${projectExternalRef}`);
    projects.push({
      id: projectId,
      sourceId,
      externalRef: projectExternalRef,
      title: block.title,
      status: "active",
      updatedAt: now,
    });

    for (const pt of blockTasks) {
      const taskExternalRef = `${sourceKind}:task:${block.index}:${pt.lineIndex}:${
        slugify(pt.title) || "item"
      }`;
      tasks.push({
        id: stableId(`${sourceId}:${taskExternalRef}`),
        projectId,
        title: pt.title,
        notes: null,
        dueDate: pt.dueDate,
        status: pt.status,
        priorityHierarq: { ...DEFAULT_HIERARQ }, // declarado depois (PRD §5.3)
        predecessorIds: [], // deps são DECLARADAS, nunca inferidas aqui
        successorIds: [],
        sourceId,
        externalRef: taskExternalRef,
        updatedAt: now,
      });
    }
  }

  return { projects, tasks };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Fluxo E3 completo: texto colado → `{ projects, tasks }` canônicos, sob a
 * guarda inviolável do PRD §10.
 */
export function normalizeManual(
  text: string,
  options: NormalizeManualOptions = {},
): NormalizeManualResult {
  const sourceKind: ManualSourceKind = options.sourceKind ?? "notes";
  const sourceId = options.sourceId ?? `manual:${sourceKind}`;
  const now = options.now ?? new Date().toISOString();
  const referenceDate = options.referenceDate ?? new Date();
  const useLLM = options.useLLM ?? true;

  const defaultBlockTitle =
    sourceKind === "claude_chat" ? "Chat Claude (sem título)" : "Notas (sem título)";
  const structural = parseStructural(text, { referenceDate, defaultBlockTitle });
  const residualText = structural.residualLines.map((r) => r.text).join("\n");

  // BRUTO: piso de fidelidade — toda linha residual vira tarefa.
  const bruteResidual = structural.residualLines.map((r) =>
    residualLineToTask(r, referenceDate),
  );
  const brute = buildCanonical(structural, bruteResidual, { sourceId, sourceKind, now });

  if (!useLLM) {
    return { ...brute, strategy: "brute-only", rescuedByGuard: 0 };
  }

  // ENRIQUECIDO: heurística/LLM sobre o resíduo (economiza token).
  const enrichedResidual = normalizeResidualWithLLM(residualText, structural, {
    referenceDate,
  });
  const enriched = buildCanonical(structural, enrichedResidual, {
    sourceId,
    sourceKind,
    now,
  });

  // ── GUARDA INVIOLÁVEL ──────────────────────────────────────────────────
  // Enriquecido perdeu tarefas vs. bruto? Descarta o enriquecido, usa o bruto.
  if (enriched.tasks.length < brute.tasks.length) {
    return {
      ...brute,
      strategy: "brute-fallback",
      rescuedByGuard: brute.tasks.length - enriched.tasks.length,
    };
  }

  return { ...enriched, strategy: "enriched", rescuedByGuard: 0 };
}

/**
 * Merge APPEND-ONLY para o modelo canônico.
 *
 * Regras:
 *   1. NUNCA remove nem sobrescreve uma tarefa já existente — inclusive as de
 *      OUTRAS fontes (Calendar/Gmail/Drive). Existentes sempre vencem na chave
 *      lógica (sourceId, externalRef), preservando deps/priorityHierarq DECLARADAS.
 *   2. Só ADICIONA tarefas novas (chave inédita).
 *
 * A escrita real (upsert idempotente) é do repository (`lib/repositories/tasks.ts`,
 * inexistente nesta rodada). Esta função é a garantia pura de que a normalização
 * de E3 não apaga nada — só acrescenta.
 */
export function mergeAppendOnly(existing: Task[], incoming: Task[]): Task[] {
  const key = (t: Task): string => `${t.sourceId}|${t.externalRef}`;
  const seen = new Set(existing.map(key));
  // Existentes intocados (cópia rasa preserva a ordem/identidade original).
  const result: Task[] = [...existing];
  for (const t of incoming) {
    if (!seen.has(key(t))) {
      result.push(t);
      seen.add(key(t));
    }
    // else: chave já existe ⇒ NÃO sobrescreve (append-only).
  }
  return result;
}
