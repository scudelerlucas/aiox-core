import Link from "next/link";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { buildTodayList } from "@/core/prioritize/server-only";
import {
  getSourcesRepository,
  getTasksRepository,
} from "@/lib/repositories/factory";
import { computeSourceStatuses } from "@/lib/source-status";
import type { Source, SyncLog, Task } from "@/types/canonical";
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
  // Tudo o que pode falhar por causa externa fica dentro do try: a RPC pode
  // responder 4xx/5xx, a rede pode cair, uma variável de ambiente pode faltar
  // (o getter de `env` lança) e o motor HIERARQ lança se um score vier torto.
  // Sem esta rede, qualquer um desses soluços vira HTTP 500 na home inteira —
  // a `/frentes` já degradava assim desde o começo; a home não tinha herdado.
  let tasks: Task[];
  let sources: Source[];
  let syncLogs: SyncLog[];
  let hoje: ReturnType<typeof buildTodayList>;
  try {
    const tasksRepo = getTasksRepository();
    const sourcesRepo = getSourcesRepository();
    [tasks, sources, syncLogs] = await Promise.all([
      tasksRepo.listAll(),
      sourcesRepo.listAll(),
      sourcesRepo.listSyncLogs(),
    ]);
    hoje = buildTodayList(tasks);
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
