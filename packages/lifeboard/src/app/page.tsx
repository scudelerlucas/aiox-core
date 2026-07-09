import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { buildTodayList } from "@/core/prioritize/server-only";
import {
  FixtureSourcesRepository,
  type SourcesRepository,
} from "@/lib/repositories/sources.fixture";
import {
  FixtureTasksRepository,
  type TasksRepository,
} from "@/lib/repositories/tasks.fixture";
import { computeSourceStatuses } from "@/lib/source-status";
import type { TodayResponse } from "@/types/dashboard";

/**
 * OS-LIFEBOARD · E5 — Dashboard (Server Component, spec §2.3 / arch §3).
 *
 * [AUTO-DECISION] Busca de dados: SERVER-SIDE direto dos repositórios (mais
 * simples que um round-trip HTTP no primeiro paint) — roda `buildTodayList`
 * (server-only, camada O) e `computeSourceStatuses`, e hidrata o client como
 * `initialData` do TanStack Query. O cliente ainda revalida via `GET /api/today`
 * (freshness + estados loading/error da spec §4.3). Razão: SSR garante render
 * imediato do grafo+lista (bom p/ o screenshot) sem abrir mão do cache de leitura.
 *
 * Fixtures nesta rodada; troca fixture→Supabase é mecânica (arch §5.2).
 */

// Fixture in-memory → render estável; sem prerender estático agressivo.
export const dynamic = "force-dynamic";

const tasksRepo: TasksRepository = new FixtureTasksRepository();
const sourcesRepo: SourcesRepository = new FixtureSourcesRepository();

export default async function Page(): Promise<JSX.Element> {
  const [tasks, sources, syncLogs] = await Promise.all([
    tasksRepo.listAll(),
    sourcesRepo.listAll(),
    sourcesRepo.listSyncLogs(),
  ]);

  const { items, excludedCycles } = buildTodayList(tasks);
  const initialToday: TodayResponse = {
    items: items.map(({ task, reason }) => ({ task, reason })),
    excludedCycles: excludedCycles.map((t) => t.id),
  };
  const sourceStatuses = computeSourceStatuses(sources, syncLogs, tasks);

  return (
    <DashboardClient
      tasks={tasks}
      sources={sources}
      sourceStatuses={sourceStatuses}
      initialToday={initialToday}
    />
  );
}
