"use client";
import { ArrowRight, Info, Maximize2, Route, ZoomIn, ZoomOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import { AmostraDeAresta } from "@/components/graph/aresta-svg";
import { GraphSelectionContext } from "@/components/graph/selection-context";
import {
  LayerTogglePanel,
  useCamadasDoGrafo,
  type UseCamadasDoGrafo,
} from "@/components/graph/layer-toggle-panel";
import { TaskNode, type TaskNodeData } from "@/components/graph/task-node";
import { tipografiaDoCartao, ZOOM_MINIMO } from "@/components/graph/tipografia-do-cartao";
import { V3Edge, type V3EdgeData } from "@/components/graph/v3-edge";
import { SourceIcon } from "@/components/ui/source-icon";
import { StatusChip } from "@/components/ui/status-chip";
import {
  arestaEhCritica,
  camadaBaseDeAresta,
  construirArestasVisuais,
  filtrarArestasPorCamada,
  relacoesAcessiveisDaTarefa,
  type ArestaVisual,
  type CamadaGrafo,
} from "@/lib/camadas-do-grafo";
import {
  caixaDosCartoes,
  cartoesForaDaTela,
  enquadramentoComModo,
  enquadramentoDoAlvo,
  type CartaoNaTela,
  type EnquadramentoComModo,
  type Pane,
} from "@/lib/enquadramento";
import {
  CLASSES_DA_BARRA_DO_GRAFO,
  CLASSES_DO_CHIP_FORA_DA_TELA,
} from "@/lib/altura-do-canvas";
import { useReenquadramentoAutomatico } from "@/components/graph/reenquadramento-automatico";
import { handlesDaConexao, zIndexDaAresta } from "@/lib/geometria-da-aresta";
import { layoutDoGrafo, type Ponto } from "@/lib/layout-do-grafo";
import { caixaEstimadaDoTexto, colocarRotulos, type Retangulo } from "@/lib/rotulo-da-aresta";
import { useFecharPopover } from "@/lib/use-fechar-popover";
import type { Source, SourceKind, Task, TaskEdge } from "@/types/canonical";
import {
  alturaDoCartao,
  ALTURA_DO_CARTAO,
  type GrafoV3Props,
  type ModoDoCartao,
} from "@/types/grafo-v3";

export interface DependencyGraphProps {
  /** Universo de tarefas (modelo canônico). Arestas derivadas de
   *  predecessorIds/successorIds e deduplicadas por (from,to). */
  tasks: Task[];
  /** Fontes (para label/ícone por nó e legenda). */
  sources: Source[];
  /** Filtro ativo (§5). Vazio OU todas = sem filtro (mostra tudo). */
  activeSourceKinds: SourceKind[];
  /** IDs em ciclo (de GET /api/today → excludedCycles). Marca nós como erro. */
  cycleTaskIds?: string[];
  /** IDs da lista "hoje" em ordem de rank (ênfase + sync com a lista). */
  todayTaskIds?: string[];
  /** Seleção compartilhada com TodayList. */
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
  /** Renderiza a lista alternativa acessível em vez do canvas (§7). */
  accessibleFallback?: boolean;
  /** v3 (P4): arestas declaradas + caminho crítico + scores, calculados e serializados no servidor. */
  grafoV3?: GrafoV3Props;
}

/** `GrafoV3Props` vazio — usado quando a página ainda não passa o prop (compat). */
const GRAFO_V3_VAZIO: GrafoV3Props = {
  edges: [],
  critico: [],
  janelas: {},
  semDuracao: [],
  emCiclo: [],
  goalId: null,
  duracaoTotal: 0,
  scores: {},
};

const BG_DOTS = "#13253D"; // navy-800

/**
 * P4g (decisão D1 do crítico hostil ROUND 6): DOIS enquadramentos, com os
 * nomes do que fazem — e **nenhum deles usa `fitView`**.
 *
 * O que ele mediu na rodada 6: `fitView({ padding: 0,3, minZoom: 0,85, nodes:
 * críticos })`. No ReactFlow `minZoom` é PISO, não teto — quando a cadeia
 * crítica precisava de MENOS que 0,85 a lib aproximava ALÉM do enquadramento e
 * as pontas saíam: `task-setup` a −13px do topo, `task-deploy` a 813px num
 * pane de 800, **1 de 3 cartões críticos na tela** em 390, 768, 1280 e 1440.
 * Pior: a 1280 nenhum chip aparecia para contar o que faltava.
 *
 * Agora o enquadramento é uma função PURA (`@/lib/enquadramento`) aplicada com
 * `setViewport`: o zoom é CLAMPADO entre o piso do canvas e um TETO, e a
 * função devolve, no mesmo objeto, se a caixa coube inteira. Quando não coube,
 * o chip é obrigatório e diz quantos ficaram fora.
 *
 *   • "Caminho crítico" — enquadra a caixa dos nós críticos (teto 1,2× para
 *     não virar lupa quando a cadeia é curta).
 *   • "Ver tudo" — enquadra a caixa INTEIRA (teto 1×, nunca ampliar). Quando
 *     nem no piso de zoom ela cabe, o botão passa a se chamar "Ver o máximo
 *     possível" — porque é o que ele faz.
 */
/** Folga de cada lado do pane, em px de TELA. */
const PADDING_DO_ENQUADRAMENTO_PX = 24;
const ZOOM_MAXIMO_DO_CRITICO = 1.2;
const ZOOM_MAXIMO_DO_TUDO = 1;
/** Teto do canvas (o mesmo `maxZoom` do `<ReactFlow>`). */
export const ZOOM_MAXIMO_DO_CANVAS = 1.8;

/** O que o operador escolheu enquadrar — lembrado entre refluxos (achado MÉDIO #10). */
export type AlvoDoEnquadramento = "critico" | "tudo";

export function opcoesDoAlvo(alvo: AlvoDoEnquadramento): { padding: number; zoomMax: number } {
  return {
    padding: PADDING_DO_ENQUADRAMENTO_PX,
    zoomMax: alvo === "critico" ? ZOOM_MAXIMO_DO_CRITICO : ZOOM_MAXIMO_DO_TUDO,
  };
}

/**
 * Colunas por linha dentro de um rank (decisão D2), pela largura REAL do pane.
 * Um rank de 16 raízes numa fileira só media 4.096px de mundo — nenhum zoom
 * legível enquadra isso.
 */
export function maxColunasParaLargura(larguraDoPane: number): number {
  if (larguraDoPane >= 1024) return 6;
  if (larguraDoPane >= 640) return 4;
  return 3;
}

export const NODE_W = 200;
/**
 * P4d (achado MÉDIO #6 do crítico hostil ROUND 3): `ALTURA_DO_CARTAO`
 * (`@/types/grafo-v3`) é o ÚNICO número — antes este arquivo, `layout-do-
 * grafo.ts` e `task-node.tsx` tinham cada um o seu `112` hardcoded,
 * coincidindo só por disciplina manual (o crítico provou: 96/160 "passavam"
 * do mesmo jeito porque nada comparava um contra o outro).
 */
const NODE_H = ALTURA_DO_CARTAO;
export const GAP_X = 56;
export const GAP_Y = 84;
/** Piso de `gapY` (item 1b da spec) — mesmo valor que `layout-do-grafo.ts` já impõe internamente. */
export const GAP_Y_MINIMO = 60;

const nodeTypes: NodeTypes = { task: TaskNode };
const edgeTypes: EdgeTypes = { v3: V3Edge };

/**
 * Constrói adjacência de precedência (x→y) das DUAS representações de array
 * + as `TaskEdge` `tipo="predecessor"` (v3), com dedup — usada só para o
 * LAYOUT (profundidade/coluna) e para `blockedByPredecessor`. As arestas
 * VISUAIS (as 6 do grafo v3) vêm de `construirArestasVisuais` (`camadas-do-grafo.ts`).
 */
function buildPrecedence(
  tasks: Task[],
  edgesV3: TaskEdge[] = [],
): {
  edges: { from: string; to: string }[];
  predsOf: Map<string, string[]>;
} {
  const ids = new Set(tasks.map((t) => t.id));
  const seen = new Set<string>();
  const edges: { from: string; to: string }[] = [];
  const predsOf = new Map<string, string[]>();

  const add = (from: string, to: string): void => {
    if (!ids.has(from) || !ids.has(to)) return;
    const key = `${from}|${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
    const arr = predsOf.get(to);
    if (arr) arr.push(from);
    else predsOf.set(to, [from]);
  };

  for (const t of tasks) {
    for (const p of t.predecessorIds) add(p, t.id);
    for (const s of t.successorIds) add(t.id, s);
  }
  for (const e of edgesV3) {
    if (e.tipo === "predecessor") add(e.origem, e.destino);
  }
  return { edges, predsOf };
}

/** Profundidade topológica (camada) por precedência, com guarda de ciclo. */
function computeDepths(
  tasks: Task[],
  predsOf: Map<string, string[]>,
): Map<string, number> {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const depth = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // ciclo → corta
    visiting.add(id);
    let d = 0;
    for (const p of predsOf.get(id) ?? []) d = Math.max(d, depth(p) + 1);
    visiting.delete(id);
    memo.set(id, d);
    return d;
  };

  for (const t of tasks) depth(t.id);
  return memo;
}

/**
 * Quem sabe medir o pane e aplicar o enquadramento. Vive dentro do
 * `ReactFlowProvider` (é de lá que `setViewport` vem) e devolve, pelo
 * callback, a PREVISÃO que aplicou — quem desenha o chip precisa saber se a
 * caixa coube inteira.
 */
function useEnquadramentos({
  paneRef,
  cartoesParaAltura,
  criticoSet,
  alturaDeCartao,
  alturaDeMapa,
  aoEnquadrar,
}: {
  paneRef: RefObject<HTMLDivElement>;
  cartoesParaAltura: (altura: number, alvo: AlvoDoEnquadramento) => CartaoNaTela[];
  criticoSet: ReadonlySet<string>;
  alturaDeCartao: number;
  alturaDeMapa: number;
  aoEnquadrar: (alvo: AlvoDoEnquadramento, previsao: EnquadramentoComModo) => void;
}): (alvo: AlvoDoEnquadramento, duracaoMs?: number) => void {
  const { setViewport, getViewport } = useReactFlow();
  return useCallback(
    (alvo: AlvoDoEnquadramento, duracaoMs = 200) => {
      const el = paneRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // P4h (achado ALTO #2): quando a caixa não cabe inteira, o pan MAXIMIZA
      // cartões inteiros em vez de centrar — e o viewport vivo entra como
      // candidato, para o botão nunca entregar menos do que já estava na tela.
      const previsao = enquadramentoDoAlvo({
        cartoesParaAltura: (altura) => cartoesParaAltura(altura, alvo),
        pane: { largura: r.width, altura: r.height },
        opcoes: opcoesDoAlvo(alvo),
        alturaCartao: alturaDeCartao,
        alturaMapa: alturaDeMapa,
        criticoIds: criticoSet,
        prioridade: alvo === "critico" ? "criticos" : "inteiros",
        viewportAtual: getViewport(),
      });
      aoEnquadrar(alvo, previsao);
      void setViewport(
        { x: previsao.x, y: previsao.y, zoom: previsao.zoom },
        { duration: duracaoMs },
      );
    },
    [
      paneRef,
      cartoesParaAltura,
      criticoSet,
      alturaDeCartao,
      alturaDeMapa,
      aoEnquadrar,
      setViewport,
      getViewport,
    ],
  );
}

/** Lê o zoom real do canvas e entrega ao pai — é ele que decide o MODO do cartão. */
function ObservadorDeZoom({ onZoom }: { onZoom: (zoom: number) => void }): null {
  const { zoom } = useViewport();
  useEffect(() => {
    onZoom(zoom);
  }, [zoom, onZoom]);
  return null;
}

function ControlesDoGrafo({
  enquadrar,
  temCritico,
  rotuloDoVerTudo,
}: {
  enquadrar: (alvo: AlvoDoEnquadramento) => void;
  temCritico: boolean;
  rotuloDoVerTudo: string;
}): JSX.Element {
  const { zoomIn, zoomOut } = useReactFlow();
  // P4g (achado MÉDIO #8): 44px é o alvo mínimo da régua de UI/UX da casa, e
  // nenhum controle do grafo chegava lá a 390 (zoom 32×32, "Caminho crítico"
  // 136×32) enquanto o resto do app já usava 44/48.
  const icone =
    "flex h-11 w-11 items-center justify-center rounded-md border border-navy-600 bg-navy-850/95 text-bone-300 hover:bg-navy-700 hover:text-bone-100";
  // Abaixo de 640px o RÓTULO recolhe (o nome acessível continua no
  // `aria-label`): a barra inteira cabe numa linha a 390 em vez de comer
  // 200px de canvas com três linhas de botão.
  const comTexto =
    "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md border border-navy-600 bg-navy-850/95 px-3 text-xs font-medium text-bone-200 hover:bg-navy-700 hover:text-bone-100";

  return (
    /* `shrink-0`: a barra virou uma linha só de altura fixa (achado BAIXO #7)
       — quem cede largura é o chip, nunca um controle de 44px. */
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" className={icone} aria-label="Diminuir zoom" onClick={() => void zoomOut()}>
        <ZoomOut size={16} />
      </button>
      <button type="button" className={icone} aria-label="Aumentar zoom" onClick={() => void zoomIn()}>
        <ZoomIn size={16} />
      </button>
      {temCritico ? (
        <button
          type="button"
          className={comTexto}
          aria-label="Caminho crítico"
          data-acao="caminho-critico"
          onClick={() => enquadrar("critico")}
        >
          <Route size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Caminho crítico</span>
        </button>
      ) : null}
      <button
        type="button"
        className={comTexto}
        aria-label={rotuloDoVerTudo}
        // Gancho estável para ferramenta de medição: o RÓTULO muda (decisão
        // D2) e um seletor por texto deixaria de achar o botão exatamente no
        // caso em que ele mais importa.
        data-acao="ver-tudo"
        onClick={() => enquadrar("tudo")}
      >
        <Maximize2 size={16} aria-hidden="true" />
        <span className="hidden sm:inline">{rotuloDoVerTudo}</span>
      </button>
    </div>
  );
}

const LEGEND: { label: string; className: string }[] = [
  { label: "aberta", className: "bg-state-neutral" },
  { label: "em progresso", className: "bg-gold-500" },
  { label: "bloqueada", className: "bg-state-error" },
  { label: "concluída", className: "bg-state-success" },
  { label: "aguardando pred.", className: "border border-dashed border-bone-400" },
  { label: "ciclo", className: "bg-state-error" },
];

/**
 * P4b (achado ALTO #5, 2ª parte): as 3 arestas que mais importam pra ler o
 * grafo à primeira vista. As outras 3 (correlação/sinergia/predecessor comum)
 * já têm amostra completa no painel "Camadas" — não duplicar as 6 aqui.
 */
const TIRA_ARESTAS: { label: string; camada: Exclude<CamadaGrafo, "critico">; critica: boolean }[] = [
  { label: "caminho crítico", camada: "sucessao", critica: true },
  { label: "sucessão", camada: "sucessao", critica: false },
  { label: "obsolescência", camada: "obsolescencia", critica: false },
];

/**
 * P4c (achado ALTO #4 + MÉDIO #6 do crítico hostil ROUND 2): a legenda
 * SEMPRE visível cobria 24% do card da META a 1280 e o rodapé inteiro a
 * 390 — e a 390 ela nem aparecia (`hidden md:flex` na tira de arestas), então
 * a régua "mostrar em toda largura" também falhava. As duas causas têm a
 * MESMA cura: virar um pill colapsável (mesmo padrão de `LayerTogglePanel`),
 * fechado por padrão em QUALQUER largura — nada fica plantado em cima de nó
 * nenhum até o operador pedir, e a tira de 3 arestas passa a existir também a
 * 390 (ela só não aparecia por causa do `md:flex` que sumiu). Mora na camada
 * de controle (`SobreposicaoDoGrafo`), no canto superior esquerdo, ANTES do
 * canvas na ordem do DOM (decisão D9).
 */
function GraphLegend({ fecharSinal }: { fecharSinal: number }): JSX.Element {
  const [expandido, setExpandido] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);

  const fechar = useCallback(() => {
    setExpandido(false);
    // P4d (achado BAIXO #11): o foco volta ao pill que abriu o popover —
    // sem isto, ESC/clique-fora deixava o foco "perdido" no elemento que
    // acabou de sumir da árvore.
    window.requestAnimationFrame(() => pillRef.current?.focus());
  }, []);

  // P4d (achado BAIXO #9): fecha quando o operador clica/toca no canvas
  // (`onPaneClick` em `dependency-graph.tsx` incrementa `fecharSinal`).
  useEffect(() => {
    if (fecharSinal > 0) setExpandido(false);
  }, [fecharSinal]);
  // P4d (achado BAIXO #11): ESC e clique fora também fecham.
  useFecharPopover(expandido, containerRef, fechar);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={pillRef}
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={expandido}
        // P4g (achado MÉDIO #8): 44px, como todo controle do grafo.
        aria-label="Legenda"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md border border-navy-600 bg-navy-850/90 px-3 text-xs font-medium text-bone-200 shadow-panel"
      >
        <Info size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Legenda</span>
      </button>
      {expandido ? (
        <div
          role="dialog"
          aria-label="Legenda do grafo"
          className="absolute left-0 top-full z-40 mt-1.5 flex w-64 max-w-[85vw] flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-navy-600 bg-navy-850/95 px-3 py-2 text-xs text-bone-300 shadow-panel"
        >
          <span className="inline-flex w-full items-center gap-1 text-bone-400">
            precedência <ArrowRight size={12} /> posterioridade
          </span>
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${l.className}`} />
              {l.label}
            </span>
          ))}
          {/* P4c (achado MÉDIO #6): antes `hidden md:flex` — a 390px a tira
              simplesmente não existia. Agora o painel inteiro é sob-demanda
              em qualquer largura, então a tira aparece em UMA linha (a régua
              do achado) sempre que o operador abre "Legenda". */}
          <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-navy-700 pt-1.5">
            {TIRA_ARESTAS.map((a) => (
              <span key={a.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <AmostraDeAresta camada={a.camada} critica={a.critica} />
                {a.label}
              </span>
            ))}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Quantas tarefas NÃO cabem inteiras no pane, e o atalho honesto para trazê-las.
 *
 * P4g (decisão D2, achado ALTO #2 do crítico hostil ROUND 6): o teste era de
 * INTERSEÇÃO (`telaX + w*zoom > 0 && telaX < rect.width`) — meio cartão
 * contava como visível. Medido: 40 tarefas a 1280 com 30 cartões inteiros, 10
 * CORTADOS (um deles a META) e o chip AUSENTE; a 390 o chip dizia 16 enquanto
 * 22 não estavam inteiros. Agora o teste é de CONTENÇÃO
 * (`cartoesForaDaTela`), com a mesma tolerância de 0,5px da medição — o chip
 * nunca some enquanto existir cartão cortado.
 *
 * E quando o enquadramento bateu no PISO do zoom (`cabeInteiro: false`), o
 * chip para de prometer o impossível e diz o que está acontecendo: "6 de 200
 * na tela; o zoom mínimo é o limite".
 */
function ChipForaDaTela({
  paneRef,
  cartoes,
  criticoIds,
  alvo,
  cabeInteiro,
  enquadrar,
  rotuloDoVerTudo,
}: {
  paneRef: RefObject<HTMLDivElement>;
  /**
   * Os cartões em px de MUNDO, vindos do LAYOUT — não de `getNodes()` da lib.
   * Medido: quando o modo do cartão vira mapa, o layout muda de posição sem o
   * viewport mudar, e o store da lib só é atualizado DEPOIS dos efeitos desta
   * camada — a conta do chip congelava no estado anterior e anunciava "3 de 5
   * do caminho crítico fora" com 0 de fato fora. A fonte certa é a mesma que
   * desenhou os nós.
   */
  cartoes: readonly CartaoNaTela[];
  criticoIds: readonly string[];
  alvo: AlvoDoEnquadramento;
  cabeInteiro: boolean;
  enquadrar: (alvo: AlvoDoEnquadramento) => void;
  /** O MESMO texto do botão — o chip nunca oferece "Ver tudo" quando o botão já sabe que não cabe. */
  rotuloDoVerTudo: string;
}): JSX.Element | null {
  const { x, y, zoom } = useViewport();
  const [conta, setConta] = useState({ fora: 0, total: 0, foraCriticos: 0, totalCriticos: 0 });
  const chaveCritico = criticoIds.join(",");

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const criticos = new Set(chaveCritico ? chaveCritico.split(",") : []);
    const fora = cartoesForaDaTela(
      cartoes,
      { x, y, zoom },
      { largura: rect.width, altura: rect.height },
    );
    setConta({
      fora: fora.length,
      total: cartoes.length,
      foraCriticos: fora.filter((id) => criticos.has(id)).length,
      totalCriticos: cartoes.filter((c) => criticos.has(c.id)).length,
    });
    // Reavalia sempre que o viewport muda (fit, pan, zoom) ou os nós mudam de
    // posição/quantidade (filtro, modo do cartão, novo dado).
  }, [paneRef, cartoes, x, y, zoom, chaveCritico]);

  if (conta.fora === 0) return null;

  const texto =
    alvo === "tudo" && !cabeInteiro
      ? `${conta.total - conta.fora} de ${conta.total} na tela; o zoom mínimo é o limite`
      : alvo === "critico" && conta.foraCriticos > 0
        ? `${conta.foraCriticos} de ${conta.totalCriticos} do caminho crítico fora da tela · ${rotuloDoVerTudo}`
        : `${conta.fora} ${conta.fora === 1 ? "tarefa fora" : "tarefas fora"} da tela · ${rotuloDoVerTudo}`;

  return (
    <button
      type="button"
      data-chip-fora-da-tela={conta.fora}
      onClick={() => enquadrar("tudo")}
      title={texto}
      // Uma LINHA só, e com base 0 (`CLASSES_DO_CHIP_FORA_DA_TELA`): a 390px
      // a mensagem quebrava em três, e mesmo numa linha o chip ainda empurrava
      // a barra para baixo. O texto recortado mantém o número na frente (é ele
      // que importa) e o resto continua no `title`.
      className={CLASSES_DO_CHIP_FORA_DA_TELA}
    >
      <span className="truncate">{texto}</span>
    </button>
  );
}

