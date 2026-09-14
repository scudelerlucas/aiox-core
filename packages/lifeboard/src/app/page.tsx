import Link from "next/link";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { buildTodayList } from "@/core/prioritize/server-only";
import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { scoreAssimetriaLote } from "@/core/prioritize/assimetria";
import {
  getSourcesRepository,
  getTasksRepository,
} from "@/lib/repositories/factory";
import { serializaGrafoV3 } from "@/lib/serializa-grafo-v3";
import { computeSourceStatuses } from "@/lib/source-status";
import type { Source, SyncLog, Task, TaskEdge } from "@/types/canonical";
import type { TodayResponse } from "@/types/dashboard";
import type { GrafoV3Props } from "@/types/grafo-v3";

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
  // Tudo o que pode falhar por causa externa fica dentro do try: a RPC pode
  // responder 4xx/5xx, a rede pode cair, uma variável de ambiente pode faltar
  // (o getter de `env` lança) e o motor HIERARQ lança se um score vier torto.
  // Sem esta rede, qualquer um desses soluços vira HTTP 500 na home inteira —
  // a `/frentes` já degradava assim desde o começo; a home não tinha herdado.
  let tasks: Task[];
  let sources: Source[];
  let syncLogs: SyncLog[];
  let edges: TaskEdge[];
  let hoje: ReturnType<typeof buildTodayList>;
  let grafoV3: GrafoV3Props;
  try {
    const tasksRepo = getTasksRepository();
    const sourcesRepo = getSourcesRepository();
    [tasks, sources, syncLogs, edges] = await Promise.all([
      tasksRepo.listAll(),
      sourcesRepo.listAll(),
      sourcesRepo.listSyncLogs(),
      tasksRepo.listEdges(),
    ]);
    hoje = buildTodayList(tasks);

    // v3 (P4) — caminho crítico + score de assimetria (camada O, server-only).
    // Goal: a primeira tarefa `isGoal`, por ordem determinística de id (nunca a
    // ordem de chegada do repositório) — mesma escolha que `caminhoCritico`
    // faria sozinho quando `goalId` não é informado, só que explícita aqui
    // para o goal usado no CPM e o `goalId` de `GrafoV3Props` NUNCA divergirem.
    const goalId =
      [...tasks]
        .filter((t) => t.isGoal === true)
        .sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null;
    const cpm = caminhoCritico(tasks, edges, goalId);
    const scores = scoreAssimetriaLote(tasks, edges, cpm);
    grafoV3 = serializaGrafoV3(edges, cpm, scores);
  } catch (erro) {
    console.error("[home] falha ao ler o estado do dia:", erro);
    return <NaoConsegui />;
  }

  const { items, excludedCycles } = hoje;
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
      grafoV3={grafoV3}
    />
  );
}

/**
 * Aviso de leitura falhada: frase curta, sem detalhe técnico, com saída — o
 * mesmo contrato do `NaoConsegui` da `/frentes`. Chega a gente (B11 da régua
 * de UI/UX): erro em português na tela, nunca JSON nem tela de 500.
 */
function NaoConsegui(): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
        ALMA PETRA
      </h1>
      <div
        role="status"
        className="mt-4 rounded-lg border border-state-warning/50 px-4 py-3 text-sm text-bone-100"
      >
        Não consegui ler as tarefas de hoje agora — tente de novo em alguns
        minutos.
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
        >
          tentar de novo
        </Link>
        <Link
          href="/frentes"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
        >
          ir para Assuntos
        </Link>
      </div>
    </main>
  );
}
