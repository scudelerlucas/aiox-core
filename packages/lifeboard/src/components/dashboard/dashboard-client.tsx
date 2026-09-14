"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  LogOut,
  LayoutList,
  List,
  Network,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DependencyGraph } from "@/components/graph/dependency-graph";
import { SourceFilter, type SourceFilterOption } from "@/components/dashboard/source-filter";
import { StaleSourceFlag } from "@/components/dashboard/stale-source-flag";
import { TodayList, type TodayListItem } from "@/components/dashboard/today-list";
import { Providers } from "@/components/providers";
import { passaNoFiltro } from "@/lib/filtro-de-fontes";
import { useTodayQuery } from "@/hooks/use-today-query";
import { useSourceFilter } from "@/stores/source-filter";
import type { Source, SourceKind, Task } from "@/types/canonical";
import type { SourceStatus, TodayResponse } from "@/types/dashboard";
import type { GrafoV3Props } from "@/types/grafo-v3";

export interface DashboardClientProps {
  /** Universo de tarefas (grafo). */
  tasks: Task[];
  /** Fontes canônicas (label/ícone/id por nó do grafo). */
  sources: Source[];
  /** Estado consolidado das fontes (filtro + flags de staleness). */
  sourceStatuses: SourceStatus[];
  /** Lista "hoje" pré-computada server-side (SSR → initialData do TanStack Query). */
  initialToday: TodayResponse;
  /** v3 (P4): arestas + caminho crítico + scores, calculados no servidor. */
  grafoV3: GrafoV3Props;
}

/** Painéis do celular. No desktop os três aparecem lado a lado. */
type Aba = "hoje" | "grafo" | "fontes";

