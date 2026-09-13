"use client";
import { ArrowRight, Info, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Background,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeTypes,
  type FitViewOptions,
  type Node,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import { AmostraDeAresta } from "@/components/graph/aresta-svg";
import { GraphSelectionContext } from "@/components/graph/selection-context";
import {
  LayerTogglePanel,
  useCamadasDoGrafo,
} from "@/components/graph/layer-toggle-panel";
import { TaskNode, type TaskNodeData } from "@/components/graph/task-node";
import { V3Edge, type V3EdgeData } from "@/components/graph/v3-edge";
import { SourceIcon } from "@/components/ui/source-icon";
import { StatusChip } from "@/components/ui/status-chip";
import {
  arestaEhCritica,
  camadaBaseDeAresta,
  construirArestasVisuais,
  filtrarArestasPorCamada,
  type CamadaGrafo,
} from "@/lib/camadas-do-grafo";
import { layoutDoGrafo, type NoDoLayout } from "@/lib/layout-do-grafo";
import { useFecharPopover } from "@/lib/use-fechar-popover";
import type { Source, SourceKind, Task, TaskEdge } from "@/types/canonical";
import { ALTURA_DO_CARTAO, type GrafoV3Props } from "@/types/grafo-v3";

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
 * P4b (achado ALTO #6 do crítico hostil): sem piso, o enquadramento encolhia até
 * caber a largura inteira do grafo — a 390px isso derrubava o zoom a ~0,5 e o
 * texto do nó virava 5–7px de tela. `minZoom: 0.85` faz o canvas SCROLLAR/
 * PANAR em vez de encolher além do legível; `task-node.tsx` (LOD) cobre o
 * caso raro de um grafo tão largo que nem 0,85 caiba, escondendo detalhe
 * secundário abaixo de zoom 0,75 em vez de deixar tudo ilegível.
 */
const OPCOES_DE_ENQUADRAMENTO: FitViewOptions = { padding: 0.2, minZoom: 0.85 };

const NODE_W = 200;
/**
 * P4d (achado MÉDIO #6 do crítico hostil ROUND 3): `ALTURA_DO_CARTAO`
 * (`@/types/grafo-v3`) é o ÚNICO número — antes este arquivo, `layout-do-
 * grafo.ts` e `task-node.tsx` tinham cada um o seu `112` hardcoded,
 * coincidindo só por disciplina manual (o crítico provou: 96/160 "passavam"
 * do mesmo jeito porque nada comparava um contra o outro).
 */
const NODE_H = ALTURA_DO_CARTAO;
const GAP_X = 56;
const GAP_Y = 84;
/** Piso de `gapY` (item 1b da spec) — mesmo valor que `layout-do-grafo.ts` já impõe internamente. */
const GAP_Y_MINIMO = 60;

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

/**
 * P4d (achado ALTO #4 do crítico hostil ROUND 3): qual PAR de handles usar
 * para uma aresta, pelo RANK RELATIVO de origem/destino — tem que ser a
 * MESMA regra que `layout-do-grafo.ts` (`calcularDesvio`) usa para calcular
 * `sourceY`/`targetY` (os dois arquivos comentam um para o outro). Sem isto,
 * uma aresta "pra trás" (destino de rank ≤ origem — obsolescência/sinergia
 * que não seguem precedência) sempre saía por Bottom/entrava por Top e
 * atravessava o PRÓPRIO cartão de origem por dentro (penetração medida:
 * 55,3–54,1px).
 */
function handlesDaConexao(
  layoutNodes: ReadonlyMap<string, NoDoLayout>,
  origem: string,
  destino: string,
): { sourceHandle: string; targetHandle: string } {
  const rankOrigem = layoutNodes.get(origem)?.rank ?? 0;
  const rankDestino = layoutNodes.get(destino)?.rank ?? 0;
  if (rankDestino > rankOrigem) return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  if (rankDestino === rankOrigem) return { sourceHandle: "source-top", targetHandle: "target-top" };
  return { sourceHandle: "source-top", targetHandle: "target-bottom" };
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

/** Bounding box (px de mundo) de uma lista de nós do React Flow. */
function bboxDosNos(nodes: readonly Node[]): { width: number; height: number } | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const w = n.width ?? NODE_W;
    const h = n.height ?? NODE_H;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  return { width: maxX - minX, height: maxY - minY };
}

/**
 * Zoom que o enquadramento da lib escolheria para caber `bbox` num contêiner
 * `largura×altura` com o `padding` de `OPCOES_DE_ENQUADRAMENTO` (fração do próprio
 * contêiner) — aproximação da fórmula interna do React Flow, usada só para
 * DECIDIR entre o fit cheio e o fallback (achado ALTO #2), nunca para
 * desenhar nada.
 */
function zoomNecessarioPara(
  bbox: { width: number; height: number },
  largura: number,
  altura: number,
  padding: number,
): number {
  if (bbox.width <= 0 || bbox.height <= 0 || largura <= 0 || altura <= 0) return Infinity;
  const xZoom = largura / (bbox.width * (1 + padding));
  const yZoom = altura / (bbox.height * (1 + padding));
  return Math.min(xZoom, yZoom);
}

/**
 * P4e (achado ALTO #1 do crítico hostil ROUND 4): **a única** implementação de
 * "ajustar à tela" do grafo. Até a rodada 3 existiam duas — a boa, com cadeia
 * de fallback, vivia dentro de `GraphControls` (o botão ⤢), e o chip gold
 * ("N tarefas fora da tela · Ajustar à tela") chamava a API CRUA da lib com as
 * opções genéricas. Resultado medido no fixture: um clique no chip AUMENTAVA o
 * número que ele próprio anuncia (6 → 7 a 1280px, 6 → 9 a 390px) e expulsava
 * `task-setup`/`task-build`/`task-deploy` — o caminho crítico inteiro — da
 * tela. Era o padrão "corrigir um caminho e deixar o gêmeo": a rodada 3
 * consertou o botão e deixou o chip.
 *
 * Agora existe UMA função, e ela é a única no arquivo que chama a API de
 * enquadramento da lib:
 * chip, botão dos controles, enquadramento inicial e reenquadramento (troca de
 * aba/filtro/resize) passam todos por aqui. A régua: tenta o bbox CHEIO; só
 * quando ele bateria no piso de zoom (`minZoom`, o que deixaria o texto do
 * cartão ilegível) cai para o enquadramento estreito — críticos → goal →
 * maior score → bbox total (ver `opcoesDeEnquadramentoFallback`).
 */
function useAjustarATela(
  containerRef: RefObject<HTMLDivElement>,
  opcoesCheio: FitViewOptions,
  opcoesFallback: FitViewOptions,
): (duracaoMs?: number) => void {
  const { fitView, getNodes } = useReactFlow();
  return useCallback(
    (duracaoMs = 200) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const bbox = bboxDosNos(getNodes());
      const padding = OPCOES_DE_ENQUADRAMENTO.padding ?? 0.2;
      const minZoom = OPCOES_DE_ENQUADRAMENTO.minZoom ?? 0.85;
      const zoomCheio =
        rect && bbox ? zoomNecessarioPara(bbox, rect.width, rect.height, padding) : Infinity;
      const opcoes = zoomCheio < minZoom ? opcoesFallback : opcoesCheio;
      void fitView({ duration: duracaoMs, ...opcoes });
    },
    [containerRef, getNodes, fitView, opcoesCheio, opcoesFallback],
  );
}

function GraphControls({ ajustar }: { ajustar: (duracaoMs?: number) => void }): JSX.Element {
  const { zoomIn, zoomOut } = useReactFlow();
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md border border-navy-600 bg-navy-850 text-bone-300 hover:bg-navy-700 hover:text-bone-100";

  return (
    <Panel position="bottom-left" className="flex gap-1">
      <button type="button" className={btn} aria-label="Diminuir zoom" onClick={() => void zoomOut()}>
        <ZoomOut size={16} />
      </button>
      <button type="button" className={btn} aria-label="Ajustar à tela" onClick={() => ajustar()}>
        <Maximize2 size={16} />
      </button>
      <button type="button" className={btn} aria-label="Aumentar zoom" onClick={() => void zoomIn()}>
        <ZoomIn size={16} />
      </button>
    </Panel>
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
 * 390 (ela só não aparecia por causa do `md:flex` que sumiu). `top-left`:
 * fora da área onde o grafo normalmente centraliza o caminho crítico
 * (`opcoesDeEnquadramentoAuto`, que enquadra os nós críticos com padding — o canto
 * superior esquerdo do pane raramente tem nó ali).
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
    <div className="relative" ref={containerRef}>
      <button
        ref={pillRef}
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={expandido}
        className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-navy-600 bg-navy-850/90 px-2.5 text-xs font-medium text-bone-200 shadow-panel"
      >
        <Info size={14} aria-hidden="true" />
        Legenda
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
 * P4c (achado MÉDIO #8 do crítico hostil ROUND 2): a 390px só 5 de 11 nós
 * ficam visíveis depois do fit do caminho crítico (`opcoesDeEnquadramentoAuto`
 * restringe o enquadramento automático aos nós críticos — spec §3.3, decisão
 * deliberada) e nada na tela avisava. Conta quantos nós ficam fora do
 * retângulo do pane (em coordenadas de tela, usando a MESMA transformação
 * que o ReactFlow aplica: `screen = node.position * zoom + viewport.{x,y}`)
 * e mostra um chip com o total + atalho pra "ver tudo".
 */
function ChipForaDaTela({
  containerRef,
  ajustar,
}: {
  containerRef: RefObject<HTMLDivElement>;
  ajustar: (duracaoMs?: number) => void;
}): JSX.Element | null {
  const { getNodes } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const [foraDaTela, setForaDaTela] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    let fora = 0;
    for (const n of getNodes()) {
      const w = n.width ?? NODE_W;
      const h = n.height ?? NODE_H;
      const telaX = n.position.x * zoom + x;
      const telaY = n.position.y * zoom + y;
      const dentro =
        telaX + w * zoom > 0 && telaX < rect.width && telaY + h * zoom > 0 && telaY < rect.height;
      if (!dentro) fora++;
    }
    setForaDaTela(fora);
    // Reavalia sempre que o viewport muda (fit, pan, zoom) ou os nós mudam
    // de posição/quantidade (filtro, novo dado).
  }, [containerRef, getNodes, x, y, zoom]);

  if (foraDaTela === 0) return null;

  return (
    <Panel position="top-center">
      <button
        type="button"
        // P4e (achado ALTO #1 do crítico hostil ROUND 4): este clique chama a
        // MESMA `ajustarATela` do botão ⤢ dos controles (`useAjustarATela`) —
        // com a cadeia de fallback inteira. Antes chamava a API crua da lib: o
        // clique subia o próprio número que o chip anuncia (6→7 a 1280, 6→9 a
        // 390) e jogava setup/build/deploy para fora. O chip continua
        // verdadeiro depois do clique porque `foraDaTela` reage ao viewport
        // (efeito acima, dependências `[x, y, zoom]`) — se ainda sobrar nó
        // fora (grafo largo demais mesmo no piso de zoom), o número mostrado é
        // o REAL, não uma promessa que o enquadramento não entrega.
        onClick={() => ajustar()}
        className="flex items-center gap-1.5 rounded-full border border-gold-500/60 bg-navy-850/95 px-3 py-1.5 text-xs font-medium text-gold-300 shadow-panel"
      >
        {foraDaTela} {foraDaTela === 1 ? "tarefa fora" : "tarefas fora"} da tela · Ajustar à tela
      </button>
    </Panel>
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
 * dentro do card). Só sobe (nunca desce abaixo do fallback) — depois da 1ª
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
 * P4e (achado ALTO #1 do crítico hostil ROUND 4): TODO o enquadramento do
 * grafo mora aqui — o chip gold, o botão ⤢, o fit inicial, o refit ao trocar
 * de filtro e o refit ao mudar de tamanho (troca de aba no celular, resize da
 * janela, painel "Camadas" recolhendo). Uma única `ajustarATela`
 * (`useAjustarATela`), uma única chamada à API da lib no arquivo inteiro: não existe mais
 * "o caminho bom e o gêmeo esquecido".
 *
 * Fit inicial: `useNodesInitialized` em vez do prop homônimo do `<ReactFlow>`
 * — o prop enquadrava com as opções cruas, sem a cadeia de fallback, e era o
 * terceiro caminho divergente. Esperar a medição dos nós (ResizeObserver
 * interno da lib) ainda é mais correto: antes dela o bbox é um palpite.
 */
function EnquadramentoDoGrafo({
  containerRef,
  assinaturaDoFiltro,
  opcoesCheio,
  opcoesFallback,
}: {
  containerRef: RefObject<HTMLDivElement>;
  assinaturaDoFiltro: string;
  opcoesCheio: FitViewOptions;
  opcoesFallback: FitViewOptions;
}): JSX.Element {
  const ajustar = useAjustarATela(containerRef, opcoesCheio, opcoesFallback);
  const nodesInitialized = useNodesInitialized();

  // Fit inicial (assim que os nós têm tamanho medido) + reenquadramento
  // quando o filtro de fontes muda (spec §3.3).
  useEffect(() => {
    if (!nodesInitialized) return;
    const id = window.setTimeout(() => ajustar(200), 60);
    return () => window.clearTimeout(id);
  }, [nodesInitialized, assinaturaDoFiltro, ajustar]);

  /**
   * P4b (achado MÉDIO #8 do crítico hostil): a aba "Grafo" no celular monta a
   * `section` com `hidden` (CSS `display:none`) até o operador tocar a aba —
   * o container do ReactFlow existe no DOM mas com 0×0, e nada reenquadra
   * quando ele vira `flex` (não é montagem nova, é só troca de `display`).
   * `ResizeObserver` no wrapper QUE O PAI CONTROLA (`containerRef`, fora do
   * ReactFlow) pega a mudança de tamanho real e reenquadra — funciona também
   * ao redimensionar a janela ou recolher o painel "Camadas" (#9).
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let largura = 0;
    let altura = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      // Só reenquadra quando o tamanho muda de verdade (>1px) — sem isto,
      // qualquer ruído de sub-pixel do próprio enquadramento reentraria em loop.
      if (width > 0 && height > 0 && (Math.abs(width - largura) > 1 || Math.abs(height - altura) > 1)) {
        largura = width;
        altura = height;
        window.requestAnimationFrame(() => ajustar(150));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, ajustar]);

  return (
    <>
      <ChipForaDaTela containerRef={containerRef} ajustar={ajustar} />
      <GraphControls ajustar={ajustar} />
    </>
  );
}

/** Fallback acessível: lista topológica navegável por teclado (spec §7.2). */
function AccessibleGraphList({
  tasks,
  sourceByKind,
  depths,
  selectedTaskId,
  onSelectTask,
}: {
  tasks: Task[];
  sourceByKind: Map<string, Source>;
  depths: Map<string, number>;
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
        return (
          <li key={t.id}>
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
              <span className="text-xs text-bone-400">
                predecessores: {t.predecessorIds.map(titleOf).join(", ") || "nenhum"}
                {" · "}
                sucessores: {t.successorIds.map(titleOf).join(", ") || "nenhum"}
              </span>
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

  const { ativas: camadasAtivas, alternar: alternarCamada } = useCamadasDoGrafo();
  /** Container real (fora do ReactFlow) observado pelo `RefitOnResize` (achado MÉDIO #8). */
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * P4b — achado descoberto ao verificar o #1 de ponta a ponta: com o layout
   * em rank (1 nó por rank, sem transbordo — a correção do achado CRÍTICO #1)
   * e mais de ~4 tarefas sem predecessor, o rank 0 fica mais largo que o
   * painel inteiro. Um enquadramento genérico centra na MÉDIA de todos os nós — e
   * como o rank 0 é o mais largo, o centro cai longe da coluna 0, deixando o
   * PRÓPRIO caminho crítico (setup→build→deploy) fora da tela ao carregar,
   * atrás de um pan que ninguém sabe que precisa dar. O campo `nodes` das opções
   * (suportado pelo React Flow) restringe o enquadramento automático aos nós
   * críticos quando existem — o resto do grafo continua alcançável por pan/
   * zoom, mas o que a tela abre mostrando é sempre a cadeia que importa.
   *
   * P4d (achado ALTO #2 do crítico hostil ROUND 3): o botão manual "Ajustar
   * à tela" (`GraphControls`) usada a ir para o bbox TOTAL sempre — e quando
   * esse bbox não cabia no piso de zoom (0,85), o clique jogava o PRÓPRIO
   * caminho crítico para fora (6 nós fora virava 7, incluindo task-setup/
   * build/deploy — regressão em relação ao estado inicial, que já mostrava a
   * cadeia). Agora o botão tenta o bbox cheio primeiro e só cai no
   * enquadramento estreito (`opcoesDeEnquadramentoFallback`, abaixo) quando o cheio
   * bateria no piso — nunca troca a cadeia crítica visível por uma tela mais
   * "completa" porém ilegível.
   */
  const opcoesDeEnquadramentoAuto = useMemo<FitViewOptions>(() => {
    if (grafoV3.critico.length === 0) return OPCOES_DE_ENQUADRAMENTO;
    return { ...OPCOES_DE_ENQUADRAMENTO, padding: 0.3, nodes: grafoV3.critico.map((id) => ({ id })) };
  }, [grafoV3.critico]);
  /**
   * P4d (achado ALTO #2): a cadeia de fallback do botão manual quando o bbox
   * total não cabe a 0,85 — críticos primeiro (igual ao fit automático);
   * sem crítico, o(s) nó(s) do GOAL; sem goal, os de MAIOR score de
   * assimetria; só então (nada disso existe) aceita o bbox total mesmo,
   * apoiado no piso de zoom para continuar legível.
   */
  const opcoesDeEnquadramentoFallback = useMemo<FitViewOptions>(() => {
    if (grafoV3.critico.length > 0) {
      return { ...OPCOES_DE_ENQUADRAMENTO, padding: 0.3, nodes: grafoV3.critico.map((id) => ({ id })) };
    }
    if (grafoV3.goalId) {
      return { ...OPCOES_DE_ENQUADRAMENTO, padding: 0.3, nodes: [{ id: grafoV3.goalId }] };
    }
    const comScore = Object.entries(grafoV3.scores).filter(
      (par): par is [string, NonNullable<(typeof grafoV3.scores)[string]>] => par[1] != null,
    );
    if (comScore.length > 0) {
      const maiorValor = Math.max(...comScore.map(([, s]) => s.valor));
      const topIds = comScore.filter(([, s]) => s.valor === maiorValor).map(([id]) => id);
      return { ...OPCOES_DE_ENQUADRAMENTO, padding: 0.3, nodes: topIds.map((id) => ({ id })) };
    }
    return OPCOES_DE_ENQUADRAMENTO;
  }, [grafoV3.critico, grafoV3.goalId, grafoV3.scores]);
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
  const nodeHEfetivo = Math.max(alturaMedida, NODE_H);

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

  const layout = useMemo(
    () =>
      layoutDoGrafo({
        ids: tasks.map((t) => t.id),
        edges: precedenceEdges.map((e) => ({ origem: e.from, destino: e.to })),
        criticoIds: criticoSet,
        nodeW: NODE_W,
        nodeH: nodeHEfetivo,
        gapX: GAP_X,
        gapY: Math.max(GAP_Y, GAP_Y_MINIMO),
        // P4c (achado CRÍTICO #2, cobertura completa): o crítico mediu
        // invasão real de até 64px em arestas de SINERGIA/OBSOLESCÊNCIA (não
        // só sucessão) que pulam rank sobre um nó ocupado — o RANK continua
        // preso só à precedência (`edges` acima), mas o desvio geométrico
        // agora roda sobre as 6 camadas.
        todasArestas: arestasVisuais.map((a) => ({ origem: a.origem, destino: a.destino })),
      }),
    [tasks, precedenceEdges, criticoSet, nodeHEfetivo, arestasVisuais],
  );

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
   * `origem|destino` → geometria do desvio, só para as arestas que o layout
   * marcou (achado CRÍTICO #1/#2). P4c: agora carrega a faixa Y também —
   * `v3-edge.tsx` precisa dela pra desenhar o path ortogonal que de fato
   * contorna o nó ocupado (não só um `desvioPx` que a lib ignorava).
   */
  const desvioPorAresta = useMemo(() => {
    const m = new Map<string, { desvioPx: number; desvioYInicio?: number; desvioYFim?: number }>();
    for (const a of layout.edges) {
      if (a.desviar) {
        m.set(`${a.origem}|${a.destino}`, {
          desvioPx: a.desvioPx,
          desvioYInicio: a.desvioYInicio,
          desvioYFim: a.desvioYFim,
        });
      }
    }
    return m;
  }, [layout]);

  const edges = useMemo<Edge<V3EdgeData>[]>(() => {
    const visiveis = filtrarArestasPorCamada(arestasVisuais, camadasAtivas);
    const mapeadas = visiveis.map((aresta) => {
      const dimmed =
        isOut(sourceById.get(byId.get(aresta.origem)?.sourceId ?? "")?.kind ?? "calendar") &&
        isOut(sourceById.get(byId.get(aresta.destino)?.sourceId ?? "")?.kind ?? "calendar");
      const critica = camadasAtivas.has("critico") && arestaEhCritica(aresta);
      const { sourceHandle, targetHandle } = handlesDaConexao(layout.nodes, aresta.origem, aresta.destino);
      return {
        id: aresta.id,
        source: aresta.origem,
        target: aresta.destino,
        sourceHandle,
        targetHandle,
        type: "v3",
        focusable: false,
        // P4e (achado ALTO #4 do crítico hostil ROUND 4): a aresta de
        // obsolescência sobe para uma camada ACIMA dos nós. O React Flow
        // agrupa arestas por `zIndex` em `<svg>`s próprios (`groupEdgesByZLevel`)
        // e o `<div class="react-flow__nodes">` fica no nível 0 — sem isto, o
        // ❌ dependia SÓ do recuo para não ficar atrás do cartão de destino, e
        // bastava o recuo apontar para o lado errado (era o bug) para o glifo
        // desaparecer em silêncio. Cinto E suspensório: direção correta do
        // recuo + camada por cima.
        zIndex: camadaBaseDeAresta(aresta) === "obsolescencia" ? 5 : undefined,
        style: { opacity: dimmed ? 0.15 : 1 },
        data: {
          id: aresta.id,
          origem: aresta.origem,
          destino: aresta.destino,
          camada: camadaBaseDeAresta(aresta),
          critica,
          destacadaPeloSelecionado: aresta.destacadaPeloSelecionado,
          pesoPercent: aresta.pesoPercent,
          // P4b/P4c (achado CRÍTICO #1/#2): só as arestas que o layout marcou
          // como "pula rank E célula intermediária ocupada" ganham desvio.
          desvioPx: desvioPorAresta.get(`${aresta.origem}|${aresta.destino}`)?.desvioPx,
          desvioYInicio: desvioPorAresta.get(`${aresta.origem}|${aresta.destino}`)?.desvioYInicio,
          desvioYFim: desvioPorAresta.get(`${aresta.origem}|${aresta.destino}`)?.desvioYFim,
        },
      };
    });
    // Duas arestas podem convergir no MESMO handle (ex.: dois predecessores de
    // um goal) e se sobrepor visualmente no trecho final — quem desenha por
    // último fica por cima. Sem ordenar, a ordem era "a que apareceu primeiro
    // no array de tarefas", o que enterrou uma aresta CRÍTICA (vermelha) atrás
    // de uma sucessão comum (verde) só porque a outra task vinha depois na
    // lista (achado no screenshot do fixture: task-review→task-deploy, verde,
    // cobria task-build→task-deploy, vermelha/tripla). Desenhar por último =
    // por cima: crítica > destacada > tipos raros (sinergia/obsolescência/
    // correlação) > sucessão comum.
    const prioridade = (e: (typeof mapeadas)[number]): number => {
      if (e.data.critica) return 4;
      if (e.data.destacadaPeloSelecionado) return 3;
      if (e.data.camada !== "sucessao") return 2;
      return 1;
    };
    return [...mapeadas].sort((a, b) => prioridade(a) - prioridade(b));
  }, [arestasVisuais, camadasAtivas, byId, sourceById, isOut, desvioPorAresta, layout]);

  const selectionValue = useMemo(
    () => ({ selectedTaskId, onSelectTask: handleSelect }),
    [selectedTaskId, handleSelect],
  );

  if (accessibleFallback) {
    return (
      <GraphSelectionContext.Provider value={selectionValue}>
        <AccessibleGraphList
          tasks={tasks}
          sourceByKind={sourceByKind}
          depths={depths}
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
        ref={containerRef}
        className="h-full w-full bg-navy-950"
        role="application"
        aria-label="Grafo de dependências de tarefas"
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.3}
            maxZoom={1.8}
            // P4e (achado ALTO #1): sem o prop de enquadramento automático da lib — o
            // enquadramento inicial passa pela MESMA `ajustarATela` de todos
            // os outros (`EnquadramentoDoGrafo`, abaixo). O prop era o
            // terceiro caminho: enquadrava com as opções cruas, sem fallback.
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => handleSelect(node.id)}
            onPaneClick={handlePaneClick}
          >
            <Background color={BG_DOTS} gap={22} size={1} />
            <MedirAlturaReal onAltura={aoMedirAltura} />
            <EnquadramentoDoGrafo
              containerRef={containerRef}
              assinaturaDoFiltro={filterSignature}
              opcoesCheio={opcoesDeEnquadramentoAuto}
              opcoesFallback={opcoesDeEnquadramentoFallback}
            />
            <Panel position="top-left">
              <GraphLegend fecharSinal={fecharPaineisSinal} />
            </Panel>
            <Panel position="top-right">
              <LayerTogglePanel
                ativas={camadasAtivas}
                alternar={alternarCamada}
                fecharSinal={fecharPaineisSinal}
              />
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </GraphSelectionContext.Provider>
  );
}
