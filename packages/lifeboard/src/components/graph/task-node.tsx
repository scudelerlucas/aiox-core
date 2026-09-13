"use client";
import { AlertTriangle, Lock, Target } from "lucide-react";
import { useContext } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { GraphSelectionContext } from "@/components/graph/selection-context";
import { SourceIcon } from "@/components/ui/source-icon";
import { corDaFonte } from "@/lib/cor-da-fonte";
import { StatusChip } from "@/components/ui/status-chip";
import type { JanelaCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { SourceKind, Task } from "@/types/canonical";

/** Estado DERIVADO do grafo (não persistido na Task). spec §8.1. */
export interface TaskNodeData {
  task: Task;
  /** Fonte da tarefa (para ícone/badge). */
  sourceKind: SourceKind;
  sourceLabel: string;
  /** Derivado (dag): ≥1 predecessor ainda não 'done' → não acionável. */
  blockedByPredecessor: boolean;
  /** Título do 1º predecessor aberto, para o badge "aguardando: …". */
  blockingPredecessorTitle?: string;
  /** Derivado (dag): participa de ciclo de dependência (erro). */
  inCycle: boolean;
  /** É o rank-0 da lista "hoje" (anel de ênfase gold). */
  isTopToday?: boolean;
  /** Esmaecido por filtro de fonte inativo (§5). */
  isFilteredOut?: boolean;
  // ── v3 (P4): janela do CPM + score de assimetria, calculados no servidor ──
  /** Janela de CPM desta tarefa (`GrafoV3Props.janelas[task.id]`). Ausente = fora do CPM. */
  janela?: JanelaCPM;
  /** Score de assimetria (`GrafoV3Props.scores[task.id]`). `null` = sem átomos declarados. */
  score?: ScoreAssimetria | null;
  /** `true` quando `task.id` está em `GrafoV3Props.critico` — anel vermelho. */
  isCritico?: boolean;
  /** `true` quando `task.id` está em `GrafoV3Props.semDuracao` — usa duração-placeholder. */
  semDuracao?: boolean;
}

/** Node customizado do React Flow. Puro de apresentação. spec §8.1. */
export type TaskNodeProps = NodeProps<TaskNodeData>;

/** Borda por status (spec §1.1). in_progress = 2px, blocked = 1.5px. */
const BORDA_ABERTA = "border border-state-neutral/70";
const FUNDO_ABERTA = "bg-navy-800";

const BORDER_BY_STATUS: Record<string, string> = {
  open: BORDA_ABERTA,
  in_progress: "border-2 border-gold-500",
  blocked: "border-[1.5px] border-state-error",
  done: "border border-state-success/70",
};

const FILL_BY_STATUS: Record<string, string> = {
  open: FUNDO_ABERTA,
  in_progress: FUNDO_ABERTA,
  blocked: FUNDO_ABERTA,
  done: "bg-navy-850",
};

/**
 * Estado desconhecido (valor novo no Postgres, fora da união `TaskStatus`) cai
 * na aparência de "aberta". Não derruba a rota — `.filter(Boolean)` engole o
 * `undefined` —, mas sem isto o nó perde borda e fundo e some no escuro do
 * grafo. Mesma família do conserto de `iconeDaFonte` e `configDoEstado`.
 *
 * Classe de borda do nó; nunca `undefined`, mesmo com estado novo no banco.
 */
export function bordaDoEstado(status: string): string {
  return BORDER_BY_STATUS[status] ?? BORDA_ABERTA;
}

/** Classe de fundo do nó; nunca `undefined`, mesmo com estado novo no banco. */
export function fundoDoEstado(status: string): string {
  return FILL_BY_STATUS[status] ?? FUNDO_ABERTA;
}

export function TaskNode({ data, selected }: TaskNodeProps): JSX.Element {
  const { task, sourceKind, sourceLabel } = data;
  const { selectedTaskId, onSelectTask } = useContext(GraphSelectionContext);
  const cor = corDaFonte(sourceKind);
  const { s1, s2, s3 } = task.priorityHierarq;
  const score = s1 * s2 * s3;

  const isSelected = selected || selectedTaskId === task.id;
  const isBlockedByPred = data.blockedByPredecessor;
  const isDone = task.status === "done";

  const borderClass = data.inCycle
    ? "border-[1.5px] border-state-error"
    : bordaDoEstado(task.status);

  const ariaLabel =
    `${task.title}, status ${task.status}, fonte ${sourceLabel}` +
    (isBlockedByPred && data.blockingPredecessorTitle
      ? `, bloqueada por ${data.blockingPredecessorTitle}`
      : "") +
    (data.inCycle ? ", em ciclo de dependência" : "");

  return (
    <div
      role="button"
      tabIndex={data.isFilteredOut ? -1 : 0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectTask(task.id);
        }
      }}
      className={[
        // `relative` + `overflow-hidden`: a faixa da fonte é absoluta dentro do nó.
        "relative w-[200px] overflow-hidden rounded-lg py-2 pl-3.5 pr-3 shadow-node transition-[opacity,box-shadow] duration-200 ease-almapetra",
        borderClass,
        fundoDoEstado(task.status),
        isBlockedByPred ? "border-dashed opacity-55" : "",
        data.isFilteredOut ? "pointer-events-none opacity-20" : "",
        data.isTopToday ? "shadow-focus ring-2 ring-gold-400" : "",
        isSelected && !data.isTopToday ? "ring-1 ring-gold-500" : "",
        // v3: anel vermelho do caminho crítico — soma ao anel de ênfase/seleção
        // via `outline` (propriedade CSS diferente de `ring`/box-shadow, então
        // os dois convivem sem um sobrescrever o outro).
        data.isCritico ? "outline outline-2 outline-offset-1 outline-state-error" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Faixa na cor da fonte — o mesmo código de cor da lista "Hoje", para
          que o olho ligue nó e cartão sem precisar ler o rótulo. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${cor.faixa}`}
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />

      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          {task.isGoal ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-state-error/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-state-error-fg"
              title="Meta do caminho crítico"
            >
              <Target size={10} aria-hidden="true" />
              META
            </span>
          ) : null}
          <span
            className={`truncate text-sm font-medium text-bone-100 ${isDone ? "text-bone-400 line-through" : ""}`}
          >
            {task.title}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {isBlockedByPred ? (
            <Lock size={13} className="text-state-error-fg" aria-hidden="true" />
          ) : null}
          {data.inCycle ? (
            <AlertTriangle
              size={13}
              className="text-state-error"
              aria-hidden="true"
            />
          ) : null}
          <SourceIcon
            kind={sourceKind}
            label={sourceLabel}
            size={14}
            className={cor.texto}
          />
        </span>
      </div>

      {task.notes ? (
        <p className="mt-0.5 line-clamp-1 text-xs text-bone-400">{task.notes}</p>
      ) : null}

      {isBlockedByPred && data.blockingPredecessorTitle ? (
        <p className="mt-1 text-xs text-bone-400">
          aguardando: {data.blockingPredecessorTitle}
        </p>
      ) : null}

      {data.semDuracao ? (
        <p className="mt-1 text-xs italic text-state-warning">estimativa faltando</p>
      ) : null}

      <div className="mt-2 flex items-center justify-between border-t border-navy-700 pt-1.5">
        <span className="flex items-center gap-1.5 font-mono text-xs text-bone-200">
          S {score}
          {data.janela ? (
            <span className="text-bone-400">· folga: {data.janela.folga} d</span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          {data.score ? (
            <span
              title={data.score.porque}
              className="inline-flex items-center rounded-full border border-fonte-notes/45 bg-fonte-notes/10 px-1.5 py-0.5 font-mono text-[10px] text-fonte-notes"
            >
              A {data.score.valor}
            </span>
          ) : null}
          <StatusChip status={task.status} />
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />
    </div>
  );
}
