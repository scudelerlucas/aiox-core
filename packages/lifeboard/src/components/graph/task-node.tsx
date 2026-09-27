"use client";
import { AlertTriangle, CircleSlash2, Lock, Target } from "lucide-react";
import { useContext } from "react";
import { Handle, Position, useViewport, type NodeProps } from "reactflow";

import { GraphSelectionContext } from "@/components/graph/selection-context";
import { tipografiaDoCartao, tituloSeraCortado } from "@/components/graph/tipografia-do-cartao";
import { SourceIcon } from "@/components/ui/source-icon";
import { corDaFonte } from "@/lib/cor-da-fonte";
import { configDoEstado, StatusChip } from "@/components/ui/status-chip";
import type { JanelaCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { SourceKind, Task } from "@/types/canonical";
import { alturaDoCartao } from "@/types/grafo-v3";

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
  const { selectedTaskId, onSelectTask, onAbrirTarefa } = useContext(GraphSelectionContext);
  const cor = corDaFonte(sourceKind);
  const { s1, s2, s3 } = task.priorityHierarq;
  const score = s1 * s2 * s3;

  const isSelected = selected || selectedTaskId === task.id;
  const isBlockedByPred = data.blockedByPredecessor;
  const isDone = task.status === "done";

  /**
   * P4f (decisão D3 + achados BAIXO #9/#10 do crítico hostil ROUND 4): zoom
   * semântico. Abaixo de 0,85 o cartão vira PASTILHA (título em 1 linha, ponto
   * de status, META se for o caso — sem S, sem A, sem folga) e a fonte é
   * compensada pelo zoom, para que o texto de TELA nunca caia abaixo de
   * 11,4px. A rodada 4 escondia detalhe abaixo de 0,75 mas deixava o resto
   * encolher junto com o canvas: a 0,30 (alcançável só com zoom-out manual) o
   * texto media 3,6px. Regra única em `tipografia-do-cartao.ts`.
   */
  const { zoom } = useViewport();
  const tipo = tipografiaDoCartao(zoom);
  const modoMapa = tipo.modo === "mapa";
  const estado = configDoEstado(task.status);

  const borderClass = data.inCycle
    ? "border-[1.5px] border-state-error"
    : bordaDoEstado(task.status);

  /**
   * P4g (achado MÉDIO #9 do crítico hostil ROUND 6): o rótulo acessível dizia
   * `"Configurar ambiente, status done, fonte Agenda Lucas"` — o estado em
   * INGLÊS numa página em português, sem folga, sem META e sem dizer que o
   * cartão está no caminho crítico. Quem ouve a tela recebia menos do que quem
   * olha. Agora ele diz, em português, TUDO o que está visível no cartão — e a
   * tradução do estado é a MESMA string do chip (`configDoEstado().label`),
   * nunca uma segunda lista livre para divergir.
   */
  const partesDoRotulo: string[] = [task.title];
  if (task.isGoal) partesDoRotulo.push("META");
  partesDoRotulo.push(estado.label);
  if (data.isCritico) partesDoRotulo.push("no caminho crítico");
  partesDoRotulo.push(`prioridade S ${score}`);
  if (data.score) partesDoRotulo.push(`assimetria A ${data.score.valor}`);
  if (data.janela) {
    partesDoRotulo.push(`folga ${data.semDuracao ? "aproximada " : ""}${data.janela.folga} dias`);
  }
  partesDoRotulo.push(`fonte ${sourceLabel}`);
  if (isBlockedByPred && data.blockingPredecessorTitle) {
    partesDoRotulo.push(`bloqueada por ${data.blockingPredecessorTitle}`);
  }
  if (data.inCycle) partesDoRotulo.push("em ciclo de dependência");
  if (!data.janela && data.temMeta) partesDoRotulo.push("fora do caminho da meta");
  if (data.semDuracao) partesDoRotulo.push("estimativa faltando");
  partesDoRotulo.push("Enter abre a tarefa");
  const ariaLabel = partesDoRotulo.join(", ");

  /**
   * P4f (decisão D4 + D11): linha 1 do rodapé é UM texto só, montado por
   * partes — o separador " · " só existe quando os DOIS lados existem (o
   * "bullet órfão" que o crítico achou no LOD: "· folga: 0 d" começando com
   * um ponto solto). Nunca trunca: se um dia não couber, quem cede é a
   * ALTURA do cartão (o token `ALTURA_DO_CARTAO`), não o número.
   */
  const partesDaLinha1: string[] = [`S ${score}`];
  if (data.janela) {
    partesDaLinha1.push(`folga: ${data.semDuracao ? "~" : ""}${data.janela.folga} d`);
  }
  const linha1 = partesDaLinha1.join(" · ");

  const tituloComum = `text-bone-100 ${isDone ? "text-bone-400 line-through" : ""}`;

  /**
   * P4h (achado MÉDIO #5): o caminho SEM MOUSE até o nome inteiro. O `title`
   * do SVG/HTML só existe para quem tem ponteiro; quem navega por teclado (Tab
   * até o cartão, Espaço para marcar) recebia "Revisar o …" e nada mais.
   * Quando o cartão está SELECIONADO **e** o nome de fato não coube, um painel
   * abaixo do cartão mostra o título inteiro, quebrando linha. Sem seleção, ou
   * com nome curto, nada aparece — o ruído seria pior que o corte.
   */
  const nomeCortado = tituloSeraCortado(task.title, {
    modo: tipo.modo,
    tituloPx: tipo.tituloPx,
    dadoPx: tipo.dadoPx,
    temMeta: task.isGoal,
  });
  const mostrarNomeInteiro = isSelected && nomeCortado;

  return (
    <div
      role="button"
      tabIndex={data.isFilteredOut ? -1 : 0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      // P4g (achado BAIXO #15): Enter ABRE a tarefa (é o caminho de teclado até
      // o nome inteiro, que o `title` só entregava ao mouse); Espaço
      // seleciona, como sempre.
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onAbrirTarefa(task.id);
          return;
        }
        if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          onSelectTask(task.id);
        }
      }}
      // P4g (achado MÉDIO #6): a altura vem do MODO. No modo mapa o cartão é
      // uma pastilha — esconder o conteúdo e manter 180px de altura era pedir
      // 1.764px de mundo para mostrar 40 pastilhas de 44.
      style={{ height: alturaDoCartao(tipo.modo) }}
      className={[
        // Altura vinda de `alturaDoCartao(modo)` (`@/types/grafo-v3`) — a
        // ÚNICA fonte, lida também por `layout-do-grafo.ts` (passo de linha) e
        // `dependency-graph.tsx` (enquadramento). `overflow-hidden` é cinto de segurança do
        // CARTÃO (não do rodapé: nenhum span de dado do rodapé corta — D4).
        // `overflow-hidden` é cinto do CARTÃO, mas ele também cortaria o
        // painel de nome inteiro (achado MÉDIO #5) — por isso ele só vale
        // enquanto o painel não está aberto.
        mostrarNomeInteiro
          ? "relative flex w-[200px] flex-col rounded-lg py-2 pl-3.5 pr-3 shadow-node transition-[opacity,box-shadow] duration-200 ease-almapetra"
          : "relative flex w-[200px] flex-col overflow-hidden rounded-lg py-2 pl-3.5 pr-3 shadow-node transition-[opacity,box-shadow] duration-200 ease-almapetra",
        borderClass,
        fundoDoEstado(task.status),
        isBlockedByPred ? "border-dashed opacity-55" : "",
        data.isFilteredOut ? "pointer-events-none opacity-20" : "",
        data.isTopToday ? "shadow-focus ring-2 ring-gold-400" : "",
        isSelected && !data.isTopToday ? "ring-1 ring-gold-500" : "",
        // v3: anel vermelho do caminho crítico — soma ao anel de ênfase/seleção
        // via `outline` (propriedade CSS diferente de `ring`/box-shadow, então
        // os dois convivem sem um sobrescrever o outro). Vale nos DOIS modos:
        // no mapa é justamente ele que diz onde está a cadeia que importa.
        data.isCritico ? "outline outline-2 outline-offset-1 outline-state-error" : "",
        modoMapa ? "justify-center" : "",
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

      {/* P4h (achado MÉDIO #5): o nome inteiro, sem mouse. `aria-hidden`
          porque o `aria-label` do cartão já começa pelo título completo — quem
          ouve a tela receberia o nome duas vezes. */}
      {mostrarNomeInteiro ? (
        <span
          aria-hidden="true"
          data-nome-inteiro={task.title}
          className="absolute left-0 top-full z-50 mt-1 w-[200px] whitespace-normal break-words rounded-md border border-gold-500/60 bg-navy-950/95 px-2 py-1 font-medium text-bone-100 shadow-panel"
          style={{ fontSize: tipo.tituloPx, lineHeight: 1.3 }}
        >
          {task.title}
        </span>
      ) : null}

      {/* Quatro handles: a escolha de QUAL par usar por aresta é de
          `geometria-da-aresta.ts` (`handlesDaConexao`, pela LINHA relativa) e
          é a MESMA que roteia a aresta em `layout-do-grafo.ts` — uma regra, um
          arquivo. Ids distintos, mesma posição visual par a par. */}
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

      {modoMapa ? (
        /* ── MODO MAPA (D3) — pastilha: ponto de status + título numa linha ──
           Sem S, sem A, sem folga: no zoom em que este modo vive, aqueles
           números seriam manchas. O que sobra é o que se lê de longe — quem é
           a tarefa, em que estado está, e se é a META. */
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block shrink-0 rounded-full bg-current ${estado.text}`}
            style={{ height: Math.round(tipo.dadoPx * 0.7), width: Math.round(tipo.dadoPx * 0.7) }}
          />
          {task.isGoal ? (
            <span
              className="inline-flex shrink-0 items-center rounded-full bg-state-error/20 px-1 font-bold uppercase tracking-wide text-state-error-fg"
              style={{ fontSize: tipo.dadoPx, lineHeight: 1.3 }}
            >
              META
            </span>
          ) : null}
          <span
            title={task.title}
            className={`truncate font-medium ${tituloComum}`}
            style={{ fontSize: tipo.tituloPx, lineHeight: 1.3 }}
          >
            {task.title}
          </span>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-start justify-between gap-2">
            {/* P4f (achado MÉDIO #8): no cartão da META o selo fica em LINHA
                PRÓPRIA. Ao lado do título ele comia ~52px dos 174 de
                conteúdo, e "Deploy de produção" passava a pedir 3 linhas —
                com 2 permitidas, o `line-clamp` cortava o nome da meta
                (medido: scrollHeight 57 × clientHeight 38). Em linha própria
                o título recupera a largura inteira e cabe. */}
            <span className={`flex min-w-0 gap-1 ${task.isGoal ? "flex-col items-start" : "items-center"}`}>
              {task.isGoal ? (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-state-error/20 px-1 font-bold uppercase tracking-wide text-state-error-fg"
                  style={{ fontSize: tipo.dadoPx, lineHeight: 1.3 }}
                  title="Meta do caminho crítico"
                >
                  <Target size={10} aria-hidden="true" />
                  META
                </span>
              ) : null}
              {/* P4f (achado MÉDIO #8): o título ganha `title` com o nome
                  INTEIRO — 8 de 11 cartões truncavam sem nenhum jeito de ler o
                  resto. E o cartão da META nunca trunca: ele pode usar 2
                  linhas (é o único nó que o operador precisa reconhecer sem
                  hover). */}
              <span
                title={task.title}
                className={`${task.isGoal ? "line-clamp-2" : "truncate"} min-w-0 font-medium ${tituloComum}`}
                style={{ fontSize: tipo.tituloPx, lineHeight: 1.35 }}
              >
                {task.title}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {isBlockedByPred ? (
                <Lock size={13} className="text-state-error-fg" aria-hidden="true">
                  {data.blockingPredecessorTitle ? (
                    <title>{`aguardando: ${data.blockingPredecessorTitle}`}</title>
                  ) : null}
                </Lock>
              ) : null}
              {data.inCycle ? (
                <AlertTriangle size={13} className="text-state-error" aria-hidden="true" />
              ) : null}
              <SourceIcon kind={sourceKind} label={sourceLabel} size={14} className={cor.texto} />
            </span>
          </div>

          {task.notes ? (
            <p
              className="mt-0.5 min-h-0 flex-1 line-clamp-2 text-bone-400"
              style={{ fontSize: tipo.dadoPx, lineHeight: 1.35 }}
            >
              {task.notes}
            </p>
          ) : (
            <span className="min-h-0 flex-1" aria-hidden="true" />
          )}

          {/* P4f (decisão D4): rodapé em duas linhas, e a de cima é SÓ o dado
              numérico — `S xx · folga: N d`, sem `truncate`, sem
              `overflow:hidden`. Na rodada 4 a folga dividia a linha com o
              badge `A` e truncava em "folga:…" nos dois cartões críticos (e na
              META): o número sumia e sobrava a palavra. Agora quem divide
              linha com o badge é o chip de status, que tem largura previsível;
              se um dia faltar espaço, a linha 2 QUEBRA (flex-wrap) e o cartão
              cresce pelo token — nunca corta um número. */}
          <div className="mt-2 flex shrink-0 flex-col gap-1 border-t border-navy-700 pt-1.5">
            <span
              className="folga block font-mono text-bone-300"
              data-folga={data.janela ? data.janela.folga : ""}
              style={{ fontSize: tipo.dadoPx, lineHeight: 1.35 }}
            >
              {linha1}
              {!data.janela && data.temMeta ? (
                <span
                  title="fora do caminho da meta"
                  aria-label="fora do caminho da meta"
                  className="ml-1 inline-flex items-center align-text-bottom text-bone-400"
                >
                  <CircleSlash2 size={13} aria-hidden="true" />
                </span>
              ) : null}
            </span>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <StatusChip status={task.status} fontSizePx={tipo.dadoPx} />
              {data.score ? (
                <span
                  title={data.score.porque}
                  className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-fonte-notes/45 bg-fonte-notes/10 px-1 py-0.5 font-mono text-fonte-notes"
                  style={{ fontSize: tipo.dadoPx, lineHeight: 1.3 }}
                >
                  A {data.score.valor}
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}

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
