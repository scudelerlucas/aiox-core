import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { buildTodayList } from "@/core/prioritize/server-only";
import {
  getSourcesRepository,
  getTasksRepository,
} from "@/lib/repositories/factory";
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

// Lê o estado do dia por request (fixture ou Supabase live); sem prerender estático.
export const dynamic = "force-dynamic";

export default async function Page(): Promise<JSX.Element> {
  // Origem (fixture | Supabase live) decidida pelo factory via LIFEBOARD_DATA_MODE.
  const tasksRepo = getTasksRepository();
  const sourcesRepo = getSourcesRepository();
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