/**
 * P4c (achado CRÍTICO #1b, "cinto e suspensório"): `task-node.tsx` tem altura
 * FIXA (`style={{ height: ALTURA_DO_CARTAO }}`, P4d rodada 3), então `NODE_H`
 * já devia bater com a realidade — mas este componente MEDE a altura de
 * verdade que o ReactFlow relatou depois do
 * 1º layout (`useNodesInitialized` fica `true` só depois que o
 * ResizeObserver interno mede cada nó) e devolve a MAIOR altura encontrada.
 * Se algum dia o CSS do card mudar e a altura fixa parar de bater, o layout
 * se realinha sozinho em vez de voltar ao bug original (aresta entrando
 * dentro do card). Só sobe (nunca desce abaixo do valor do token) — depois da 1ª
 * medição o valor estabiliza (a altura do card é CSS fixo, não muda de novo).
 */
function MedirAlturaReal({ onAltura }: { onAltura: (altura: number) => void }): null {
  const nodesInitialized = useNodesInitialized();
  const { getNodes } = useReactFlow();
  useEffect(() => {
    if (!nodesInitialized) return;
    const alturas = getNodes()
      .map((n) => n.height ?? 0)
      .filter((h) => h > 0);
    if (alturas.length === 0) return;
    onAltura(Math.max(...alturas));
  }, [nodesInitialized, getNodes, onAltura]);
  return null;
}

