import "server-only";
/**
 * OS-LIFEBOARD · P5 — Linha do tempo (Gantt). PURA — sem rede, sem `Date.now()`
 * escondido (`hoje` entra por parâmetro), nunca lança.
 *
 * Contrato: `@/types/linha-do-tempo` (`LinhaDoTempoProps`). Duas fontes de dado,
 * dois grupos:
 *   • "Assuntos" — `Pr[]` de `painel_frentes_prs` (`criado_em → mergeado_em`,
 *     ou hoje se ainda aberto). Fonte dos dados: `docs/ops/LIFEBOARD-V3-4z-…md` §7.
 *   • "Tarefas" — `Task[]`, com a janela do CPM (`ResultadoCPM`, `core/prioritize/
 *     caminho-critico.ts`) quando a tarefa é ancestral do goal; fora dele, a barra
 *     nasce de `iniciadoEm` (ou hoje) + `estimativaDias` (ou o placeholder),
 *     marcada `semDuracao`/`foraDoCpm`.
 *
 * Precedência de uma tarefa (predecessores/sucessores mostrados na tela) é a
 * MESMA união de 3 fontes do CPM (`predecessorIds` ∪ `successorIds` invertido ∪
 * `task_edges` tipo=predecessor) — nunca uma segunda definição de "o que precede
 * o quê" divergindo da que desenha o caminho crítico.
 *
 * Nunca lança: tasks/edges/prs vazios → grupos vazios; predecessor que aponta
 * para um id fora de `tasks` é ignorado (mesma convenção de `caminho-critico.ts`
 * — "órfão = resolvido"); goal ausente no CPM → todo mundo fica `foraDoCpm`.
 */

import type { ResultadoCPM } from "@/core/prioritize/tipos-v3";
import type { Pr } from "@/lib/frentes/types";
import { limparTitulo } from "@/lib/frentes/compose";
import type { Source, SourceKind, Task, TaskEdge } from "@/types/canonical";
import type {
  LinhaDoTempoAssuntoRow,
  LinhaDoTempoGrupo,
  LinhaDoTempoProps,
  LinhaDoTempoRow,
  LinhaDoTempoTarefaRow,
} from "@/types/linha-do-tempo";

const MS_POR_DIA = 86_400_000;
/** Mesma régua de `DURACAO_PLACEHOLDER` (tipos-v3), para a tarefa FORA do CPM
 * que também não tem `estimativaDias` — nunca uma barra de comprimento zero. */
const DURACAO_PLACEHOLDER_FORA_CPM = 1;

