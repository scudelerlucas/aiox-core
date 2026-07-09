"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle, List, Network, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DependencyGraph } from "@/components/graph/dependency-graph";
import { SourceFilter, type SourceFilterOption } from "@/components/dashboard/source-filter";
import { StaleSourceFlag } from "@/components/dashboard/stale-source-flag";
import { TodayList, type TodayListItem } from "@/components/dashboard/today-list";
import { Providers } from "@/components/providers";
import { useTodayQuery } from "@/hooks/use-today-query";
import { useSourceFilter } from "@/stores/source-filter";
import type { Source, SourceKind, Task } from "@/types/canonical";
import type { SourceStatus, TodayResponse } from "@/types/dashboard";

export interface DashboardClientProps {
  /** Universo de tarefas (grafo). */
  tasks: Task[];
  /** Fontes canônicas (label/ícone/id por nó do grafo). */
  sources: Source[];
  /** Estado consolidado das fontes (filtro + flags de staleness). */
  sourceStatuses: SourceStatus[];
  /** Lista "hoje" pré-computada server-side (SSR → initialData do TanStack Query). */
  initialToday: TodayResponse;
}

const ALL_KINDS: SourceKind[] = ["calendar", "gmail", "drive", "notes", "claude_chat"];

function DashboardInner({
  tasks,
  sources,
  sourceStatuses,
  initialToday,
}: DashboardClientProps): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selected, setSelected } = useSourceFilter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const today = useTodayQuery(initialToday);

  const kindBySourceId = useMemo(() => {
    const m = new Map<string, SourceKind>();
    for (const s of sources) m.set(s.id, s.kind);
    return m;
  }, [sources]);

  const filterOptions: SourceFilterOption[] = useMemo(
    () =>
      sourceStatuses.map((s) => ({
        kind: s.kind,
        label: s.label,
        count: s.taskCount,
        isStale: s.severity !== null,
      })),
    [sourceStatuses],
  );

  const effectiveKinds = selected.length === 0 ? ALL_KINDS : selected;

  // Lista "hoje": itens de fonte não-selecionada são OCULTADOS (spec §5),
  // preservando a ordem HIERARQ dos remanescentes.
  const todayItems: TodayListItem[] = useMemo(() => {
    const items = today.data?.items ?? [];
    return items.filter((it) => {
      const kind = kindBySourceId.get(it.task.sourceId);
      return kind ? effectiveKinds.includes(kind) : true;
    });
  }, [today.data, kindBySourceId, effectiveKinds]);

  const todayTaskIds = useMemo(
    () => (today.data?.items ?? []).map((it) => it.task.id),
    [today.data],
  );
  const excludedCycles = today.data?.excludedCycles ?? [];

  const staleSources = sourceStatuses.filter((s) => s.severity !== null);

  const handleSync = (): void => {
    // E5: "refresh" do estado (E6/Fase 2 conecta o POST /api/sync real).
    void queryClient.invalidateQueries({ queryKey: ["today"] });
    router.refresh();
  };

  return (
    <div className="flex h-screen flex-col bg-navy-950 text-bone-100">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-navy-700 bg-navy-850 px-4 shadow-panel">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-wide text-bone-50">
            ALMA PETRA
          </span>
          <span className="font-mono text-xs text-gold-500">OS-LIFEBOARD</span>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 flex-wrap items-center justify-center gap-2"
        >
          {staleSources.map((s) => (
            <StaleSourceFlag
              key={s.kind}
              sourceKind={s.kind}
              sourceLabel={s.label}
              lastSyncAt={s.lastSyncAt}
              lastError={s.lastError}
              severity={s.severity ?? "warning"}
              size="md"
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSync}
            className="inline-flex items-center gap-1.5 rounded-md border border-gold-500 px-3 py-1.5 text-xs font-medium text-gold-300 hover:bg-navy-700"
          >
            <RefreshCw size={14} /> sync
          </button>
          <button
            type="button"
            aria-label="Ajuda"
            className="flex h-8 w-8 items-center justify-center rounded-md text-bone-400 hover:bg-navy-700 hover:text-bone-100"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>

      {/* ── CORPO: rail + split ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* LEFT RAIL */}
        <aside className="w-64 shrink-0 border-r border-navy-700 bg-navy-850">
          <SourceFilter
            options={filterOptions}
            selected={selected}
            onChange={setSelected}
          />
        </aside>

        {/* MAIN SPLIT */}
        <main className="flex min-w-0 flex-1">
          {/* ZONA A — GRAFO (~62%) */}
          <section className="flex min-w-0 basis-[62%] flex-col bg-navy-950">
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-navy-800 px-3">
              <span className="text-xs font-medium text-bone-400">
                Grafo de dependências
              </span>
              <button
                type="button"
                onClick={() => setShowFallback((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-navy-600 px-2 py-0.5 text-xs text-bone-300 hover:bg-navy-700"
                aria-pressed={showFallback}
              >
                {showFallback ? <Network size={12} /> : <List size={12} />}
                {showFallback ? "ver grafo" : "ver como lista"}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <DependencyGraph
                tasks={tasks}
                sources={sources}
                activeSourceKinds={selected}
                cycleTaskIds={excludedCycles}
                todayTaskIds={todayTaskIds}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                accessibleFallback={showFallback}
              />
            </div>
          </section>

          {/* ZONA B — HOJE (~38%) */}
          <section className="min-w-0 basis-[38%] border-l border-navy-600 bg-navy-900">
            <TodayList
              items={todayItems}
              excludedCycleIds={excludedCycles}
              isLoading={today.isLoading}
              error={today.error}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              sources={sources}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

/** Wrapper com o Provider do TanStack Query. */
export function DashboardClient(props: DashboardClientProps): JSX.Element {
  return (
    <Providers>
      <DashboardInner {...props} />
    </Providers>
  );
}
