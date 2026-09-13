"use client";
import { AlertTriangle, CircleSlash2, Lock, Target } from "lucide-react";
import { useContext } from "react";
import { Handle, Position, useViewport, type NodeProps } from "reactflow";

import { GraphSelectionContext } from "@/components/graph/selection-context";
import { SourceIcon } from "@/components/ui/source-icon";
import { corDaFonte } from "@/lib/cor-da-fonte";
import { StatusChip } from "@/components/ui/status-chip";
import type { JanelaCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { SourceKind, Task } from "@/types/canonical";
import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

/** Estado DERIVADO do grafo (não persistido na Task). spec §8.1. */
export interface TaskNodeData {
  task: Task;
  /** Fonte da tarefa (para ícone/badge). */
  sourceKind: SourceKind;
  sourceLabel: string;
  /** Derivado (dag): ≥1 predecessor ainda não 'done' → não acionável. */
  blockedByPredecessor: boolean;
  /** Título do 1º predecessor aberto, para o badge "aguardando: …". */
  blockingPredecessorTitle?: string;
  /** Derivado (dag): participa de ciclo de dependência (erro). */
  inCycle: boolean;
  /** É o rank-0 da lista "hoje" (anel de ênfase gold). */
  isTopToday?: boolean;
  /** Esmaecido por filtro de fonte inativo (§5). */
  isFilteredOut?: boolean;
  // ── v3 (P4): janela do CPM + score de assimetria, calculados no servidor ──
  /** Janela de CPM desta tarefa (`GrafoV3Props.janelas[task.id]`). Ausente = fora do CPM. */
  janela?: JanelaCPM;
  /** Score de assimetria (`GrafoV3Props.scores[task.id]`). `null` = sem átomos declarados. */
  score?: ScoreAssimetria | null;
  /** `true` quando `task.id` está em `GrafoV3Props.critico` — anel vermelho. */
  isCritico?: boolean;
  /** `true` quando `task.id` está em `GrafoV3Props.semDuracao` — usa duração-placeholder. */
  semDuracao?: boolean;
  /**
   * `true` quando `GrafoV3Props.goalId !== null` — existe uma meta e portanto
   * um CPM rodou. Sem isto, um nó sem `janela` (fora do caminho até a meta)
   * simplesmente não mostrava nada, e nada na tela explicava por quê (achado
   * MÉDIO #11 do crítico hostil).
   */
  temMeta?: boolean;
}

/** Node customizado do React Flow. Puro de apresentação. spec §8.1. */
export type TaskNodeProps = NodeProps<TaskNodeData>;

/** Borda por status (spec §1.1). in_progress = 2px, blocked = 1.5px. */
const BORDA_ABERTA = "border border-state-neutral/70";
const FUNDO_ABERTA = "bg-navy-800";

const BORDER_BY_STATUS: Record<string, string> = {
  open: BORDA_ABERTA,
  in_progress: "border-2 border-gold-500",
  blocked: "border-[1.5px] border-state-error",
  done: "border border-state-success/70",
};

const FILL_BY_STATUS: Record<string, string> = {
  open: FUNDO_ABERTA,
  in_progress: FUNDO_ABERTA,
  blocked: FUNDO_ABERTA,
  done: "bg-navy-850",
};

/**
 * Estado desconhecido (valor novo no Postgres, fora da união `TaskStatus`) cai
 * na aparência de "aberta". Não derruba a rota — `.filter(Boolean)` engole o
 * `undefined` —, mas sem isto o nó perde borda e fundo e some no escuro do
 * grafo. Mesma família do conserto de `iconeDaFonte` e `configDoEstado`.
 *
 * Classe de borda do nó; nunca `undefined`, mesmo com estado novo no banco.
 */
export function bordaDoEstado(status: string): string {
  return BORDER_BY_STATUS[status] ?? BORDA_ABERTA;
}

/** Classe de fundo do nó; nunca `undefined`, mesmo com estado novo no banco. */
export function fundoDoEstado(status: string): string {
  return FILL_BY_STATUS[status] ?? FUNDO_ABERTA;
}

export function TaskNode({ data, selected }: TaskNodeProps): JSX.Element {
  const { task, sourceKind, sourceLabel } = data;
  const { selectedTaskId, onSelectTask } = useContext(GraphSelectionContext);
  const cor = corDaFonte(sourceKind);
  const { s1, s2, s3 } = task.priorityHierarq;
  const score = s1 * s2 * s3;

  const isSelected = selected || selectedTaskId === task.id;
  const isBlockedByPred = data.blockedByPredecessor;
  const isDone = task.status === "done";

  /**
   * P4b (achado ALTO #6 do crítico hostil): a `fitView` sem piso de zoom
   * (corrigido em `dependency-graph.tsx`) encolhia o grafo até o texto do nó
   * renderizar a 5–7px de tela. Mesmo com o piso de 0,85, um grafo largo
   * o bastante ainda pode empurrar o zoom abaixo de 0,75 — abaixo disso,
   * detalhe secundário (nota, "aguardando", badge de score) só disputa
   * legibilidade com o que IMPORTA (título + folga): esconder é a régua.
   */
  const { zoom } = useViewport();
  const detalheReduzido = zoom < 0.75;

  const borderClass = data.inCycle
    ? "border-[1.5px] border-state-error"
    : bordaDoEstado(task.status);

  const ariaLabel =
    `${task.title}, status ${task.status}, fonte ${sourceLabel}` +
    (isBlockedByPred && data.blockingPredecessorTitle
      ? `, bloqueada por ${data.blockingPredecessorTitle}`
      : "") +
    (data.inCycle ? ", em ciclo de dependência" : "") +
    (!data.janela && data.temMeta ? ", fora do caminho da meta" : "") +
    (data.semDuracao ? ", estimativa faltando" : "");

  return (
    <div
      role="button"
      tabIndex={data.isFilteredOut ? -1 : 0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectTask(task.id);
        }
      }}
      style={{ height: ALTURA_DO_CARTAO }}
      className={[
        // P4c (achado CRÍTICO #1a): altura FIXA — `nodeH` do layout só é
        // verdade se o card NUNCA crescer com o conteúdo. `overflow-hidden` +
        // `flex flex-col` faz o que não cabe ser cortado em vez de empurrar o
        // rodapé para fora da grade (era isso — o rodapé quebrando em 3-4
        // linhas — que fazia a aresta crítica entrar 108-185px dentro do card
        // seguinte). P4d (achado MÉDIO #6 da rodada 3): a altura agora vem de
        // `style`, não de uma classe Tailwind — `ALTURA_DO_CARTAO`
        // (`@/types/grafo-v3`) é o ÚNICO número, importado também por
        // `layout-do-grafo.ts`/`dependency-graph.tsx`; uma classe
        // `h-[${token}px]` gerada em runtime nunca seria compilada pelo JIT
        // do Tailwind (só lê string literal no código-fonte).
        "relative flex w-[200px] flex-col overflow-hidden rounded-lg py-2 pl-3.5 pr-3 shadow-node transition-[opacity,box-shadow] duration-200 ease-almapetra",
        borderClass,
        fundoDoEstado(task.status),
        isBlockedByPred ? "border-dashed opacity-55" : "",
        data.isFilteredOut ? "pointer-events-none opacity-20" : "",
        data.isTopToday ? "shadow-focus ring-2 ring-gold-400" : "",
        isSelected && !data.isTopToday ? "ring-1 ring-gold-500" : "",
        // v3: anel vermelho do caminho crítico — soma ao anel de ênfase/seleção
        // via `outline` (propriedade CSS diferente de `ring`/box-shadow, então
        // os dois convivem sem um sobrescrever o outro).
        data.isCritico ? "outline outline-2 outline-offset-1 outline-state-error" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Faixa na cor da fonte — o mesmo código de cor da lista "Hoje", para
          que o olho ligue nó e cartão sem precisar ler o rótulo. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${cor.faixa}`}
      />

      {/* P4d (achado ALTO #4 do crítico hostil ROUND 3): quatro handles, não
          dois — uma aresta "pra trás" ou de MESMO rank (sinergia/
          obsolescência que ligam um destino de rank ≤ ao da origem) sempre
          saía por Bottom/entrava por Top, mesmo quando isso obrigava o traço
          a atravessar o PRÓPRIO cartão de origem por dentro para alcançar um
          destino que está ACIMA (penetração medida: 55,3–54,1px). A escolha
          de QUAL par usar por aresta é feita em `dependency-graph.tsx`
          (`handlesDaConexao`, pelo rank relativo) e tem que bater com a
          mesma convenção em `layout-do-grafo.ts` (`calcularDesvio`) — os três
          arquivos comentam um para o outro. Ids distintos, mesma posição
          visual par a par (Top/Top e Bottom/Bottom) — só a direção lógica
          (source/target) muda. */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />
      <Handle
        id="source-top"
        type="source"
        position={Position.Top}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />

      <div className="flex shrink-0 items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          {task.isGoal ? (
            // P4d (achado MÉDIO #7 do crítico hostil ROUND 3): `text-[9px]`
            // rendia 8,93px de tela — abaixo do piso de 12px. `text-xs`
            // (Tailwind, 12px) é o mesmo piso que `StatusChip`/`v3-edge.tsx`
            // já usam.
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-state-error/20 px-1 py-0.5 text-xs font-bold uppercase tracking-wide text-state-error-fg"
              title="Meta do caminho crítico"
            >
              <Target size={10} aria-hidden="true" />
              META
            </span>
          ) : null}
          <span
            className={`truncate text-sm font-medium text-bone-100 ${isDone ? "text-bone-400 line-through" : ""}`}
          >
            {task.title}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {isBlockedByPred ? (
            <Lock
              size={13}
              className="text-state-error-fg"
              aria-hidden="true"
              // P4c (achado CRÍTICO #1a): a linha "aguardando: <título>" saiu
              // do corpo do card (era o que empurrava o rodapé pra 3-4
              // linhas) — o `title` do próprio ícone carrega a mesma
              // informação no hover, sem custo de altura.
            >
              {data.blockingPredecessorTitle ? (
                <title>{`aguardando: ${data.blockingPredecessorTitle}`}</title>
              ) : null}
            </Lock>
          ) : null}
          {data.inCycle ? (
            <AlertTriangle
              size={13}
              className="text-state-error"
              aria-hidden="true"
            />
          ) : null}
          <SourceIcon
            kind={sourceKind}
            label={sourceLabel}
            size={14}
            className={cor.texto}
          />
        </span>
      </div>

      {/* P4b (achado ALTO #6): nota é detalhe SECUNDÁRIO — some abaixo de
          zoom 0,75; só título + folga continuam. P4c (achado CRÍTICO #1a):
          `line-clamp-2` + `min-h-0` dentro do `flex-1` — nunca mais que 2
          linhas, e a altura sobra pro rodapé em vez de empurrá-lo pra fora
          da grade (o card inteiro tem `overflow-hidden` como cinto de
          segurança, mas o alvo é nunca precisar cortar). */}
      {!detalheReduzido && task.notes ? (
        <p className="mt-0.5 min-h-0 flex-1 line-clamp-2 text-xs text-bone-400">
          {task.notes}
        </p>
      ) : (
        <span className="min-h-0 flex-1" aria-hidden="true" />
      )}

      {/* P4c (achado CRÍTICO #1a): rodapé em UMA linha só — nunca quebra.
          `min-w-0 truncate` no lado esquerdo deixa "S 60 · folga: 2 d"
          cortar com reticências em vez de empurrar pro fim da linha; "fora
          do caminho da meta" (frase mais longa do card) virou ícone com
          `title`/`aria-label` em vez de texto por extenso. */}
      <div className="mt-2 flex shrink-0 items-center justify-between gap-1 border-t border-navy-700 pt-1.5">
        {/* P4d (achado ALTO #3 do crítico hostil ROUND 3): a 1ª tentativa deu
            `flex-1` (== `flex: 1 1 0%`) pra folga — e isso foi o CONTRÁRIO do
            que parece: `flex-basis: 0%` faz o item começar do ZERO (o desenho
            de "cresce pra preencher sobra", não de "mantém o conteúdo"); sem
            espaço sobrando (o caso real, sempre sob aperto), ele nunca sai do
            zero, e TODA a redistribuição de encolhimento cai no irmão de
            `flex-basis: auto` (o lado direito) — medido depois do "fix":
            `clientWidth` continuava 0. `shrink-0` é o oposto certo: a folga
            NUNCA encolhe por causa do irmão (mantém sempre o tamanho do seu
            próprio conteúdo); `truncate` fica só como cinto-e-suspensório
            para o caso patológico em que nem isso basta (card mais estreito
            que a própria folga). O lado direito (badge A + chip de status,
            abaixo) é quem cede espaço primeiro. */}
        <span className="flex shrink-0 items-center gap-1.5 truncate font-mono text-sm text-bone-200">
          {!detalheReduzido ? <>S {score}</> : null}
          {data.janela ? (
            // P4b (achado MÉDIO #10): "folga: 2 d" ao lado de "estimativa
            // faltando" afirmava precisão que a duração-placeholder não tem —
            // o "~" avisa que o número é estimado, não medido.
            <span className="truncate text-bone-400">
              · folga: {data.semDuracao ? "~" : ""}
              {data.janela.folga} d
            </span>
          ) : data.temMeta ? (
            // P4b (achado MÉDIO #11): sem isto, um nó fora do caminho até a
            // meta não mostrava folga NEM explicava por quê — parecia bug.
            // P4c (achado CRÍTICO #1a): ícone em vez de frase — a frase
            // sozinha já era a maior causa de quebra de linha do rodapé.
            <span
              title="fora do caminho da meta"
              aria-label="fora do caminho da meta"
              className="inline-flex shrink-0 items-center text-bone-500"
            >
              <CircleSlash2 size={13} aria-hidden="true" />
            </span>
          ) : null}
        </span>
        {/* P4d (achado ALTO #3): `shrink-0` virou `min-w-0 shrink` — este lado
            CEDE antes do da folga. O badge A fica `shrink-0` (curto, "A 6",
            nunca precisa cortar); o `StatusChip` ganha `truncate` própria
            (ver `status-chip.tsx`) — ele que absorve o aperto quando o rótulo
            ("em progresso" etc.) não cabe, nunca o span da folga. */}
        <span className="flex min-w-0 shrink items-center gap-1">
          {!detalheReduzido && data.score ? (
            <span
              title={data.score.porque}
              className="inline-flex shrink-0 items-center rounded-full border border-fonte-notes/45 bg-fonte-notes/10 px-1 py-0.5 font-mono text-xs text-fonte-notes"
            >
              A {data.score.valor}
            </span>
          ) : null}
          <StatusChip status={task.status} className="min-w-0 shrink" />
        </span>
      </div>

      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />
      <Handle
        id="target-bottom"
        type="target"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-navy-600 !bg-navy-500"
      />
    </div>
  );
}
