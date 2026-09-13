"use client";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { RankBadge } from "@/components/ui/rank-badge";
import { SourceIcon } from "@/components/ui/source-icon";
import { StatusChip } from "@/components/ui/status-chip";
import { corDaFonte } from "@/lib/cor-da-fonte";
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
  if (Number.isNaN(t)) return { label: "sem data", overdue: false };
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
      className="flex h-full min-h-0 flex-col"
    >
      <header className="shrink-0 px-4 pb-3 pt-4">
        <h2 className="flex items-baseline gap-2.5 text-2xl font-bold tracking-tight text-bone-50">
          Hoje
          {!isLoading && !error ? (
            <span className="rounded-full bg-navy-800 px-2.5 py-1 font-mono text-xs font-semibold text-gold-300">
              {items.length}
            </span>
          ) : null}
        </h2>
        {!isLoading && !error && items.length > 0 ? (
          <p className="mt-1 text-sm text-bone-400">
            Comece pelo <span className="font-semibold text-gold-300">nº 1</span> — o
            resto pode esperar.
          </p>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {isLoading ? <LoadingSkeleton /> : null}

        {!isLoading && error ? (
          <div
            role="alert"
            className="mt-2 rounded-lg border border-state-blocked/50 bg-state-blocked/10 p-4 text-sm text-state-error-fg"
          >
            <p className="font-semibold">Não consegui montar a lista de hoje.</p>
            <p className="mt-1 text-xs text-bone-300">{error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-b from-gold-400 to-gold-600 px-4 text-sm font-semibold text-navy-950"
            >
              Tentar de novo
            </button>
          </div>
        ) : null}

        {!isLoading && !error && items.length === 0 ? (
          <EmptyState blockedCount={excludedCycleIds.length} />
        ) : null}

        {!isLoading && !error && items.length > 0 ? (
          <ol className="space-y-2.5">
            {items.map((item, i) => {
              const { task, reason } = item;
              const isSel = selectedTaskId === task.id;
              const src = sourceById.get(task.sourceId);
              const cor = corDaFonte(src?.kind);
              const due = task.dueDate ? formatDue(task.dueDate, now) : null;
              const primeiro = i === 0;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(task.id)}
                    aria-posinset={i + 1}
                    aria-setsize={items.length}
                    aria-pressed={isSel}
                    className={`relative block w-full overflow-hidden rounded-xl border pl-4 pr-3.5 text-left transition duration-150 ease-almapetra ${
                      primeiro ? "py-4" : "py-3.5"
                    } ${
                      isSel
                        ? "border-gold-500 bg-navy-800"
                        : primeiro
                          ? "border-gold-600/50 bg-navy-850 shadow-heroi hover:bg-navy-800"
                          : "border-navy-700 bg-navy-850 hover:border-navy-600 hover:bg-navy-800"
                    }`}
                  >
                    {/* Faixa lateral na cor da fonte: diz de onde a tarefa veio
                        antes de qualquer palavra ser lida. */}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-1.5 ${cor.faixa}`}
                    />

                    <div className="flex items-start gap-2.5">
                      <RankBadge rank={i} />
                      <span
                        className={`flex-1 font-semibold leading-snug text-bone-50 ${
                          primeiro ? "text-xl" : "text-base"
                        }`}
                      >
                        {task.title}
                      </span>
                      {src ? (
                        <SourceIcon
                          kind={src.kind}
                          label={src.label}
                          size={18}
                          className={cor.texto}
                        />
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[42px]">
                      <StatusChip status={task.status} />
                      <span
                        className={`rounded-full px-2 py-1 font-mono text-[11px] font-semibold ${cor.fundo} ${cor.texto}`}
                      >
                        peso {scoreOf(task)}
                      </span>
                      {due ? (
                        <span
                          className={`rounded-full px-2 py-1 font-mono text-[11px] font-semibold ${
                            due.overdue
                              ? "bg-state-blocked/12 text-state-blocked"
                              : "bg-navy-800 text-bone-300"
                          }`}
                        >
                          {due.overdue ? "atrasada " : "vence "}
                          {due.label}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 pl-[42px] text-xs leading-relaxed text-bone-400">
                      {reason}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}

        {excludedCycleIds.length > 0 ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-state-blocked/40 bg-state-blocked/10 px-3 py-2.5 text-xs text-state-error-fg">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {excludedCycleIds.length} tarefa(s) ficaram fora da fila porque
              dependem umas das outras em círculo.
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function LoadingSkeleton(): JSX.Element {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="lb-shimmer h-[104px] rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ blockedCount }: { blockedCount: number }): JSX.Element {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-state-done/12">
        <CheckCircle2 size={34} className="text-state-done" aria-hidden="true" />
      </span>
      <p className="text-lg font-semibold text-bone-50">Nada para hoje.</p>
      <p className="max-w-xs text-sm text-bone-400">
        Ou tudo que existe está esperando outra coisa terminar, ou você já venceu
        a fila. Respire. 🌿
      </p>
      {blockedCount > 0 ? (
        <p className="text-xs text-state-error-fg">
          {blockedCount} tarefa(s) fora da fila por dependência em círculo — veja
          no grafo.
        </p>
      ) : null}
    </div>
  );
}