/**
 * P4g (decisões D9/D10 + achados MÉDIO #8 e BAIXO #14): a BARRA de controle do
 * grafo — pills "Legenda"/"Camadas", chip de fora-da-tela e os botões.
 *
 * Ela saiu de cima do canvas. Na rodada 6 o crítico mediu o chip COBRINDO um
 * cartão na rota `/` a 1280: qualquer camada flutuante sobre o canvas tapa
 * conteúdo em algum enquadramento, e "reposicionar" só troca qual cartão é
 * tapado. Agora a barra é irmã do canvas no fluxo normal — 0px² contra cartões
 * por construção, não por sorte —, e o canvas recebe a altura que sobra.
 *
 * Continua ANTES do canvas na ordem do DOM (é isso que põe os controles nas
 * primeiras paradas de Tab) e continua dentro do `ReactFlowProvider`, que é de
 * onde os hooks da lib leem o estado.
 */
function BarraDoGrafo({
  paneRef,
  assinaturaDoFiltro,
  criticoIds,
  fecharPaineisSinal,
  larguraDoPane,
  alturaDoPane,
  colunasDoLayout,
  onAltura,
  onZoom,
  camadas,
  cartoesParaAltura,
  criticoSet,
  alturaDeCartao,
  alturaDeMapa,
  alvo,
  cabeInteiro,
  aoEnquadrar,
  rotuloDoVerTudo,
  cartoes,
}: {
  paneRef: RefObject<HTMLDivElement>;
  assinaturaDoFiltro: string;
  criticoIds: readonly string[];
  fecharPaineisSinal: number;
  larguraDoPane: number;
  alturaDoPane: number;
  colunasDoLayout: number;
  onAltura: (altura: number) => void;
  onZoom: (zoom: number) => void;
  camadas: UseCamadasDoGrafo;
  cartoesParaAltura: (altura: number, alvo: AlvoDoEnquadramento) => CartaoNaTela[];
  criticoSet: ReadonlySet<string>;
  alturaDeCartao: number;
  alturaDeMapa: number;
  alvo: AlvoDoEnquadramento;
  cabeInteiro: boolean;
  aoEnquadrar: (alvo: AlvoDoEnquadramento, previsao: EnquadramentoComModo) => void;
  rotuloDoVerTudo: string;
  cartoes: readonly CartaoNaTela[];
}): JSX.Element {
  const { ativas: camadasAtivas, alternar: alternarCamada } = camadas;
  const enquadrar = useEnquadramentos({
    paneRef,
    cartoesParaAltura,
    criticoSet,
    alturaDeCartao,
    alturaDeMapa,
    aoEnquadrar,
  });
  const nodesInitialized = useNodesInitialized();
  const temCritico = criticoIds.length > 0;

  /**
   * Fit inicial e reenquadramento quando o filtro de fontes ou o tamanho do
   * pane mudam (o tamanho muda o número de colunas — D2).
   *
   * P4g (achado MÉDIO #10): o alvo reenquadrado é o que o OPERADOR escolheu
   * por último — lido na hora de aplicar, nunca como gatilho.
   *
   * P4h (achado CRÍTICO #1 da rodada 8): a lista de dependências deste efeito
   * tinha `enquadrar` dentro, e a identidade de `enquadrar` muda a cada troca
   * de MODO do cartão. Resultado medido: todo zoom do operador que cruzava
   * 0,85 era desfeito em menos de 400ms (6 cliques, 6 vezes, em 1280 e 1440) e
   * o modo CARTÃO não existia no produto. A lista agora é uma função pura
   * (`dependenciasDoReenquadramento`) e o gesto do operador é soberano.
   *
   * P4i (achado ALTO #2 da rodada 8): o tamanho do pane entra QUANTIZADO —
   * 2 px de resize devolviam o zoom do teto (1,8) ao enquadramento (0,849) nas
   * quatro larguras de desktop. Ver `reenquadramento-automatico.ts`.
   */
  useReenquadramentoAutomatico({
    nodesInitialized,
    assinaturaDoFiltro,
    larguraDoPane,
    alturaDoPane,
    colunasDoLayout,
    enquadrar,
    alvo,
  });

  return (
    <>
      <MedirAlturaReal onAltura={onAltura} />
      <ObservadorDeZoom onZoom={onZoom} />
      {/* Uma fila só, de altura FIXA (`ALTURA_DA_BARRA_DO_GRAFO_PX`). Antes
          ela quebrava sozinha, e o chip descendo para a 2ª linha engordava a
          barra em 50px — o chip encolhia o canvas que ele mede (achado BAIXO
          #7: `pane=541` com chip, `591` sem). Agora os seis controles ficam
          fixos e só o chip cede largura (`basis-0` + `truncate`). */}
      <div className={CLASSES_DA_BARRA_DO_GRAFO}>
        <GraphLegend fecharSinal={fecharPaineisSinal} />
        <LayerTogglePanel
          ativas={camadasAtivas}
          alternar={alternarCamada}
          fecharSinal={fecharPaineisSinal}
        />
        <ControlesDoGrafo
          enquadrar={enquadrar}
          temCritico={temCritico}
          rotuloDoVerTudo={rotuloDoVerTudo}
        />
        {/* O chip vem DEPOIS dos botões na ordem do DOM de propósito: o texto
            dele cita "caminho crítico" e "Ver tudo", e um seletor por texto (o
            que toda ferramenta de medição usa) pegaria o chip em vez do botão
            se ele viesse antes. */}
        <ChipForaDaTela
          paneRef={paneRef}
          criticoIds={criticoIds}
          alvo={alvo}
          cabeInteiro={cabeInteiro}
          enquadrar={enquadrar}
          cartoes={cartoes}
          rotuloDoVerTudo={rotuloDoVerTudo}
        />
      </div>
    </>
  );
}

