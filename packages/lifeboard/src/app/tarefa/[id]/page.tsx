import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { env } from "@/config/env";
import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { scoreAssimetria } from "@/core/prioritize/assimetria";
import { herancaEfetiva } from "@/core/prioritize/heranca";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  listarEdgesFixture,
  listarNotesFixture,
  listarTasksFixture,
} from "@/lib/repositories/tasks.fixture-store";
import { getSourcesRepository, getTasksRepository } from "@/lib/repositories/factory";
import type { Source, Task, TaskEdge, TaskNote } from "@/types/canonical";

import { AtomosForm } from "@/components/task/atomos-form";
import { DuracaoForm } from "@/components/task/duracao-form";
import { MaeForm } from "@/components/task/mae-form";
import { MetaForm } from "@/components/task/meta-form";
import { NotasPainel } from "@/components/task/notas-painel";
import { RelacoesPainel } from "@/components/task/relacoes-painel";
import { StatusForm } from "@/components/task/status-form";
import { SubtarefasPainel } from "@/components/task/subtarefas-painel";

/**
 * OS-LIFEBOARD · P6 — a página da tarefa: notas, subtarefas, meta (goal),
 * átomos declarados, duração e as 4 relações — tudo o que o operador pediu
 * ("poder adicionar notas em cada tarefa, adicionando sub tarefas e a meta
 * final/goal") a partir de UM lugar.
 *
 * Mesmo padrão de `/frentes` e `/linha-do-tempo`: Server Component,
 * `force-dynamic`, leitura protegida por `try/catch` (uma falha de rede vira
 * uma frase em português, nunca HTTP 500 na tela inteira — B11 da régua de
 * UI/UX) e `notFound()` de verdade quando o id não existe (não uma tela de
 * "carregando" eterna).
 *
 * Modo fixture: lê e escreve no store em memória de
 * `tasks.fixture-store.ts` — é o único jeito de ter round-trip sem banco.
 * Modo live: lê pelo repositório de sempre (`getTasksRepository`), que por
 * baixo chama `lifeboard_load`; escreve pela RPC `lifeboard_mutate`
 * (`src/app/tarefa/actions.ts`).
 */
export const dynamic = "force-dynamic";

interface PaginaTarefaProps {
  params: Promise<{ id: string }>;
}

async function carregarEstado(): Promise<{
  tasks: Task[];
  edges: TaskEdge[];
  notes: TaskNote[];
  sources: Source[];
}> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    const tasksRepo = getTasksRepository();
    const [tasks, edges, notes, sources] = await Promise.all([
      tasksRepo.listAll(),
      tasksRepo.listEdges(),
      tasksRepo.listNotes(),
      getSourcesRepository().listAll(),
    ]);
    return { tasks, edges, notes, sources };
  }
  return {
    tasks: listarTasksFixture(),
    edges: listarEdgesFixture(),
    notes: listarNotesFixture(),
    sources: await getSourcesRepository().listAll(),
  };
}

