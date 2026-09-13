"use client";
import { ArrowRight, Info, Maximize2, Route, ZoomIn, ZoomOut } from "lucide-react";
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
  type UseCamadasDoGrafo,
} from "@/components/graph/layer-toggle-panel";
import { TaskNode, type TaskNodeData } from "@/components/graph/task-node";
import { ZOOM_MINIMO } from "@/components/graph/tipografia-do-cartao";
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
import { handlesDaConexao, zIndexDaAresta } from "@/lib/geometria-da-aresta";
import { layoutDoGrafo, type Ponto } from "@/lib/layout-do-grafo";
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
 * P4f (decisão D1, achado ALTO #1 do crítico hostil ROUND 4): DOIS
 * enquadramentos, com os nomes do que fazem — e nada além deles.
 *
 * Na rodada 4 havia um "Ajustar à tela" com cadeia de fallback (bbox cheio →
 * críticos → goal → maior score) que o crítico mediu ser INERTE: com caminho
 * crítico presente, o objeto "cheio" e o objeto "fallback" eram o MESMO
 * objeto — os dois enquadravam só os nós críticos. Com 40 tarefas o grafo
 * abria mostrando 3 e o chip prometia 33 que nunca vinham. Código que não faz
 * o que o nome diz é pior do que código ausente: ele engana a próxima rodada.
 *
 *   • "Caminho crítico" — enquadra os nós críticos, com piso de zoom 0,85
 *     (abaixo disso o cartão vira pastilha e a cadeia perderia o detalhe que
 *     justifica olhar só para ela).
 *   • "Ver tudo" — enquadra o bbox INTEIRO, em qualquer zoom até o piso do
 *     canvas (`ZOOM_MINIMO`, onde a compensação de fonte do modo mapa satura).
 *     É o botão que o chip "N tarefas fora da tela" oferece, e a conta do chip
 *     depois do clique é a REAL.
 */
const PISO_DE_ZOOM_DO_CARTAO = 0.85;
const OPCOES_VER_TUDO: FitViewOptions = { padding: 0.05, minZoom: ZOOM_MINIMO };

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
 * P4f (decisão D1): os DOIS enquadramentos do grafo, e mais nenhum. Toda
 * chamada à API de enquadramento da lib no arquivo inteiro passa por aqui —
 * chip, botões, fit inicial e refit de resize/filtro.
 */
function useEnquadramentos(criticoIds: readonly string[]): {
  verCaminhoCritico: (duracaoMs?: number) => void;
  verTudo: (duracaoMs?: number) => void;
} {
  const { fitView } = useReactFlow();
  const chaveCritico = criticoIds.join(",");
  const verCaminhoCritico = useCallback(
    (duracaoMs = 200) => {
      const ids = chaveCritico ? chaveCritico.split(",") : [];
      if (ids.length === 0) return;
      void fitView({
        duration: duracaoMs,
        padding: 0.3,
        minZoom: PISO_DE_ZOOM_DO_CARTAO,
        nodes: ids.map((id) => ({ id })),
      });
    },
    [fitView, chaveCritico],
  );
  const verTudo = useCallback(
    (duracaoMs = 200) => void fitView({ duration: duracaoMs, ...OPCOES_VER_TUDO }),
    [fitView],
  );
  return { verCaminhoCritico, verTudo };
}

function ControlesDoGrafo({
  verCaminhoCritico,
  verTudo,
  temCritico,
}: {
  verCaminhoCritico: (duracaoMs?: number) => void;
  verTudo: (duracaoMs?: number) => void;
  temCritico: boolean;
}): JSX.Element {
  const { zoomIn, zoomOut } = useReactFlow();
  const icone =
    "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-navy-600 bg-navy-850/95 text-bone-300 hover:bg-navy-700 hover:text-bone-100";
  const comTexto =
    "pointer-events-auto flex min-h-[32px] items-center gap-1.5 rounded-md border border-navy-600 bg-navy-850/95 px-2.5 text-xs font-medium text-bone-200 hover:bg-navy-700 hover:text-bone-100";

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" className={icone} aria-label="Diminuir zoom" onClick={() => void zoomOut()}>
        <ZoomOut size={16} />
      </button>
      <button type="button" className={icone} aria-label="Aumentar zoom" onClick={() => void zoomIn()}>
        <ZoomIn size={16} />
      </button>
      {temCritico ? (
        <button type="button" className={comTexto} onClick={() => verCaminhoCritico()}>
          <Route size={14} aria-hidden="true" />
          Caminho crítico
        </button>
      ) : null}
      <button type="button" className={comTexto} onClick={() => verTudo()}>
        <Maximize2 size={14} aria-hidden="true" />
        Ver tudo
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
 * Quantas tarefas estão FORA do retângulo do pane, e o atalho honesto para
 * trazê-las: "Ver tudo".
 *
 * P4f (decisão D1): o botão do chip é o MESMO "Ver tudo" dos controles — que
 * enquadra o bbox inteiro. Na rodada 4 o chip oferecia "Ajustar à tela", que
 * (com caminho crítico presente) reenquadrava os MESMOS 3 nós críticos: o
 * número que o chip anuncia nunca chegava a zero, e a promessa era falsa. A
 * conta reage ao viewport (`x`, `y`, `zoom`), então depois do clique o número
 * mostrado é sempre o real.
 *
 * P4f (decisão D10): o chip é irmão dos pills numa COLUNA (nunca por cima
 * deles). A 390px o pill "Camadas" cobria 15,5px do chip e ganhava o
 * hit-test — clicar no chip abria o painel de camadas.
 */
function ChipForaDaTela({
  containerRef,
  verTudo,
}: {
  containerRef: RefObject<HTMLDivElement>;
  verTudo: (duracaoMs?: number) => void;
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
    <button
      type="button"
      data-chip-fora-da-tela={foraDaTela}
      onClick={() => verTudo()}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gold-500/60 bg-navy-850/95 px-3 py-1.5 text-xs font-medium text-gold-300 shadow-panel"
    >
      {foraDaTela} {foraDaTela === 1 ? "tarefa fora" : "tarefas fora"} da tela · Ver tudo
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
 * P4f (decisões D1, D9 e D10): a camada de CONTROLE do grafo — pills
 * "Legenda"/"Camadas", chip de fora-da-tela e os botões — desenhada como
 * irmã do canvas e ANTES dele na ordem do DOM.
 *
 * Por que sair de dentro do `<ReactFlow>` (onde eram `<Panel>`): a ordem de
 * tabulação segue o DOM, e os painéis da lib são renderizados DEPOIS do
 * renderer — a 1280px o crítico contou os pills só na 37ª parada de Tab,
 * depois de atravessar 2 paradas por cartão. Aqui eles vêm primeiro, e com
 * `nodesFocusable={false}` cada cartão passa a valer UMA parada (a interna,
 * que tem `role="button"` e `aria-label`).
 *
 * Tudo isto vive dentro do `ReactFlowProvider` (não do `<ReactFlow>`), que é
 * de onde os hooks da lib leem o estado — o canvas continua abaixo, e a
 * camada é transparente ao ponteiro (`pointer-events-none`) exceto nos
 * próprios controles.
 */
function SobreposicaoDoGrafo({
  containerRef,
  assinaturaDoFiltro,
  criticoIds,
  fecharPaineisSinal,
  larguraDoPane,
  onAltura,
  camadas,
}: {
  containerRef: RefObject<HTMLDivElement>;
  assinaturaDoFiltro: string;
  criticoIds: readonly string[];
  fecharPaineisSinal: number;
  larguraDoPane: number;
  onAltura: (altura: number) => void;
  camadas: UseCamadasDoGrafo;
}): JSX.Element {
  const { ativas: camadasAtivas, alternar: alternarCamada } = camadas;
  const { verCaminhoCritico, verTudo } = useEnquadramentos(criticoIds);
  const nodesInitialized = useNodesInitialized();
  const temCritico = criticoIds.length > 0;

  /**
   * Fit inicial (assim que os nós têm tamanho medido) e reenquadramento
   * quando o filtro de fontes, a largura do pane (que muda o número de
   * colunas — D2) ou a altura medida mudam. Abre pelo caminho crítico quando
   * existe um; sem meta, por "Ver tudo" — nunca por um terceiro caminho.
   */
  useEffect(() => {
    if (!nodesInitialized) return;
    const id = window.setTimeout(() => {
      if (temCritico) verCaminhoCritico(200);
      else verTudo(200);
    }, 60);
    return () => window.clearTimeout(id);
  }, [nodesInitialized, assinaturaDoFiltro, larguraDoPane, temCritico, verCaminhoCritico, verTudo]);

  return (
    <>
      <MedirAlturaReal onAltura={onAltura} />
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-2">
        <div className="flex flex-col gap-1.5">
          {/* Linha dos pills. `pointer-events-auto` em cada um: o resto da
              camada continua transparente ao ponteiro, e o canvas debaixo
              recebe pan/zoom normalmente. */}
          <div className="flex items-start justify-between gap-2">
            <div className="pointer-events-auto">
              <GraphLegend fecharSinal={fecharPaineisSinal} />
            </div>
            <div className="pointer-events-auto">
              <LayerTogglePanel
                ativas={camadasAtivas}
                alternar={alternarCamada}
                fecharSinal={fecharPaineisSinal}
              />
            </div>
          </div>
          {/* D10: o chip mora ABAIXO dos pills, numa linha só dele — 0px de
              sobreposição em qualquer largura. */}
          <div className="flex justify-center">
            <ChipForaDaTela containerRef={containerRef} verTudo={verTudo} />
          </div>
        </div>
        <ControlesDoGrafo
          verCaminhoCritico={verCaminhoCritico}
          verTudo={verTudo}
          temCritico={temCritico}
        />
      </div>
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

  const camadas = useCamadasDoGrafo();
  const camadasAtivas = camadas.ativas;
  /** Container real (fora do ReactFlow) — observado para largura e reenquadramento. */
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * P4f (decisão D2): a largura REAL do pane decide quantas colunas cabem numa
   * linha do rank. Observada aqui (e não dentro do `<ReactFlow>`) porque a
   * aba "Grafo" no celular monta a `section` com `display:none` — o container
   * existe com 0×0 e nada reenquadraria quando ele vira visível; o
   * `ResizeObserver` no wrapper que o PAI controla pega a mudança real,
   * inclusive resize de janela e o painel "Camadas" recolhendo.
   */
  const [larguraDoPane, setLarguraDoPane] = useState(1024);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width } = entry.contentRect;
      if (width > 0) {
        // Só reage a mudança de verdade (>1px): ruído de sub-pixel do próprio
        // enquadramento reentraria em loop.
        setLarguraDoPane((atual) => (Math.abs(atual - width) > 1 ? width : atual));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const maxColunas = maxColunasParaLargura(larguraDoPane);

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
    [tasks, precedenceEdges, criticoSet, nodeHEfetivo, arestasVisuais, maxColunas],
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
  }, [arestasVisuais, camadasAtivas, byId, sourceById, isOut, rotaPorAresta, layout]);

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
        className="relative h-full w-full bg-navy-950"
        role="application"
        aria-label="Grafo de dependências de tarefas"
      >
        <ReactFlowProvider>
          {/* P4f (decisão D9): a camada de controle vem ANTES do canvas na
              ordem do DOM — é isso, e só isso, que põe os pills nas primeiras
              paradas de Tab. Fica dentro do Provider (de onde os hooks da lib
              leem o estado), fora do `<ReactFlow>`. */}
          <SobreposicaoDoGrafo
            containerRef={containerRef}
            assinaturaDoFiltro={filterSignature}
            criticoIds={grafoV3.critico}
            fecharPaineisSinal={fecharPaineisSinal}
            larguraDoPane={larguraDoPane}
            onAltura={aoMedirAltura}
            camadas={camadas}
          />
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
            // com título, estado, fonte e bloqueio).
            nodesFocusable={false}
            elementsSelectable
            // P4f (achado BAIXO #9): o piso do canvas é o piso do modo mapa —
            // abaixo de `ZOOM_MINIMO` a compensação de fonte satura e o texto
            // voltaria a encolher (o crítico chegou a 0,30 com fonte de
            // 3,6px de tela).
            minZoom={ZOOM_MINIMO}
            maxZoom={1.8}
            // Sem o prop de enquadramento automático da lib: o fit inicial é o
            // MESMO "Caminho crítico"/"Ver tudo" dos botões
            // (`SobreposicaoDoGrafo`) — nunca um terceiro caminho.
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => handleSelect(node.id)}
            onPaneClick={handlePaneClick}
          >
            <Background color={BG_DOTS} gap={22} size={1} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </GraphSelectionContext.Provider>
  );
}