/**
 * Fallback acessível: lista topológica navegável por teclado (spec §7.2).
 *
 * Rodada 10 (achado ALTO 3): passou a carregar **as cinco camadas**, e não só
 * a sucessão. `data-lb-tarefa`, `data-lb-titulo` e `data-lb-camada` existem
 * para a guarda de navegador casar linha a linha o que o canvas DESENHA com o
 * que esta lista DIZ — sem parsear frase (é a mesma disciplina do
 * `data-lb-linha` da P5). O `aria-label` do cartão do canvas começa pelo
 * título, e a guarda confere que as duas superfícies nomeiam a mesma tarefa.
 */
function AccessibleGraphList({
  tasks,
  sourceByKind,
  depths,
  arestas,
  selectedTaskId,
  onSelectTask,
}: {
  tasks: Task[];
  sourceByKind: Map<string, Source>;
  depths: Map<string, number>;
  arestas: readonly ArestaVisual[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
}): JSX.Element {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ordered = [...tasks].sort(
    (a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0),
  );
  const titleOf = (id: string): string => byId.get(id)?.title ?? id;
  const sourceOf = (t: Task): Source | undefined => {
    for (const s of sourceByKind.values()) if (s.id === t.sourceId) return s;
    return undefined;
  };

  return (
    <ol
      aria-label="Grafo de dependências (lista acessível em ordem topológica)"
      className="h-full space-y-1 overflow-y-auto p-3"
    >
      {ordered.map((t) => {
        const src = sourceOf(t);
        const relacoes = relacoesAcessiveisDaTarefa({
          taskId: t.id,
          arestas,
          tituloDe: titleOf,
        });
        return (
          <li key={t.id} data-lb-tarefa={t.id} data-lb-titulo={t.title}>
            <button
              type="button"
              onClick={() => onSelectTask(t.id)}
              aria-pressed={selectedTaskId === t.id}
              className={`flex w-full flex-col gap-1 rounded-md border border-navy-700 px-3 py-2 text-left hover:bg-navy-800 ${
                selectedTaskId === t.id ? "bg-navy-700" : "bg-navy-850"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-bone-100">
                {src ? <SourceIcon kind={src.kind} label={src.label} size={14} /> : null}
                {t.title}
                <StatusChip status={t.status} />
              </span>
              {relacoes.length === 0 ? (
                <span className="text-xs text-bone-400" data-lb-camada="nenhuma">
                  sem ligação com outra tarefa
                </span>
              ) : (
                relacoes.map((r) => (
                  <span
                    key={r.camada}
                    data-lb-camada={r.camada}
                    className="text-xs text-bone-400"
                  >
                    {r.rotulo}: {r.itens.join(", ")}
                  </span>
                ))
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function DependencyGraph(props: DependencyGraphProps): JSX.Element {
  const {
    tasks,
    sources,
    activeSourceKinds,
    cycleTaskIds = [],
    todayTaskIds = [],
    selectedTaskId = null,
    onSelectTask,
    accessibleFallback = false,
    grafoV3 = GRAFO_V3_VAZIO,
  } = props;

  const camadas = useCamadasDoGrafo();
  const camadasAtivas = camadas.ativas;
  const router = useRouter();
  /**
   * O CANVAS (o retângulo que o ReactFlow ocupa), observado para largura,
   * altura e reenquadramento. P4g: a barra de controle saiu de cima dele
   * (achado BAIXO #14), então "o pane" não é mais o container inteiro — e a
   * conta do chip e do enquadramento tem de usar o retângulo real, senão o
   * cartão de cima "cabe" no papel e fica atrás da barra na tela.
   */
  const paneRef = useRef<HTMLDivElement>(null);

  /**
   * P4f (decisão D2): a largura REAL do pane decide quantas colunas cabem numa
   * linha do rank. Observada aqui (e não dentro do `<ReactFlow>`) porque a
   * aba "Grafo" no celular monta a `section` com `display:none` — o container
   * existe com 0×0 e nada reenquadraria quando ele vira visível.
   */
  const [pane, setPane] = useState<Pane>({ largura: 1024, altura: 600 });
  useEffect(() => {
    const el = paneRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        // Só reage a mudança de verdade (>1px): ruído de sub-pixel do próprio
        // enquadramento reentraria em loop.
        setPane((atual) =>
          Math.abs(atual.largura - width) > 1 || Math.abs(atual.altura - height) > 1
            ? { largura: width, altura: height }
            : atual,
        );
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const larguraDoPane = pane.largura;
  const maxColunas = maxColunasParaLargura(larguraDoPane);

  /**
   * P4g (achado MÉDIO #6): o MODO do cartão sai do zoom real do canvas, e é
   * ele que decide a ALTURA — que decide o layout, que decide a caixa que o
   * enquadramento usa. Uma cadeia só, com uma fonte só.
   */
  const [zoomAtual, setZoomAtual] = useState(1);
  const aoMudarZoom = useCallback((z: number) => setZoomAtual(z), []);
  const modo: ModoDoCartao = tipografiaDoCartao(zoomAtual).modo;

  /** Alvo escolhido pelo operador + se a última tentativa coube (achados #10 e D1/D2). */
  // [Minor do CodeRabbit, rodada 10] com o caminho crítico VAZIO, começar em
  // "critico" fazia `cartoesParaAltura` cair para todos os nós enquanto
  // `opcoesDoAlvo("critico")` ainda punha o teto de zoom em 1,2 — um grafo
  // pequeno abria a 1,2 em vez do teto 1 do "tudo". O alvo inicial passa a
  // sair do que existe.
  const [alvoDoEnquadramento, setAlvoDoEnquadramento] = useState<AlvoDoEnquadramento>(
    grafoV3.critico.length > 0 ? "critico" : "tudo",
  );
  const [cabeInteiro, setCabeInteiro] = useState(true);
  /**
   * P4h (achado BAIXO #6): o último enquadramento APLICADO, guardado só para o
   * colocador de rótulos saber que pedaço do mundo está na tela. Nunca
   * realimenta o reenquadramento — é estado de leitura, não gatilho.
   */
  const [ultimoEnquadramento, setUltimoEnquadramento] = useState<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const aoEnquadrar = useCallback((alvo: AlvoDoEnquadramento, previsao: EnquadramentoComModo) => {
    setAlvoDoEnquadramento(alvo);
    setCabeInteiro(previsao.cabeInteiro);
    setUltimoEnquadramento({ x: previsao.x, y: previsao.y, zoom: previsao.zoom });
  }, []);

  const criticoSet = useMemo(() => new Set(grafoV3.critico), [grafoV3.critico]);
  const semDuracaoSet = useMemo(() => new Set(grafoV3.semDuracao), [grafoV3.semDuracao]);

  const sourceByKind = useMemo(() => {
    const m = new Map<string, Source>();
    for (const s of sources) m.set(s.kind, s);
    return m;
  }, [sources]);

  const sourceById = useMemo(() => {
    const m = new Map<string, Source>();
    for (const s of sources) m.set(s.id, s);
    return m;
  }, [sources]);

  // Vazio = sem filtro (o `SourceFilter` já normaliza "todas marcadas" para []).
  // Havia aqui um `&& activeSourceKinds.length < 5` — o mesmo número mágico de
  // "kinds que existiam em julho". Com 6 fontes no banco, marcar 5 desligava o
  // filtro em silêncio; e com 5 marcadas de 6, o grafo mostrava as 6.
  const filterActive = activeSourceKinds.length > 0;
  const isOut = useCallback(
    (kind: SourceKind): boolean => filterActive && !activeSourceKinds.includes(kind),
    [filterActive, activeSourceKinds],
  );

  const { edges: precedenceEdges, predsOf } = useMemo(
    () => buildPrecedence(tasks, grafoV3.edges),
    [tasks, grafoV3.edges],
  );
  const depths = useMemo(() => computeDepths(tasks, predsOf), [tasks, predsOf]);
  const cycleSet = useMemo(() => new Set(cycleTaskIds), [cycleTaskIds]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const topTodayId = todayTaskIds[0] ?? null;
  const temMeta = grafoV3.goalId !== null;

  const handleSelect = useCallback(
    (id: string | null) => onSelectTask?.(id),
    [onSelectTask],
  );

  /**
   * P4d (achado BAIXO #9 do crítico hostil ROUND 3): "Legenda"/"Camadas"
   * abertos ficavam plantados sobre cartões do grafo até o operador clicar
   * de novo no próprio pill — sem nenhum jeito de "sair" tocando no canvas.
   * Escolha: fecha ao clicar/tocar no canvas (a opção que o achado oferece,
   * mais simples que empurrar o layout inteiro ou reposicionar o painel para
   * um canto garantidamente livre de nós, que não existe em todo grafo).
   * Um contador simples — cada clique no pane incrementa, os dois painéis
   * ouvem via `useEffect` (efeito colateral: fecha, não precisa saber POR
   * QUE mudou) — mais barato que levantar o estado `expandido` de cada
   * painel para cá.
   */
  const [fecharPaineisSinal, setFecharPaineisSinal] = useState(0);
  const handlePaneClick = useCallback(() => {
    handleSelect(null);
    setFecharPaineisSinal((n) => n + 1);
  }, [handleSelect]);

  /*
   * Layout (v3, P4b — 13/09/2026, corrige o achado CRÍTICO #1 do crítico
   * hostil): linha = rank por caminho mais longo (a MESMA união de
   * precedência que o CPM usa), coluna = ordem ESTÁVEL dentro do rank
   * (crítico primeiro, depois por id) — nunca `i % COLS_MAX` sobre o índice
   * de encontro no array. A v2 (grade com sub-linhas de transbordo) empilhava
   * "Daily standup" (sem predecessor/sucessor algum) na MESMA coluna e entre
   * duas linhas da cadeia setup→build→deploy só por coincidência de
   * transbordo — a aresta crítica passava reto por cima do card dele. Prova:
   * `tests/unit/layout-do-grafo.test.ts`. Módulo puro em `layout-do-grafo.ts`.
   */
  /** P4c (achado CRÍTICO #1b): altura real medida pós-render — só sobe. */
  const [alturaMedida, setAlturaMedida] = useState(NODE_H);
  const aoMedirAltura = useCallback(
    (altura: number) => setAlturaMedida((atual) => (altura > atual ? altura : atual)),
    [],
  );
  /**
   * Altura do cartão no modo dado. No modo cartão vale a maior entre o token e
   * a medida real (cinto e suspensório do achado CRÍTICO #1b); no modo mapa
   * vale a pastilha — a medida real do modo cartão não se aplica a ela.
   */
  const alturaDoModo = useCallback(
    (m: ModoDoCartao): number => (m === "mapa" ? alturaDoCartao("mapa") : Math.max(alturaMedida, NODE_H)),
    [alturaMedida],
  );
  const nodeHEfetivo = alturaDoModo(modo);

  // ── As 6 arestas (P4 §5): construídas a partir de tasks+edges+critico —
  //    movido pra ANTES do layout (era depois) porque o layout agora também
  //    precisa dos PARES origem→destino das 6 camadas pro desvio geométrico
  //    (achado CRÍTICO #2, cobertura completa — ver `todasArestas` abaixo).
  //    Filtro por camada ativa e dimming continuam onde estavam, no `edges` useMemo.
  const arestasVisuais = useMemo(
    () =>
      construirArestasVisuais({
        tasks,
        edges: grafoV3.edges,
        criticoIds: criticoSet,
        selectedTaskId,
      }),
    [tasks, grafoV3.edges, criticoSet, selectedTaskId],
  );

  const paramsDoLayout = useMemo(
    () => ({
      ids: tasks.map((t) => t.id),
      edges: precedenceEdges.map((e) => ({ origem: e.from, destino: e.to })),
      criticoIds: criticoSet,
      nodeW: NODE_W,
      gapX: GAP_X,
      gapY: Math.max(GAP_Y, GAP_Y_MINIMO),
      // D2: quantas colunas cabem numa linha do rank, pela largura do pane.
      maxColunas,
      // O RANK continua preso só à precedência (`edges`, acima) — misturar
      // sinergia/correlação ali criaria precedência falsa. Mas o
      // ROTEAMENTO vale para as 6 camadas: é ele que dá canal e faixa
      // próprios a cada aresta (D5). Passa o `id` visual: duas arestas
      // entre o mesmo par são duas rotas, nunca uma só.
      todasArestas: arestasVisuais.map((a) => ({
        id: a.id,
        origem: a.origem,
        destino: a.destino,
      })),
    }),
    [tasks, precedenceEdges, criticoSet, arestasVisuais, maxColunas],
  );
  const layout = useMemo(
    () => layoutDoGrafo({ ...paramsDoLayout, nodeH: nodeHEfetivo }),
    [paramsDoLayout, nodeHEfetivo],
  );

  /**
   * Os cartões (px de mundo) do alvo pedido, PARA UMA ALTURA DE CARTÃO — é o que
   * `enquadramentoComModo` precisa para resolver o ponto fixo "altura → caixa
   * → zoom → modo → altura". Reusa o layout vivo quando a altura é a atual;
   * só recalcula quando o enquadramento pergunta pelo outro modo (um clique,
   * nunca um frame de render).
   */
  const cartoesParaAltura = useCallback(
    (altura: number, alvo: AlvoDoEnquadramento): CartaoNaTela[] => {
      const daAltura =
        Math.abs(altura - nodeHEfetivo) < 0.5
          ? layout
          : layoutDoGrafo({ ...paramsDoLayout, nodeH: altura });
      const querCritico = alvo === "critico" && criticoSet.size > 0;
      const nos = [...daAltura.nodes.values()].filter((n) => !querCritico || criticoSet.has(n.id));
      return (nos.length > 0 ? nos : [...daAltura.nodes.values()]).map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        largura: NODE_W,
        altura,
      }));
    },
    [layout, paramsDoLayout, nodeHEfetivo, criticoSet],
  );

  /** Os cartões em px de mundo — a MESMA fonte que desenha os nós. */
  const cartoes = useMemo<CartaoNaTela[]>(
    () => cartoesParaAltura(nodeHEfetivo, "tudo"),
    [cartoesParaAltura, nodeHEfetivo],
  );

  /**
   * P4g (decisão D2): o rótulo do botão é PREVISTO, não descoberto depois. Se
   * nem no piso do zoom a caixa inteira cabe, o botão não promete "Ver tudo" —
   * ele diz o que faz.
   */
  const rotuloDoVerTudo = useMemo(() => {
    const previsao = enquadramentoComModo({
      caixaParaAltura: (altura) => caixaDosCartoes(cartoesParaAltura(altura, "tudo")),
      pane,
      opcoes: opcoesDoAlvo("tudo"),
      alturaCartao: alturaDoModo("cartao"),
      alturaMapa: alturaDoModo("mapa"),
    });
    return previsao.cabeInteiro ? "Ver tudo" : "Ver o máximo possível";
  }, [cartoesParaAltura, pane, alturaDoModo]);

  const nodes = useMemo<Node<TaskNodeData>[]>(() => {
    return tasks.map((task) => {
      const posicao = layout.nodes.get(task.id);
      const src = sourceById.get(task.sourceId);
      const kind: SourceKind = src?.kind ?? "calendar";
      const openPred = task.predecessorIds
        .map((pid) => byId.get(pid))
        .find((p) => p && p.status !== "done");

      return {
        id: task.id,
        type: "task",
        position: { x: posicao?.x ?? 0, y: posicao?.y ?? 0 },
        draggable: false,
        selected: selectedTaskId === task.id,
        data: {
          task,
          sourceKind: kind,
          sourceLabel: src?.label ?? "fonte",
          blockedByPredecessor: Boolean(openPred),
          blockingPredecessorTitle: openPred?.title,
          inCycle: cycleSet.has(task.id),
          isTopToday: topTodayId === task.id,
          isFilteredOut: isOut(kind),
          // v3 (P4): janela do CPM + score de assimetria + flags calculadas no servidor.
          janela: grafoV3.janelas[task.id],
          score: grafoV3.scores[task.id],
          isCritico: criticoSet.has(task.id),
          semDuracao: semDuracaoSet.has(task.id),
          // P4b (achado MÉDIO #11): existe meta para o CPM medir folga contra?
          temMeta,
        },
      };
    });
  }, [
    tasks,
    layout,
    sourceById,
    byId,
    cycleSet,
    topTodayId,
    selectedTaskId,
    isOut,
    grafoV3.janelas,
    grafoV3.scores,
    criticoSet,
    semDuracaoSet,
    temMeta,
  ]);

  /**
   * P4f (decisão D5): id da aresta visual → ROTA pronta (canal + faixa
   * próprios), calculada pelo layout com conhecimento de TODAS as arestas.
   * A chave é o id da aresta, não o par `origem|destino`: duas arestas entre
   * o mesmo par (a correlação e a obsolescência do fixture) são objetos
   * distintos e precisam de canais distintos — chaveá-las pelo par foi o que
   * as colocou uma exatamente em cima da outra.
   */
  const rotaPorAresta = useMemo(() => {
    const m = new Map<string, Ponto[]>();
    for (const a of layout.edges) m.set(a.id, a.pontos);
    return m;
  }, [layout]);

  /**
   * P4g (achado MÉDIO #5): onde cada rótulo de % da sinergia pode ficar,
   * decidido por UM colocador que conhece todos os rótulos e todos os cartões
   * — nunca "no meio do segmento mais longo e que o resto se vire". A fonte
   * entra arredondada em 1/4 de px: o colocador não precisa refazer a conta a
   * cada frame de uma animação de zoom.
   */
  const fonteDoRotuloPx = Math.round(tipografiaDoCartao(zoomAtual).dadoPx * 4) / 4;
  const rotulos = useMemo(() => {
    const visiveis = filtrarArestasPorCamada(arestasVisuais, camadasAtivas);
    const pedidos = visiveis.flatMap((a) => {
      const pontos = rotaPorAresta.get(a.id);
      if (!pontos || camadaBaseDeAresta(a) !== "sinergia" || typeof a.pesoPercent !== "number") {
        return [];
      }
      const caixa = caixaEstimadaDoTexto(`${a.pesoPercent}%`, fonteDoRotuloPx);
      return [{ id: a.id, pontos, largura: caixa.largura, altura: caixa.altura }];
    });
    if (pedidos.length === 0) return new Map<string, Ponto | null>();
    const cartoes: Retangulo[] = [...layout.nodes.values()].map((n) => ({
      x0: n.x,
      y0: n.y,
      x1: n.x + NODE_W,
      y1: n.y + nodeHEfetivo,
    }));
    // O pedaço do MUNDO que está na tela depois do último enquadramento —
    // candidatos ali dentro vêm primeiro (achado BAIXO #6: 17/17 rótulos fora
    // do painel a 200 nós).
    const v = ultimoEnquadramento;
    const regiaoVisivel: Retangulo | undefined =
      v && v.zoom > 0
        ? {
            x0: -v.x / v.zoom,
            y0: -v.y / v.zoom,
            x1: (pane.largura - v.x) / v.zoom,
            y1: (pane.altura - v.y) / v.zoom,
          }
        : undefined;
    return colocarRotulos(pedidos, cartoes, { regiaoVisivel });
  }, [
    arestasVisuais,
    camadasAtivas,
    rotaPorAresta,
    layout,
    nodeHEfetivo,
    fonteDoRotuloPx,
    ultimoEnquadramento,
    pane,
  ]);

  const edges = useMemo<Edge<V3EdgeData>[]>(() => {
    const visiveis = filtrarArestasPorCamada(arestasVisuais, camadasAtivas);
    const mapeadas = visiveis.flatMap((aresta) => {
      const pontos = rotaPorAresta.get(aresta.id);
      // Sem rota = uma das pontas não está no layout (a RPC pode entregar
      // ponta solta). Não desenha — nunca inventa geometria.
      if (!pontos) return [];
      const dimmed =
        isOut(sourceById.get(byId.get(aresta.origem)?.sourceId ?? "")?.kind ?? "calendar") &&
        isOut(sourceById.get(byId.get(aresta.destino)?.sourceId ?? "")?.kind ?? "calendar");
      const critica = camadasAtivas.has("critico") && arestaEhCritica(aresta);
      const camada = camadaBaseDeAresta(aresta);
      const { sourceHandle, targetHandle } = handlesDaConexao(layout.nodes, aresta.origem, aresta.destino);
      return [
        {
          id: aresta.id,
          source: aresta.origem,
          target: aresta.destino,
          sourceHandle,
          targetHandle,
          type: "v3",
          focusable: false,
          // A camada de pintura vem de `zIndexDaAresta` (função pura e
          // testada): a obsolescência sobe acima dos nós para o ❌ nunca
          // depender só do recuo para aparecer.
          zIndex: zIndexDaAresta(camada),
          style: { opacity: dimmed ? 0.15 : 1 },
          data: {
            id: aresta.id,
            origem: aresta.origem,
            destino: aresta.destino,
            camada,
            critica,
            destacadaPeloSelecionado: aresta.destacadaPeloSelecionado,
            pesoPercent: aresta.pesoPercent,
            pontos,
            rotulo: rotulos.get(aresta.id),
          },
        },
      ];
    });
    // Duas arestas podem convergir no MESMO cartão e se sobrepor no trecho
    // final — quem desenha por último fica por cima. Sem ordenar, a ordem era
    // "a que apareceu primeiro no array de tarefas", o que enterrou uma aresta
    // CRÍTICA atrás de uma sucessão comum. Desenhar por último = por cima:
    // crítica > destacada > tipos raros > sucessão comum.
    const prioridade = (e: (typeof mapeadas)[number]): number => {
      if (e.data.critica) return 4;
      if (e.data.destacadaPeloSelecionado) return 3;
      if (e.data.camada !== "sucessao") return 2;
      return 1;
    };
    return [...mapeadas].sort((a, b) => prioridade(a) - prioridade(b));
  }, [arestasVisuais, camadasAtivas, byId, sourceById, isOut, rotaPorAresta, layout, rotulos]);

  /**
   * P4g (achado BAIXO #15): Enter abre `/tarefa/[id]`. A navegação é injetada
   * aqui (não dentro do cartão) para `TaskNode` seguir puro de apresentação —
   * e para o cartão continuar valendo UMA parada de Tab, sem um link extra.
   */
  const handleAbrir = useCallback(
    (id: string) => router.push(`/tarefa/${id}`),
    [router],
  );

  const selectionValue = useMemo(
    () => ({ selectedTaskId, onSelectTask: handleSelect, onAbrirTarefa: handleAbrir }),
    [selectedTaskId, handleSelect, handleAbrir],
  );

  if (accessibleFallback) {
    return (
      <GraphSelectionContext.Provider value={selectionValue}>
        <AccessibleGraphList
          tasks={tasks}
          sourceByKind={sourceByKind}
          depths={depths}
          arestas={arestasVisuais}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleSelect}
        />
      </GraphSelectionContext.Provider>
    );
  }

  const filterSignature = activeSourceKinds.slice().sort().join(",");

  return (
    <GraphSelectionContext.Provider value={selectionValue}>
      <div
        className="relative flex h-full w-full flex-col bg-navy-950"
        role="application"
        aria-label="Grafo de dependências de tarefas"
      >
        <ReactFlowProvider>
          {/* P4g (decisão D9 + achado BAIXO #14): a barra de controle vem
              ANTES do canvas na ordem do DOM (é isso que põe os controles nas
              primeiras paradas de Tab) e FORA dele no layout — nenhum controle
              fica plantado sobre um cartão. Fica dentro do Provider, de onde
              os hooks da lib leem o estado. */}
          <BarraDoGrafo
            paneRef={paneRef}
            assinaturaDoFiltro={filterSignature}
            criticoIds={grafoV3.critico}
            fecharPaineisSinal={fecharPaineisSinal}
            larguraDoPane={pane.largura}
            alturaDoPane={pane.altura}
            colunasDoLayout={maxColunas}
            onAltura={aoMedirAltura}
            onZoom={aoMudarZoom}
            camadas={camadas}
            cartoesParaAltura={cartoesParaAltura}
            criticoSet={criticoSet}
            alturaDeCartao={alturaDoModo("cartao")}
            alturaDeMapa={alturaDoModo("mapa")}
            alvo={alvoDoEnquadramento}
            cabeInteiro={cabeInteiro}
            aoEnquadrar={aoEnquadrar}
            rotuloDoVerTudo={rotuloDoVerTudo}
            cartoes={cartoes}
          />
          <div ref={paneRef} className="relative min-h-0 w-full flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              // P4f (decisão D9): cada cartão vale UMA parada de Tab. O wrapper
              // `.react-flow__node` da lib também é focável por padrão — eram
              // duas paradas por cartão, e a de fora não tinha nome nenhum. A
              // parada que fica é a de dentro (`role="button"` + `aria-label`
              // com título, estado, folga, META e caminho crítico).
              nodesFocusable={false}
              elementsSelectable
              // P4f (achado BAIXO #9): o piso do canvas é o piso do modo mapa —
              // abaixo de `ZOOM_MINIMO` a compensação de fonte satura e o texto
              // voltaria a encolher.
              minZoom={ZOOM_MINIMO}
              maxZoom={ZOOM_MAXIMO_DO_CANVAS}
              // Sem o prop de enquadramento automático da lib: o fit inicial é
              // o MESMO "Caminho crítico"/"Ver tudo" dos botões — nunca um
              // terceiro caminho, e nunca `fitView` (decisão D1).
              proOptions={{ hideAttribution: true }}
              onNodeClick={(_, node) => handleSelect(node.id)}
              onPaneClick={handlePaneClick}
            >
              <Background color={BG_DOTS} gap={22} size={1} />
            </ReactFlow>
          </div>
        </ReactFlowProvider>
      </div>
    </GraphSelectionContext.Provider>
  );
}