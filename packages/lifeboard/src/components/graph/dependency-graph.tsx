"use client";
import { ArrowRight, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import { GraphSelectionContext } from "@/components/graph/selection-context";
import { TaskNode, type TaskNodeData } from "@/components/graph/task-node";
import { SourceIcon } from "@/components/ui/source-icon";
import { StatusChip } from "@/components/ui/status-chip";
import type { Source, SourceKind, Task } from "@/types/canonical";

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
}

// ── Cores de aresta (SVG stroke — API da lib exige literal; = tokens §1) ──────
const EDGE_LIVE = "#8593A8"; // state-neutral (precedência ainda bloqueia)
const EDGE_DONE = "#4FA97B"; // state-success (caminho liberado)
const EDGE_HL = "#A8895A"; // gold-500 (incidente ao selecionado)
const BG_DOTS = "#13253D"; // navy-800

const NODE_W = 200;
const NODE_H = 96;
const GAP_X = 56;
const GAP_Y = 84;

const nodeTypes: NodeTypes = { task: TaskNode };

/** Constrói adjacência de precedência (x→y) das DUAS representações + dedup. */
function buildPrecedence(tasks: Task[]): {
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

function GraphControls(): JSX.Element {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md border border-navy-600 bg-navy-850 text-bone-300 hover:bg-navy-700 hover:text-bone-100";
  return (
    <Panel position="bottom-left" className="flex gap-1">
      <button type="button" className={btn} aria-label="Diminuir zoom" onClick={() => void zoomOut()}>
        <ZoomOut size={16} />
      </button>
      <button type="button" className={btn} aria-label="Ajustar à tela" onClick={() => void fitView({ duration: 200 })}>
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

function GraphLegend(): JSX.Element {
  return (
    <Panel
      position="bottom-right"
      className="flex max-w-[240px] flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-navy-600 bg-navy-850/90 px-3 py-2 text-xs text-bone-300"
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
    </Panel>
  );
}

/** Reenquadra ao montar e quando o filtro muda (spec §3.3). */
function FitOnChange({ signature }: { signature: string }): null {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = window.setTimeout(() => void fitView({ duration: 200, padding: 0.2 }), 60);
    return () => window.clearTimeout(id);
  }, [signature, fitView]);
  return null;
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
  } = props;

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

  const filterActive = activeSourceKinds.length > 0 && activeSourceKinds.length < 5;
  const isOut = useCallback(
    (kind: SourceKind): boolean => filterActive && !activeSourceKinds.includes(kind),
    [filterActive, activeSourceKinds],
  );

  const { edges: rawEdges, predsOf } = useMemo(() => buildPrecedence(tasks), [tasks]);
  const depths = useMemo(() => computeDepths(tasks, predsOf), [tasks, predsOf]);
  const cycleSet = useMemo(() => new Set(cycleTaskIds), [cycleTaskIds]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const topTodayId = todayTaskIds[0] ?? null;

  const handleSelect = useCallback(
    (id: string | null) => onSelectTask?.(id),
    [onSelectTask],
  );

  const nodes = useMemo<Node<TaskNodeData>[]>(() => {
    // Distribui por coluna dentro de cada camada de profundidade.
    const perDepth = new Map<number, number>();
    return tasks.map((task) => {
      const d = depths.get(task.id) ?? 0;
      const col = perDepth.get(d) ?? 0;
      perDepth.set(d, col + 1);

      const src = sourceById.get(task.sourceId);
      const kind: SourceKind = src?.kind ?? "calendar";
      const openPred = task.predecessorIds
        .map((pid) => byId.get(pid))
        .find((p) => p && p.status !== "done");

      return {
        id: task.id,
        type: "task",
        position: { x: col * (NODE_W + GAP_X), y: d * (NODE_H + GAP_Y) },
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
        },
      };
    });
  }, [tasks, depths, sourceById, byId, cycleSet, topTodayId, selectedTaskId, isOut]);

  const edges = useMemo<Edge[]>(() => {
    return rawEdges.map(({ from, to }) => {
      const fromTask = byId.get(from);
      const done = fromTask?.status === "done";
      const incident = selectedTaskId === from || selectedTaskId === to;
      const dimmed =
        isOut(sourceById.get(fromTask?.sourceId ?? "")?.kind ?? "calendar") &&
        isOut(sourceById.get(byId.get(to)?.sourceId ?? "")?.kind ?? "calendar");
      const stroke = incident ? EDGE_HL : done ? EDGE_DONE : EDGE_LIVE;
      return {
        id: `${from}->${to}`,
        source: from,
        target: to,
        type: "smoothstep",
        className: done ? undefined : "lb-edge-live",
        style: {
          stroke: incident ? EDGE_HL : done ? EDGE_DONE : EDGE_LIVE,
          strokeWidth: incident ? 2 : 1.5,
          opacity: dimmed ? 0.15 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      };
    });
  }, [rawEdges, byId, selectedTaskId, sourceById, isOut]);

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
        className="h-full w-full bg-navy-950"
        role="application"
        aria-label="Grafo de dependências de tarefas"
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.3}
            maxZoom={1.8}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => handleSelect(node.id)}
            onPaneClick={() => handleSelect(null)}
          >
            <Background color={BG_DOTS} gap={22} size={1} />
            <FitOnChange signature={filterSignature} />
            <GraphControls />
            <GraphLegend />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </GraphSelectionContext.Provider>
  );
}
