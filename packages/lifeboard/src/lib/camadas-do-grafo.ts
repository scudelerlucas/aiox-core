/**
 * OS-LIFEBOARD · P4 — As 6 arestas do grafo v3, em camadas.
 *
 * Fonte da semântica: hub, `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`
 * §5. "Caminho crítico" NUNCA é uma aresta declarada — é o resultado do CPM: uma
 * aresta de SUCESSÃO cujos dois lados estão em `critico` ganha `critica: true` (o
 * traço triplo), sem deixar de ser uma aresta de sucessão (ela continua visível
 * quando só a camada "Sucessão" está ativa e "Caminho crítico" está desligada).
 *
 * Módulo PURO — sem React, sem ReactFlow, sem `server-only` — para ser testável
 * isoladamente (item 4 da spec do P4) e reusado tanto pelo grafo real quanto
 * pelo teste de render.
 */

import type { Task, TaskEdge } from "@/types/canonical";

/** As 5 camadas alternáveis do painel "Camadas" (checkbox por camada). */
export type CamadaGrafo =
  | "sucessao"
  | "correlacao"
  | "sinergia"
  | "obsolescencia"
  | "critico";

export const CAMADAS_TODAS: readonly CamadaGrafo[] = [
  "sucessao",
  "correlacao",
  "sinergia",
  "obsolescencia",
  "critico",
];

/** Default do painel (spec P4 §2): Sucessão + Caminho crítico. */
export const CAMADAS_DEFAULT: readonly CamadaGrafo[] = ["sucessao", "critico"];

export const CAMADA_LABEL: Record<CamadaGrafo, string> = {
  sucessao: "Sucessão",
  correlacao: "Correlação",
  sinergia: "Sinergia",
  obsolescencia: "Obsolescência",
  critico: "Caminho crítico",
};

/** Uma aresta pronta para desenhar — já resolvida a partir das 3 fontes de dado. */
export interface ArestaVisual {
  id: string;
  origem: string;
  destino: string;
  /**
   * Camadas às quais esta aresta pertence. Uma aresta de sucessão crítica
   * pertence a `["sucessao", "critico"]` — some só quando NENHuma das duas
   * está ativa; o traço triplo entra quando "critico" está ativa (mesmo que
   * "sucessao" também esteja).
   */
  camadas: readonly CamadaGrafo[];
  /** Tipo de origem do dado (nunca "critico" — isso é derivado, não declarado). */
  tipoOriginal: "predecessor" | "correlacao" | "sinergia" | "obsolescencia";
  /** Sinergia: peso em % (arredondado), para o rótulo da aresta. */
  pesoPercent?: number;
  /** Predecessor incidente ao nó selecionado (fica amarelo — spec §2). */
  destacadaPeloSelecionado: boolean;
}

/** União de precedência = predecessorIds ∪ successorIds (invertido) ∪ TaskEdge tipo=predecessor. */
function construirSucessao(
  tasks: readonly Task[],
  edges: readonly TaskEdge[],
): { origem: string; destino: string }[] {
  const ids = new Set(tasks.map((t) => t.id));
  const vistos = new Set<string>();
  const pares: { origem: string; destino: string }[] = [];
  const add = (origem: string, destino: string): void => {
    if (!ids.has(origem) || !ids.has(destino) || origem === destino) return;
    const chave = `${origem}|${destino}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    pares.push({ origem, destino });
  };
  for (const t of tasks) {
    for (const p of t.predecessorIds) add(p, t.id);
    for (const s of t.successorIds) add(t.id, s);
  }
  for (const e of edges) {
    if (e.tipo === "predecessor") add(e.origem, e.destino);
  }
  return pares;
}

/**
 * Constrói TODAS as arestas visuais do grafo v3, já classificadas por camada.
 * `criticoIds`: ids com folga zero (vindos de `GrafoV3Props.critico`).
 * `selectedTaskId`: nó selecionado — sucessão que TERMINA nele fica destacada.
 */
export function construirArestasVisuais(params: {
  tasks: readonly Task[];
  edges: readonly TaskEdge[];
  criticoIds: ReadonlySet<string> | readonly string[];
  selectedTaskId?: string | null;
}): ArestaVisual[] {
  const { tasks, edges, selectedTaskId = null } = params;
  const critico = params.criticoIds instanceof Set ? params.criticoIds : new Set(params.criticoIds);
  // Mesma convenção de `dag.ts`/`caminho-critico.ts`: aresta cuja origem ou
  // destino não está na lista de tarefas é descartada em silêncio (a RPC pode
  // entregar ponta solta quando os filtros por dono divergem).
  const ids = new Set(tasks.map((t) => t.id));

  const visuais: ArestaVisual[] = [];

  for (const { origem, destino } of construirSucessao(tasks, edges)) {
    const critica = critico.has(origem) && critico.has(destino);
    visuais.push({
      id: `sucessao:${origem}->${destino}`,
      origem,
      destino,
      camadas: critica ? ["sucessao", "critico"] : ["sucessao"],
      tipoOriginal: "predecessor",
      destacadaPeloSelecionado: selectedTaskId !== null && destino === selectedTaskId,
    });
  }

  for (const e of edges) {
    if (!ids.has(e.origem) || !ids.has(e.destino)) continue;
    if (e.tipo === "correlacao") {
      visuais.push({
        id: `correlacao:${e.id}`,
        origem: e.origem,
        destino: e.destino,
        camadas: ["correlacao"],
        tipoOriginal: "correlacao",
        destacadaPeloSelecionado: false,
      });
    } else if (e.tipo === "sinergia") {
      visuais.push({
        id: `sinergia:${e.id}`,
        origem: e.origem,
        destino: e.destino,
        camadas: ["sinergia"],
        tipoOriginal: "sinergia",
        pesoPercent: Math.round(e.peso * 100),
        destacadaPeloSelecionado: false,
      });
    } else if (e.tipo === "obsolescencia") {
      visuais.push({
        id: `obsolescencia:${e.id}`,
        origem: e.origem,
        destino: e.destino,
        camadas: ["obsolescencia"],
        tipoOriginal: "obsolescencia",
        destacadaPeloSelecionado: false,
      });
    }
  }

  return visuais;
}

/**
 * O toggle: uma aresta aparece se QUALQUER uma das camadas a que pertence está
 * ativa (OR, não AND) — é o que permite uma aresta crítica continuar visível
 * como sucessão comum quando só "Caminho crítico" é desligada.
 */
export function filtrarArestasPorCamada(
  arestas: readonly ArestaVisual[],
  ativas: ReadonlySet<CamadaGrafo> | readonly CamadaGrafo[],
): ArestaVisual[] {
  const set = ativas instanceof Set ? ativas : new Set(ativas);
  return arestas.filter((a) => a.camadas.some((c) => set.has(c)));
}

/** Uma aresta de sucessão é "crítica" quando o traço triplo deve aparecer. */
export function arestaEhCritica(aresta: ArestaVisual): boolean {
  return aresta.camadas.includes("critico");
}

/** Camada BASE (visual) da aresta — "predecessor" (o tipo de dado) desenha como "sucessao". */
export function camadaBaseDeAresta(aresta: ArestaVisual): Exclude<CamadaGrafo, "critico"> {
  return aresta.tipoOriginal === "predecessor" ? "sucessao" : aresta.tipoOriginal;
}
