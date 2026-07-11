"use client";
import { AlertTriangle, Lock } from "lucide-react";
import { useContext } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { GraphSelectionContext } from "@/components/graph/selection-context";
import { SourceIcon } from "@/components/ui/source-icon";
import { StatusChip } from "@/components/ui/status-chip";
import type { SourceKind, Task, TaskStatus } from "@/types/canonical";

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
}

/** Node customizado do React Flow. Puro de apresentação. spec §8.1. */
export type TaskNodeProps = NodeProps<TaskNodeData>;

/** Borda por status (spec §1.1). in_progress = 2px, blocked = 1.5px. */
const BORDER_BY_STATUS: Record<TaskStatus, string> = {
  open: "border border-state-neutral/70",
  in_progress: "border-2 border-gold-500",
  blocked: "border-[1.5px] border-state-error",
  done: "border border-state-success/70",
};

const FILL_BY_STATUS: Record<TaskStatus, string> = {
  open: "bg-navy-800",
  in_progress: "bg-navy-800",
  blocked: "bg-navy-800",
  done: "bg-navy-850",
};

export function TaskNode({ data, selected }: TaskNodeProps): JSX.Element {
  const { task, sourceKind, sourceLabel } = data;
  const { selectedTaskId, onSelectTask } = useContext(GraphSelectionContext);
  const { s1, s2, s3 } = task.priorityHierarq;
  const score = s1 * s2 * s3;

  const isSelected = selected || selectedTaskId === task.id;
  const isBlockedByPred = data.blockedByPredecessor;
  const isDone = task.status === "done";

  const borderClass = data.inCycle
    ? "border-[1.5px] border-state-error"
    : BORDER_BY_STATUS[task.status];

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
        "w-[200px] rounded-md px-3 py-2 shadow-node transition-[opacity,box-shadow] duration-200 ease-almapetra",
        borderClass,
        FILL_BY_STATUS[task.status],
        isBlockedByPred ? "border-dashed opacity-55" : "",
        data.isFilteredOut ? "pointer-events-none opacity-20" : "",
        data.isTopToday ? "shadow-focus ring-2 ring-gold-400" : "",
        isSelected && !data.isTopToday ? "ring-1 ring-gold-500" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />

      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-sm font-medium text-bone-100 ${isDone ? "text-bone-400 line-through" : ""}`}
        >
          {task.title}
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
          <SourceIcon kind={sourceKind} label={sourceLabel} size={14} />
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

      <div className="mt-2 flex items-center justify-between border-t border-navy-700 pt-1.5">
        <span className="font-mono text-xs text-bone-200">S {score}</span>
        <StatusChip status={task.status} />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />
    </div>
  );
}
