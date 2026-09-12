import Link from "next/link";

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

/** Estilo comum dos dois links do cabeçalho (Assuntos · Sair). */
const ESTILO_LINK_CABECALHO = {
  fontSize: 12,
  color: "#8593A8",
  textDecoration: "none",
  background: "#0F1E33",
  border: "1px solid #1E3350",
  borderRadius: 8,
  padding: "6px 11px",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
} as const;

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
    <>
      {/* Cabeçalho no FLUXO (não fixo): link sobreposto cobria os avisos da
          página. Mesmo estilo dos dois links, lado a lado, alinhados à direita. */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          padding: "12px 14px 0",
        }}
      >
        <Link href="/frentes" prefetch={false} style={ESTILO_LINK_CABECALHO}>
          Assuntos
        </Link>
        <a href="/auth/signout" style={ESTILO_LINK_CABECALHO}>
          Sair
        </a>
      </div>
      <DashboardClient
        tasks={tasks}
        sources={sources}
        sourceStatuses={sourceStatuses}
        initialToday={initialToday}
      />
    </>
  );
}
