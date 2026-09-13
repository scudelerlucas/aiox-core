import { describe, expect, it } from "vitest";

import {
  arestaEhCritica,
  camadaBaseDeAresta,
  construirArestasVisuais,
  filtrarArestasPorCamada,
  CAMADAS_DEFAULT,
} from "@/lib/camadas-do-grafo";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P4 — testes do módulo puro `camadas-do-grafo.ts`.
 * Fixture mínima que exercita as 4 fontes de aresta (predecessor por array,
 * predecessor por TaskEdge, correlação, sinergia, obsolescência) + 1 par crítico.
 */
function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: "p",
    title: id,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "s",
    externalRef: id,
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  };
}

function edge(o: Partial<TaskEdge> & Pick<TaskEdge, "origem" | "destino" | "tipo">): TaskEdge {
  return { id: `${o.origem}->${o.destino}`, peso: 1, nota: null, createdAt: "2026-09-13T00:00:00.000Z", ...o };
}

const A = task("A", { successorIds: ["B"] });
const B = task("B", { predecessorIds: ["A"] });
const C = task("C");
const D = task("D");
const E = task("E");
const TASKS = [A, B, C, D, E];

const EDGES: TaskEdge[] = [
  edge({ origem: "C", destino: "D", tipo: "predecessor" }),
  edge({ origem: "C", destino: "E", tipo: "correlacao" }),
  edge({ origem: "D", destino: "E", tipo: "sinergia", peso: 0.5 }),
  edge({ origem: "E", destino: "A", tipo: "obsolescencia" }),
];

describe("construirArestasVisuais", () => {
  it("une predecessor por array E por TaskEdge, sem duplicar", () => {
    const visuais = construirArestasVisuais({ tasks: TASKS, edges: EDGES, criticoIds: [] });
    const sucessao = visuais.filter((v) => v.tipoOriginal === "predecessor");
    expect(sucessao).toHaveLength(2); // A->B (array) e C->D (TaskEdge)
    expect(sucessao.map((v) => `${v.origem}->${v.destino}`).sort()).toEqual(["A->B", "C->D"]);
  });

  it("marca crítica só quando os DOIS lados estão no conjunto crítico", () => {
    const visuais = construirArestasVisuais({
      tasks: TASKS,
      edges: EDGES,
      criticoIds: new Set(["A", "B"]),
    });
    const ab = visuais.find((v) => v.origem === "A" && v.destino === "B");
    const cd = visuais.find((v) => v.origem === "C" && v.destino === "D");
    expect(ab && arestaEhCritica(ab)).toBe(true);
    expect(cd && arestaEhCritica(cd)).toBe(false);
    expect(ab?.camadas).toEqual(["sucessao", "critico"]);
    expect(cd?.camadas).toEqual(["sucessao"]);
  });

  it("destaca (amarelo) a sucessão que TERMINA no nó selecionado", () => {
    const visuais = construirArestasVisuais({
      tasks: TASKS,
      edges: EDGES,
      criticoIds: [],
      selectedTaskId: "B",
    });
    const ab = visuais.find((v) => v.origem === "A" && v.destino === "B");
    expect(ab?.destacadaPeloSelecionado).toBe(true);
    const cd = visuais.find((v) => v.origem === "C" && v.destino === "D");
    expect(cd?.destacadaPeloSelecionado).toBe(false);
  });

  it("sinergia carrega peso em % arredondado", () => {
    const visuais = construirArestasVisuais({ tasks: TASKS, edges: EDGES, criticoIds: [] });
    const sinergia = visuais.find((v) => v.tipoOriginal === "sinergia");
    expect(sinergia?.pesoPercent).toBe(50);
  });

  it("ignora aresta cuja origem ou destino não existe na lista de tarefas", () => {
    const edgesComOrfa: TaskEdge[] = [
      ...EDGES,
      edge({ origem: "C", destino: "fantasma", tipo: "sinergia", peso: 0.9 }),
      edge({ origem: "fantasma", destino: "A", tipo: "correlacao" }),
    ];
    const visuais = construirArestasVisuais({ tasks: TASKS, edges: edgesComOrfa, criticoIds: [] });
    expect(visuais.some((v) => v.origem === "fantasma" || v.destino === "fantasma")).toBe(false);
  });

  it("camadaBaseDeAresta: predecessor vira 'sucessao'; os demais mantêm o tipo", () => {
    const visuais = construirArestasVisuais({ tasks: TASKS, edges: EDGES, criticoIds: [] });
    for (const v of visuais) {
      const base = camadaBaseDeAresta(v);
      expect(base).not.toBe("critico");
      if (v.tipoOriginal === "predecessor") expect(base).toBe("sucessao");
      else expect(base).toBe(v.tipoOriginal);
    }
  });
});

describe("filtrarArestasPorCamada — o toggle", () => {
  const visuais = construirArestasVisuais({
    tasks: TASKS,
    edges: EDGES,
    criticoIds: new Set(["A", "B"]),
  });

  it("default (sucessão + caminho crítico) mostra as 2 sucessões e nada mais", () => {
    const visiveis = filtrarArestasPorCamada(visuais, CAMADAS_DEFAULT);
    expect(visiveis).toHaveLength(2);
    expect(visiveis.every((v) => v.tipoOriginal === "predecessor")).toBe(true);
  });

  it("desligar 'sucessao' e 'critico' some com as arestas de predecessor", () => {
    const visiveis = filtrarArestasPorCamada(visuais, new Set(["correlacao", "sinergia", "obsolescencia"]));
    expect(visiveis.some((v) => v.tipoOriginal === "predecessor")).toBe(false);
    expect(visiveis).toHaveLength(3); // correlacao + sinergia + obsolescencia
  });

  it("a aresta crítica CONTINUA visível como sucessão comum quando só 'critico' é desligada", () => {
    const visiveis = filtrarArestasPorCamada(visuais, new Set(["sucessao"]));
    const ab = visiveis.find((v) => v.origem === "A" && v.destino === "B");
    expect(ab).toBeDefined();
    expect(ab && arestaEhCritica(ab)).toBe(true); // continua marcada como crítica no dado...
    // ...mas quem decide se DESENHA o traço triplo é o consumidor (`camadasAtivas.has("critico")`),
    // não este filtro — por isso o teste de render (`aresta-svg-render.test.tsx`) usa
    // `critica: false` quando simula a camada "critico" desligada.
  });

  it("ligar TODAS as camadas mostra as 5 arestas visuais (2 sucessão + 3 declaradas)", () => {
    const visiveis = filtrarArestasPorCamada(
      visuais,
      new Set(["sucessao", "correlacao", "sinergia", "obsolescencia", "critico"]),
    );
    expect(visiveis).toHaveLength(5);
  });

  it("nenhuma camada ativa → nenhuma aresta visível", () => {
    expect(filtrarArestasPorCamada(visuais, new Set())).toHaveLength(0);
  });
});
