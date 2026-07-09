"use client";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { RankBadge } from "@/components/ui/rank-badge";
import { SourceIcon } from "@/components/ui/source-icon";
import { StatusChip } from "@/components/ui/status-chip";
import type { Source, Task } from "@/types/canonical";

/** Uma linha da lista "hoje" — espelha item de GET /api/today
 *  (retorno de buildTodayList: { task, reason }). Cliente NÃO importa o
 *  TodayItem de core/prioritize/today.ts (server-only); replicamos a forma. */
export interface TodayListItem {
  task: Task;
  /** Justificativa verbatim do motor HIERARQ (ex.: "desempate por s1"). */
  reason: string;
}

export interface TodayListProps {
  items: TodayListItem[];
  /** IDs excluídos por ciclo (GET /api/today → excludedCycles) — nota degradada. */
  excludedCycleIds?: string[];
  isLoading?: boolean;
  error?: Error | null;
  /** Seleção compartilhada com o grafo. */
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
  /** Fontes para rotular o ícone por item (opcional; não altera o contrato base). */
  sources?: Source[];
}

function scoreOf(task: Task): number {
  const { s1, s2, s3 } = task.priorityHierarq;
  return s1 * s2 * s3;
}

function formatDue(iso: string, now: number): { label: string; overdue: boolean } {
  const t = Date.parse(iso);
  const d = new Date(t);
  const label = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { label, overdue: t < now };
}

export function TodayList({
  items,
  excludedCycleIds = [],
  isLoading = false,
  error = null,
  selectedTaskId = null,
  onSelectTask,
  sources = [],
}: TodayListProps): JSX.Element {
  const sourceById = new Map(sources.map((s) => [s.id, s] as const));
  const now = Date.now();

  return (
    <section
      aria-label="Tarefas priorizadas para hoje"
      className="flex h-full flex-col"
    >
      <h2 className="flex items-baseline gap-2 px-4 pb-2 pt-4 text-xl font-semibold text-bone-100">
        Hoje
        {!isLoading && !error ? (
          <span className="font-mono text-xs font-normal text-bone-400">
            {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
        ) : null}
      </h2>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {isLoading ? <LoadingSkeleton /> : null}

        {!isLoading && error ? (
          <div
            role="alert"
            className="mt-2 rounded-md border border-state-error/60 bg-navy-850 p-4 text-sm text-state-error-fg"
          >
            <p className="font-medium">Não consegui montar a lista de hoje.</p>
            <p className="mt-1 text-xs text-bone-400">{error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-md border border-gold-500 px-3 py-1 text-xs font-medium text-gold-300 hover:bg-navy-700"
            >
              Tentar de novo
            </button>
          </div>
        ) : null}

        {!isLoading && !error && items.length === 0 ? (
          <EmptyState blockedCount={excludedCycleIds.length} />
        ) : null}

        {!isLoading && !error && items.length > 0 ? (
          <ol className="space-y-2">
            {items.map((item, i) => {
              const { task, reason } = item;
              const isSel = selectedTaskId === task.id;
              const src = sourceById.get(task.sourceId);
              const due = task.dueDate ? formatDue(task.dueDate, now) : null;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(task.id)}
                    aria-posinset={i + 1}
                    aria-setsize={items.length}
                    aria-pressed={isSel}
                    className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors duration-150 ${
                      isSel
                        ? "border-l-[3px] border-l-gold-500 border-navy-600 bg-navy-700"
                        : "border-navy-700 bg-navy-850 hover:bg-navy-800"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <RankBadge rank={i} />
                      <span className="flex-1 text-lg font-medium leading-tight text-bone-100">
                        {task.title}
                      </span>
                      {src ? (
                        <SourceIcon kind={src.kind} label={src.label} size={16} />
                      ) : null}
                    </div>
                    <p className="mt-1 pl-8 text-xs text-bone-400">
                      <span className="font-mono text-bone-300">S {scoreOf(task)}</span>
                      {" · "}
                      {reason}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 pl-8">
                      <StatusChip status={task.status} />
                      {due ? (
                        <span
                          className={`font-mono text-xs ${due.overdue ? "text-state-warning" : "text-bone-300"}`}
                        >
                          vence: {due.label}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}

        {excludedCycleIds.length > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-state-error-fg">
            <AlertTriangle size={13} aria-hidden="true" />
            {excludedCycleIds.length} tarefa(s) fora da fila por ciclo de dependência.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function LoadingSkeleton(): JSX.Element {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="lb-shimmer h-[76px] rounded-md" />
      ))}
    </div>
  );
}

function EmptyState({ blockedCount }: { blockedCount: number }): JSX.Element {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 px-4 text-center">
      <CheckCircle2 size={32} className="text-state-success" aria-hidden="true" />
      <p className="text-base font-medium text-bone-100">Nada acionável para hoje.</p>
      <p className="max-w-xs text-sm text-bone-400">
        Ou tudo que existe está aguardando um predecessor, ou você já venceu a
        fila. Respire. 🌿
      </p>
      {blockedCount > 0 ? (
        <p className="text-xs text-state-error-fg">
          {blockedCount} tarefa(s) fora da fila por ciclo — veja no grafo.
        </p>
      ) : null}
    </div>
  );
}