function DashboardInner({
  tasks,
  sources,
  sourceStatuses,
  initialToday,
  grafoV3,
}: DashboardClientProps): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selected, setSelected } = useSourceFilter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  /** Celular abre em "Hoje": é a única pergunta que esta tela responde. */
  const [aba, setAba] = useState<Aba>("hoje");
  const [avisosAbertos, setAvisosAbertos] = useState(false);

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

  // Lista "hoje": itens de fonte não-selecionada são OCULTADOS (spec §5),
  // preservando a ordem HIERARQ dos remanescentes.
  const todayItems: TodayListItem[] = useMemo(() => {
    const items = today.data?.items ?? [];
    return items.filter((it) =>
      passaNoFiltro(kindBySourceId.get(it.task.sourceId), selected),
    );
  }, [today.data, kindBySourceId, selected]);

  const todayTaskIds = useMemo(
    () => (today.data?.items ?? []).map((it) => it.task.id),
    [today.data],
  );
  const excludedCycles = today.data?.excludedCycles ?? [];

  const staleSources = sourceStatuses.filter((s) => s.severity !== null);
  const temErro = staleSources.some((s) => s.severity === "error");

  const handleSync = (): void => {
    // E5: "refresh" do estado (E6/Fase 2 conecta o POST /api/sync real).
    void queryClient.invalidateQueries({ queryKey: ["today"] });
    router.refresh();
  };

  /** Painel só é montado quando visível no celular; no desktop, sempre. */
  const visivel = (alvo: Aba): string =>
    aba === alvo ? "flex" : "hidden lg:flex";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-navy-950 text-bone-100">
      {/* ── CABEÇALHO ──────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-navy-700 bg-navy-900 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-2xl">
            ALMA PETRA
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-bone-400 sm:inline">
            lifeboard
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/frentes"
            prefetch={false}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-navy-600 px-3 text-sm font-semibold text-bone-200 transition hover:bg-navy-800 sm:min-h-[44px]"
          >
            <ExternalLink size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Assuntos</span>
          </Link>
          <button
            type="button"
            onClick={handleSync}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-gradient-to-b from-gold-400 to-gold-600 px-3.5 text-sm font-semibold text-navy-950 shadow-card transition hover:from-gold-300 hover:to-gold-500 sm:min-h-[44px]"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            type="button"
            aria-label="Ajuda"
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-bone-400 transition hover:bg-navy-800 hover:text-bone-100 sm:flex sm:h-11 sm:w-11"
          >
            <HelpCircle size={20} aria-hidden="true" />
          </button>
          <a
            href="/auth/signout"
            aria-label="Sair"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-bone-400 transition hover:bg-navy-800 hover:text-bone-100 sm:h-11 sm:w-11"
          >
            <LogOut size={19} aria-hidden="true" />
          </a>
        </div>
      </header>

      {/* ── AVISOS DE FONTE DESATUALIZADA ─────────────────────────────────
          Antes: N chips flutuando dentro do cabeçalho — no desktop cobriam o
          próprio cabeçalho e o 5º saía cortado; no celular empilhavam por cima
          de tudo. Agora: UMA linha que conta quantas são, e abre a lista. */}
      {staleSources.length > 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 border-b border-navy-700 bg-navy-900"
        >
          <button
            type="button"
            onClick={() => setAvisosAbertos((v) => !v)}
            aria-expanded={avisosAbertos}
            className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm sm:px-4"
          >
            <AlertTriangle
              size={16}
              aria-hidden="true"
              className={temErro ? "text-state-blocked" : "text-state-progress"}
            />
            <span className={temErro ? "text-state-error-fg" : "text-state-progress"}>
              {staleSources.length}{" "}
              {staleSources.length === 1 ? "fonte desatualizada" : "fontes desatualizadas"}
            </span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`ml-auto text-bone-400 transition-transform duration-200 ${
                avisosAbertos ? "rotate-180" : ""
              }`}
            />
          </button>
          {avisosAbertos ? (
            <div className="flex flex-wrap gap-2 px-3 pb-3 sm:px-4">
              {staleSources.map((s) => (
                <StaleSourceFlag
                  key={`${s.kind}-${s.label}`}
                  sourceKind={s.kind}
                  sourceLabel={s.label}
                  lastSyncAt={s.lastSyncAt}
                  lastError={s.lastError}
                  severity={s.severity ?? "warning"}
                  size="md"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── ABAS (só celular/tablet) ──────────────────────────────────────
          O desktop mostra os três painéis ao mesmo tempo; abaixo de 1024 px
          não cabem — e era exatamente isso que destruía a tela. */}
      <nav
        aria-label="Painéis"
        className="flex shrink-0 gap-1 border-b border-navy-700 bg-navy-900 px-2 lg:hidden"
      >
        {(
          [
            { id: "hoje", rotulo: "Hoje", Icone: LayoutList, conta: todayItems.length },
            { id: "grafo", rotulo: "Grafo", Icone: Network, conta: null },
            { id: "fontes", rotulo: "Fontes", Icone: SlidersHorizontal, conta: null },
          ] as const
        ).map(({ id, rotulo, Icone, conta }) => {
          const ativa = aba === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              aria-current={ativa ? "page" : undefined}
              className={`relative flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 text-sm font-semibold transition ${
                ativa
                  ? "bg-navy-850 text-gold-300"
                  : "text-bone-400 hover:bg-navy-850/60 hover:text-bone-200"
              }`}
            >
              <Icone size={16} aria-hidden="true" />
              {rotulo}
              {conta !== null ? (
                <span className="rounded-full bg-navy-700 px-1.5 py-0.5 font-mono text-[11px] text-bone-200">
                  {conta}
                </span>
              ) : null}
              {ativa ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
                />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* ── CORPO ─────────────────────────────────────────────────────────
          Celular: um painel por vez (as abas acima).

          Desktop (≥1024): o GRAFO ocupa a largura inteira do conteúdo e as
          duas colunas que dividiam espaço com ele descem para baixo do canvas.
          P4g (achado MÉDIO #7 do crítico hostil ROUND 6): a 1280 real o pane
          do grafo media 592px — o ramo de 6 colunas do layout estava MORTO
          (390→3, 1280→3, 1440→4, 1920→6 colunas). Um grafo que só existe em
          1920 não é um grafo: é uma promessa. "Hoje" continua sendo a resposta
          da tela, e continua a um rolar de distância — mas quem precisa do
          grafo precisa dele inteiro. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <section
          aria-label="Grafo de dependências"
          className={`${visivel("grafo")} min-h-0 w-full min-w-0 flex-1 flex-col bg-navy-900 lg:min-h-[26rem]`}
        >
          <div className="flex min-h-[44px] shrink-0 items-center justify-between gap-2 border-b border-navy-700 px-3">
            <span className="text-sm font-semibold text-bone-300">
              Grafo <span className="font-normal text-bone-400">— como as tarefas se puxam</span>
            </span>
            <button
              type="button"
              onClick={() => setShowFallback((v) => !v)}
              aria-pressed={showFallback}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-navy-600 px-3 text-xs font-medium text-bone-200 transition hover:bg-navy-800"
            >
              {showFallback ? <Network size={14} /> : <List size={14} />}
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
              grafoV3={grafoV3}
            />
          </div>
        </section>

        {/* No celular a linha de baixo só DISPUTA altura quando tem conteúdo
            visível: com a aba "Grafo" aberta, os dois painéis estão `hidden` e
            um `flex-1` aqui roubaria metade da tela para uma faixa vazia
            (medido: pane do grafo com 145px de altura a 390). */}
        <div
          className={`flex min-h-0 ${
            aba === "grafo" ? "" : "flex-1"
          } lg:h-[38%] lg:flex-none lg:border-t lg:border-navy-700`}
        >
          <aside
            className={`${visivel("fontes")} min-h-0 w-full shrink-0 flex-col overflow-y-auto border-navy-700 bg-navy-900 lg:w-60 lg:border-r xl:w-64`}
          >
            <SourceFilter
              options={filterOptions}
              selected={selected}
              onChange={setSelected}
            />
          </aside>

          <section
            aria-label="Prioridades de hoje"
            className={`${visivel("hoje")} min-h-0 w-full min-w-0 flex-1 flex-col bg-navy-950`}
          >
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
        </div>
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
