import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { env } from "@/config/env";
import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { descendentesDe, tiposBloqueadosPorCandidata } from "@/core/prioritize/candidatas";
import { elosDePrecedencia } from "@/core/prioritize/elos-de-precedencia";
import { scoreAssimetria } from "@/core/prioritize/assimetria";
import { herancaEfetiva } from "@/core/prioritize/heranca";
import { avisarHumano } from "@/lib/avisar-humano";
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
    // [Checagem 8 (B11), rodada 11] a falha não para no `console.error`: vai
    // ao destino humano (`avisar-humano.ts`). `void` de propósito — avisar
    // não pode segurar a tela de erro que o operador precisa ver agora.
    void avisarHumano({ onde: "/tarefa/[id]", alvo: id, causa: erro });
    return <NaoConsegui id={id} />;
  }

  const task = tasks.find((t) => t.id === id);
  if (!task) notFound();

  // Mesma escolha determinística de goal que `app/page.tsx`/`linha-do-tempo`.
  const goalId =
    [...tasks].filter((t) => t.isGoal === true).sort((a, b) => a.id.localeCompare(b.id))[0]?.id ??
    null;
  const metaVigente =
    goalId === null
      ? null
      : { id: goalId, title: tasks.find((t) => t.id === goalId)?.title ?? goalId };
  const cpm = caminhoCritico(tasks, edges, goalId);
  // [BAIXO #7, rodada 5] `scoreAssimetria` agora devolve o par
  // `{ valor, motivo }`: a tela precisa distinguir "ninguém declarou os
  // átomos" de "os átomos estão lá, mas a conta não fecha" — antes as duas
  // situações mostravam a mesma frase ("Sem átomos declarados"), e a segunda
  // mandava o operador re-declarar o que já estava salvo.
  const resultadoScore = scoreAssimetria(task, tasks, edges, cpm);
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

  // [ALTO A5, rodada 11] OS ELOS QUE O CRONOGRAMA USA E A LISTA ESCONDIA.
  // `caminhoCritico` soma 3 fontes (`predecessorIds` ∪ `successorIds` ∪
  // arestas `predecessor`); a lista "Relações" mostrava só as arestas. Medido
  // em `/tarefa/task-build`: o caminho crítico `task-setup → task-build →
  // task-deploy` era INVISÍVEL na mesma tela que estampa "folga 0 · crítico".
  // As duas leem `elosDePrecedencia` agora; os que não têm aresta por trás
  // entram na lista como linha somente-leitura, com o motivo escrito.
  const idsDasArestas = new Set([...saindo, ...entrando].map((e) => e.id));
  const elosDerivados = elosDePrecedencia(tasks, edges)
    .filter(
      (elo) =>
        (elo.origem === task.id || elo.destino === task.id) &&
        (elo.arestaId === null || !idsDasArestas.has(elo.arestaId)),
    )
    .map((elo) => ({ origem: elo.origem, destino: elo.destino }));

  // [MÉDIO A6, rodada 11] prevenir antes de avisar: nem a mãe nem o destino
  // oferecem o que o servidor recusaria.
  const descendentes = descendentesDe(task.id, tasks);
  const opcoesDeMae = outrasTarefas.filter((t) => !descendentes.has(t.id));
  const bloqueiosPorCandidata = tiposBloqueadosPorCandidata(task.id, tasks, edges);
  const opcoesDestino = outrasTarefas.map((t) => ({
    id: t.id,
    title: t.title,
    bloqueadaPara: bloqueiosPorCandidata.get(t.id) ?? [],
  }));
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
          // [BAIXO #6, rodada 6] alvo de toque de 44 px (era 20 px a 390).
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-bone-400 hover:text-gold-300"
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
        {/* [MÉDIO #4, rodada 12] o relógio do servidor viaja com o HTML: sem
            ele, o "há 1 min" calculado na hidratação discordava do "agora
            mesmo" que o servidor escreveu, e o React descartava a árvore. */}
        <NotasPainel taskId={task.id} notas={notasDaTarefa} agora={Date.now()} />
      </Secao>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Secao titulo="Status">
          <StatusForm taskId={task.id} statusAtual={task.status} />
        </Secao>

        {/* [MÉDIO A7, rodada 11] "Meta (goal do caminho crítico)" era sigla
            em cima de jargão numa página em português. O título diz o que é;
            o subtítulo explica o conceito uma vez. */}
        <Secao titulo="Meta (o alvo final do cronograma)">
          {/* [MÉDIO #3, rodada 12] a meta VIGENTE (pelo título, não pelo id)
              vai junto: era ela que a tela escondia atrás de "vale a de menor
              id" enquanto duas tarefas se declaravam o alvo final. Sai da
              MESMA escolha que o cronograma faz logo acima (`goalId`). */}
          <MetaForm
            taskId={task.id}
            isGoal={task.isGoal === true}
            metaVigente={metaVigente}
          />
          {janela ? (
            /* [MÉDIO A7] `ES 0 · EF 3 · LS 0 · LF 3` não tinha glossário em
               lugar nenhum da tela. Cada sigla é traduzida na primeira (e
               única) aparição, e "folga" ganhou a unidade que o cartão do
               grafo (`graph/task-node.tsx`) já usava — checagem 11 da régua:
               um termo por conceito, em toda a interface. */
            <p className="mt-2 text-xs text-bone-400">
              Janela desta tarefa no cronograma — começo mais cedo (ES) {janela.es} ·
              fim mais cedo (EF) {janela.ef} · começo mais tarde (LS) {janela.ls} ·
              fim mais tarde (LF) {janela.lf} · folga {janela.folga} dias
              {cpm.critico.has(task.id) ? (
                <span className="text-gold-300">
                  {" "}
                  · no caminho crítico (atrasar esta tarefa atrasa a meta)
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-bone-400">
              Fora do caminho crítico calculado agora — atrasar esta tarefa não mexe na
              data da meta.
            </p>
          )}
        </Secao>

        <Secao titulo="Duração (estimativa p80 — o prazo que acerta em 8 de 10 vezes)">
          <DuracaoForm taskId={task.id} estimativaDias={task.estimativaDias ?? null} />
        </Secao>

        <Secao titulo="Mãe (hierarquia)">
          <MaeForm
            taskId={task.id}
            parentIdAtual={task.parentId ?? null}
            opcoes={opcoesDeMae.map((t) => ({ id: t.id, title: t.title }))}
            descendentesOcultas={outrasTarefas.length - opcoesDeMae.length}
          />
        </Secao>
      </div>

      {/* [MÉDIO A7] "Átomos do score de assimetria" não diz nada a quem não
          conhece o modelo; a tradução entra aqui, uma vez. */}
      <Secao
        titulo="Átomos do score de assimetria (as três notas que geram a prioridade)"
        className="mt-4"
      >
        <AtomosForm
          taskId={task.id}
          assimetriaAtual={task.assimetria ?? null}
          score={resultadoScore.valor}
          motivo={resultadoScore.motivo}
          heranca={herancaResultado}
        />
      </Secao>

      <Secao titulo={`Subtarefas (${filhas.length})`} className="mt-4">
        <SubtarefasPainel parentId={task.id} filhas={filhas} />
      </Secao>

      {/* A contagem inclui os elos derivados: era ela que dizia "Relações (2)"
          enquanto o cronograma usava 4 (ALTO A5). */}
      <Secao
        titulo={`Relações (${saindo.length + entrando.length + elosDerivados.length})`}
        className="mt-4"
      >
        <RelacoesPainel
          taskId={task.id}
          saindo={saindo}
          entrando={entrando}
          elosDerivados={elosDerivados}
          opcoesDestino={opcoesDestino}
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
