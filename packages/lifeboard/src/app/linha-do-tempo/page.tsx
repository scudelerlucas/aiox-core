import Link from "next/link";

import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { scoreAssimetriaLote } from "@/core/prioritize/assimetria";
import { montarLinhaDoTempo } from "@/core/timeline/linha-do-tempo";
import { getFrentesRepository } from "@/lib/frentes/repository";
import type { Pr } from "@/lib/frentes/types";
import {
  getSourcesRepository,
  getTasksRepository,
} from "@/lib/repositories/factory";
import type { Source, Task, TaskEdge } from "@/types/canonical";
import type { LinhaDoTempoProps } from "@/types/linha-do-tempo";

import { LinhaDoTempoView } from "@/components/timeline/linha-do-tempo";

/**
 * OS-LIFEBOARD · P5 — Linha do tempo (Gantt): progressão dos ASSUNTOS
 * (`painel_frentes_prs`, `criado_em → mergeado_em`) e das TAREFAS (caminho
 * crítico via `iniciadoEm`/`estimativaDias`), com predecessores/sucessores
 * visíveis — pedido original do operador ("algo similar a um gráfico de gantt
 * para medir a progressão de cada assunto, seus predecessores e sucessores").
 *
 * Mesmo padrão de `app/page.tsx`: busca no servidor (fixture | Supabase live,
 * decidido por `LIFEBOARD_DATA_MODE`), CPM + score calculados aqui (camada O,
 * `server-only`) e descidos como prop SERIALIZÁVEL (`LinhaDoTempoProps`) para o
 * Client Component. Tudo que pode falhar por causa externa (RPC, rede, um score
 * torto) fica dentro do `try` — sem isso, um soluço vira HTTP 500 na tela
 * inteira, o mesmo erro que a home já corrigiu.
 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Linha do tempo · ALMA PETRA",
  description: "Progressão dos assuntos e das tarefas, com predecessores e sucessores.",
};

export default async function PaginaLinhaDoTempo(): Promise<JSX.Element> {
  let props: LinhaDoTempoProps;
  try {
    const tasksRepo = getTasksRepository();
    const sourcesRepo = getSourcesRepository();
    const [tasks, sources, edges, dadosFrentes] = await Promise.all([
      tasksRepo.listAll(),
      sourcesRepo.listAll(),
      tasksRepo.listEdges(),
      getFrentesRepository().carregar(),
    ]);

    props = montarProps(tasks, sources, edges, dadosFrentes.prs);
  } catch (erro) {
    console.error("[linha-do-tempo] falha ao ler o estado do dia:", erro);
    return <NaoConsegui />;
  }

  return <LinhaDoTempoView {...props} />;
}

/** Extraído para ser chamável de teste manual sem HTTP — mesma lógica da rota. */
function montarProps(
  tasks: Task[],
  sources: Source[],
  edges: TaskEdge[],
  prs: Pr[],
): LinhaDoTempoProps {
  // Mesma escolha determinística de goal que `app/page.tsx` — nunca a ordem de
  // chegada do repositório, para o CPM daqui e o do grafo nunca divergirem.
  const goalId =
    [...tasks]
      .filter((t) => t.isGoal === true)
      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null;
  const cpm = caminhoCritico(tasks, edges, goalId);
  const scoresBrutos = scoreAssimetriaLote(tasks, edges, cpm);
  const scores = new Map<string, number | null | undefined>(
    [...scoresBrutos].map(([id, score]) => [id, score?.valor]),
  );
  const hoje = new Date().toISOString().slice(0, 10);
  return montarLinhaDoTempo(tasks, edges, prs, sources, cpm, hoje, scores);
}

/** Aviso de leitura falhada — mesmo contrato de `/` e `/frentes` (B11 da régua de UI/UX). */
function NaoConsegui(): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
        Linha do tempo
      </h1>
      <div
        role="status"
        className="mt-4 rounded-lg border border-state-warning/50 px-4 py-3 text-sm text-bone-100"
      >
        Não consegui montar a linha do tempo agora — tente de novo em alguns
        minutos.
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/linha-do-tempo"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
        >
          tentar de novo
        </Link>
        <Link
          href="/"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
        >
          ir para o painel
        </Link>
      </div>
    </main>
  );
}