/** `Date.parse` de uma ISO qualquer; `NaN` (data podre) cai no fallback do chamador. */
function paraEpoch(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Corta para `AAAA-MM-DD` — nunca lança mesmo com string fora do formato ISO. */
function paraDataCurta(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

/** `iso` + `dias` dias corridos, devolvido como `AAAA-MM-DD`. */
function somaDias(iso: string, dias: number): string {
  const base = paraEpoch(iso) ?? Date.now();
  const dataFinal = new Date(base + dias * MS_POR_DIA);
  return dataFinal.toISOString().slice(0, 10);
}

/**
 * Precedência = `predecessorIds` ∪ `successorIds` (invertido) ∪ `task_edges`
 * tipo=predecessor — EXATAMENTE a mesma união que `caminhoCritico` usa para
 * montar o grafo (`tipos-v3.ts`, "Regras do CPM"). Órfão (aponta para fora de
 * `tasks`) é descartado em silêncio, nunca lança.
 */
function precedenciaDeclarada(
  tasks: readonly Task[],
  edges: readonly TaskEdge[],
): { predecessores: Map<string, Set<string>>; sucessores: Map<string, Set<string>> } {
  const idsValidos = new Set(tasks.map((t) => t.id));
  const predecessores = new Map<string, Set<string>>();
  const sucessores = new Map<string, Set<string>>();
  for (const id of idsValidos) {
    predecessores.set(id, new Set());
    sucessores.set(id, new Set());
  }
  const liga = (origem: string, destino: string): void => {
    if (!idsValidos.has(origem) || !idsValidos.has(destino) || origem === destino) return;
    sucessores.get(origem)?.add(destino);
    predecessores.get(destino)?.add(origem);
  };
  for (const t of tasks) {
    for (const p of t.predecessorIds) liga(p, t.id);
    for (const s of t.successorIds) liga(t.id, s);
  }
  for (const e of edges) {
    if (e.tipo === "predecessor") liga(e.origem, e.destino);
  }
  return { predecessores, sucessores };
}

/** Título de assunto: reusa `limparTitulo` (mesmo tratamento da tela `/frentes`); nunca vazio. */
function tituloDoAssunto(pr: Pr): string {
  const limpo = limparTitulo(pr.titulo);
  return limpo.length > 0 ? limpo : pr.titulo || `${pr.repo}#${pr.numero}`;
}

function montaAssunto(pr: Pr, hoje: string): LinhaDoTempoAssuntoRow {
  const inicioIso = pr.criado_em ?? pr.atualizado_em;
  const aberto = pr.estado === "aberto";
  const fimIso = pr.mergeado_em ?? (aberto ? hoje : pr.fechado_em ?? pr.atualizado_em);
  return {
    kind: "assunto",
    id: `${pr.repo}#${pr.numero}`,
    titulo: tituloDoAssunto(pr),
    repo: pr.repo,
    inicio: paraDataCurta(inicioIso),
    fim: paraDataCurta(fimIso),
    aberto,
    estado: pr.estado,
    url: pr.url,
  };
}

/** [id da tarefa] → `SourceKind`, mesma convenção de `dashboard-client.tsx`. */
function mapaFontePorTask(tasks: readonly Task[], sources: readonly Source[]): Map<string, SourceKind> {
  const kindPorSourceId = new Map(sources.map((s) => [s.id, s.kind] as const));
  const mapa = new Map<string, SourceKind>();
  for (const t of tasks) mapa.set(t.id, kindPorSourceId.get(t.sourceId) ?? "notes");
  return mapa;
}

function estimativaValida(t: Task): number | null {
  return typeof t.estimativaDias === "number" && Number.isFinite(t.estimativaDias) && t.estimativaDias > 0
    ? t.estimativaDias
    : null;
}

/** Chave de ordenação interna: `es` do CPM (ou `+Infinity` fora dele). */
interface TarefaOrdenavel {
  row: LinhaDoTempoTarefaRow;
  es: number;
}

function montaTarefa(
  t: Task,
  cpm: ResultadoCPM,
  fontePorTask: ReadonlyMap<string, SourceKind>,
  predecessores: ReadonlyMap<string, Set<string>>,
  sucessores: ReadonlyMap<string, Set<string>>,
  scores: ReadonlyMap<string, number | null | undefined> | undefined,
  hoje: string,
): TarefaOrdenavel {
  const preds = [...(predecessores.get(t.id) ?? [])].sort();
  const sucs = [...(sucessores.get(t.id) ?? [])].sort();
  const scoreValor = scores?.get(t.id);
  const janela = cpm.janelas.get(t.id);
  const fonteKind = fontePorTask.get(t.id) ?? "notes";

  if (janela) {
    const row: LinhaDoTempoTarefaRow = {
      kind: "tarefa",
      id: t.id,
      titulo: t.title,
      inicio: somaDias(hoje, janela.es),
      fim: somaDias(hoje, janela.ef),
      fimComFolga: somaDias(hoje, janela.lf),
      critico: cpm.critico.has(t.id),
      folga: janela.folga,
      semDuracao: cpm.semDuracao.includes(t.id),
      predecessores: preds,
      sucessores: sucs,
      ...(typeof scoreValor === "number" ? { score: scoreValor } : {}),
      fonteKind,
      status: t.status,
      foraDoCpm: false,
    };
    return { row, es: janela.es };
  }

  const duracao = estimativaValida(t) ?? DURACAO_PLACEHOLDER_FORA_CPM;
  const inicio = t.iniciadoEm ? paraDataCurta(t.iniciadoEm) : hoje;
  const fim = somaDias(inicio, duracao);
  const row: LinhaDoTempoTarefaRow = {
    kind: "tarefa",
    id: t.id,
    titulo: t.title,
    inicio,
    fim,
    fimComFolga: fim,
    critico: false,
    folga: 0,
    semDuracao: estimativaValida(t) === null,
    predecessores: preds,
    sucessores: sucs,
    ...(typeof scoreValor === "number" ? { score: scoreValor } : {}),
    fonteKind,
    status: t.status,
    foraDoCpm: true,
  };
  // Fora do CPM ordena depois de tudo que tem ES real — nunca finge um ES.
  return { row, es: Number.POSITIVE_INFINITY };
}

export function montarLinhaDoTempo(
  tasks: readonly Task[],
  edges: readonly TaskEdge[],
  prs: readonly Pr[],
  sources: readonly Source[],
  cpm: ResultadoCPM,
  hoje: string,
  scores?: ReadonlyMap<string, number | null | undefined>,
): LinhaDoTempoProps {
  const linhasAssuntos: LinhaDoTempoRow[] = prs.map((pr) => montaAssunto(pr, hoje));

  const { predecessores, sucessores } = precedenciaDeclarada(tasks, edges);
  const fontePorTask = mapaFontePorTask(tasks, sources);

  const tarefasOrdenaveis = tasks.map((t) =>
    montaTarefa(t, cpm, fontePorTask, predecessores, sucessores, scores, hoje),
  );
  tarefasOrdenaveis.sort((a, b) => {
    if (a.es !== b.es) return a.es - b.es;
    if (a.row.critico !== b.row.critico) return a.row.critico ? -1 : 1;
    return a.row.id.localeCompare(b.row.id);
  });

  const grupos: LinhaDoTempoGrupo[] = [
    { titulo: "Assuntos", linhas: linhasAssuntos },
    { titulo: "Tarefas", linhas: tarefasOrdenaveis.map((t) => t.row) },
  ];

  return {
    hoje: paraDataCurta(hoje),
    grupos,
    goalId: cpm.goalId,
    duracaoTotal: cpm.duracaoTotal,
  };
}