export default async function PaginaTarefa({ params }: PaginaTarefaProps): Promise<JSX.Element> {
  const { id } = await params;

  let tasks: Task[];
  let edges: TaskEdge[];
  let notes: TaskNote[];
  let sources: Source[];
  try {
    const estado = await carregarEstado();
    tasks = estado.tasks;
    edges = estado.edges;
    notes = estado.notes;
    sources = estado.sources;
  } catch (erro) {
    console.error(`[tarefa/${id}] falha ao ler o estado do dia:`, erro);
    return <NaoConsegui id={id} />;
  }

  const task = tasks.find((t) => t.id === id);
  if (!task) notFound();

  // Mesma escolha determinística de goal que `app/page.tsx`/`linha-do-tempo`.
  const goalId =
    [...tasks].filter((t) => t.isGoal === true).sort((a, b) => a.id.localeCompare(b.id))[0]?.id ??
    null;
  const cpm = caminhoCritico(tasks, edges, goalId);
  const score = scoreAssimetria(task, tasks, edges, cpm);
  const janela = cpm.janelas.get(task.id) ?? null;

  const filhas = tasks.filter((t) => t.parentId === task.id);
  // v2 (achado CRÍTICO #1): recursivo — passa a lista INTEIRA de tarefas
  // (não só as filhas diretas) para que netas/bisnetas participem da soma.
  const herancaResultado = herancaEfetiva(task, tasks);
  const notasDaTarefa = notes.filter((n) => n.taskId === task.id);
  const saindo = edges.filter((e) => e.origem === task.id);
  const entrando = edges.filter((e) => e.destino === task.id);
  const outrasTarefas = tasks.filter((t) => t.id !== task.id);
  const tituloPorId = new Map(tasks.map((t) => [t.id, t.title] as const));
  // [BAIXO #8, crítico 13/09, rodada 2] o cabeçalho mostrava o uuid cru de
  // `sourceId` e a data em ISO — nenhum dos dois é o que um humano lê.
  // Mesmo padrão de `today-list.tsx`/`task-node.tsx`: resolve pelo rótulo da
  // fonte (`sources`) e formata a data com `formatRelativeTime`.
  const fonte = sources.find((s) => s.id === task.sourceId)?.label ?? task.sourceId;

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 pb-16 pt-10 sm:px-6">
      <div className="mb-6">
        <Link
          href="/"
          prefetch={false}
          className="text-xs font-semibold text-bone-400 hover:text-gold-300"
        >
          ← painel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-bone-50">{task.title}</h1>
        <p className="mt-1 text-xs text-bone-400">
          fonte {fonte} · atualizada {formatRelativeTime(task.updatedAt)}
          {task.isGoal ? <span className="ml-2 text-gold-300">· meta do ciclo</span> : null}
        </p>
      </div>

      {/* [MÉDIO #5, crítico 13/09, rodada 2] "Notas" é a AÇÃO PRIMÁRIA da
          página (`notas-painel.tsx` já documenta isso) mas vinha depois de
          Status/Meta/Duração/Mãe/Átomos — 15 paradas de Tab até a textarea,
          acima da régua de ≤ 8. Movida para logo após o cabeçalho: agora são
          2 paradas (o link "← painel" e a textarea). */}
      <Secao titulo={`Notas (${notasDaTarefa.length})`}>
        <NotasPainel taskId={task.id} notas={notasDaTarefa} />
      </Secao>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Secao titulo="Status">
          <StatusForm taskId={task.id} statusAtual={task.status} />
        </Secao>

        <Secao titulo="Meta (goal do caminho crítico)">
          <MetaForm taskId={task.id} isGoal={task.isGoal === true} />
          {janela ? (
            <p className="mt-2 text-xs text-bone-400">
              janela: ES {janela.es} · EF {janela.ef} · LS {janela.ls} · LF {janela.lf} · folga{" "}
              {janela.folga}
              {cpm.critico.has(task.id) ? <span className="text-gold-300"> · crítico</span> : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-bone-400">fora do caminho crítico calculado agora.</p>
          )}
        </Secao>

        <Secao titulo="Duração (estimativa p80)">
          <DuracaoForm taskId={task.id} estimativaDias={task.estimativaDias ?? null} />
        </Secao>

        <Secao titulo="Mãe (hierarquia)">
          <MaeForm
            taskId={task.id}
            parentIdAtual={task.parentId ?? null}
            opcoes={outrasTarefas.map((t) => ({ id: t.id, title: t.title }))}
          />
        </Secao>
      </div>

      <Secao titulo="Átomos do score de assimetria" className="mt-4">
        <AtomosForm
          taskId={task.id}
          assimetriaAtual={task.assimetria ?? null}
          score={score}
          heranca={herancaResultado}
        />
      </Secao>

      <Secao titulo={`Subtarefas (${filhas.length})`} className="mt-4">
        <SubtarefasPainel parentId={task.id} filhas={filhas} />
      </Secao>

      <Secao titulo={`Relações (${saindo.length + entrando.length})`} className="mt-4">
        <RelacoesPainel
          taskId={task.id}
          saindo={saindo}
          entrando={entrando}
          opcoesDestino={outrasTarefas.map((t) => ({ id: t.id, title: t.title }))}
          tituloPorId={tituloPorId}
        />
      </Secao>
    </main>
  );
}

function Secao({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section className={`rounded-xl border border-navy-700 bg-navy-900 p-4 ${className ?? ""}`}>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-bone-300">{titulo}</h2>
      {children}
    </section>
  );
}

/** Aviso de leitura falhada — mesmo contrato de `/`, `/frentes`, `/linha-do-tempo`. */
function NaoConsegui({ id }: { id: string }): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">Tarefa</h1>
      <div
        role="status"
        className="mt-4 rounded-lg border border-state-warning/50 px-4 py-3 text-sm text-bone-100"
      >
        Não consegui ler esta tarefa agora — tente de novo em alguns minutos.
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/tarefa/${id}`}
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
