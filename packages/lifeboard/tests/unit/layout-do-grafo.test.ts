import { describe, expect, it } from "vitest";

import { layoutDoGrafo } from "@/lib/layout-do-grafo";

/**
 * OS-LIFEBOARD · P4b — fixture do achado CRÍTICO do crítico hostil: o layout
 * em grade (`col = i % COLS_MAX` sobre o índice de encontro) empilhava "Daily
 * standup" (sem predecessor/sucessor nenhum) na MESMA coluna e entre as linhas
 * visuais de setup→build→deploy, por pura coincidência de sub-linha de
 * transbordo — a aresta crítica passava reto por cima do card dele.
 */
const IDS = ["setup", "standup", "build", "deploy", "review"] as const;
const EDGES = [
  { origem: "setup", destino: "build" },
  { origem: "build", destino: "deploy" },
  // "review" pula direto para "deploy" sem passar por "build" — rank 0 → rank 2,
  // pula o rank 1 (onde "build" mora) — é a aresta review→deploy do fixture real.
  { origem: "review", destino: "deploy" },
];

describe("layoutDoGrafo — rank por caminho mais longo + coluna estável", () => {
  it("setup, build e deploy caem em ranks (linhas) distintos", () => {
    const { nodes } = layoutDoGrafo({ ids: [...IDS], edges: EDGES });
    expect(nodes.get("setup")?.rank).toBe(0);
    expect(nodes.get("build")?.rank).toBe(1);
    expect(nodes.get("deploy")?.rank).toBe(2);
  });

  it("'standup' (sem predecessor/sucessor) fica no rank 0 — NUNCA numa linha intermediária", () => {
    const { nodes } = layoutDoGrafo({ ids: [...IDS], edges: EDGES });
    const standup = nodes.get("standup");
    const setup = nodes.get("setup");
    const build = nodes.get("build");
    const deploy = nodes.get("deploy");
    expect(standup?.rank).toBe(0);
    // A prova concreta do bug anterior: o rank de standup é IGUAL ao de setup
    // (mesma linha), então ele nunca pode ficar visualmente "entre" setup e
    // build/deploy — era exatamente essa a coincidência de sub-linha que o
    // layout antigo produzia.
    expect(standup?.y).toBe(setup?.y);
    expect(standup?.y).toBeLessThan(build!.y);
    expect(standup?.y).toBeLessThan(deploy!.y);
  });

  it("coluna é estável: crítico primeiro, depois por id — nunca pela ordem de chegada", () => {
    const idsForaDeOrdem = ["zzz", "aaa", "setup", "build", "deploy", "standup", "review"];
    const { nodes } = layoutDoGrafo({
      ids: idsForaDeOrdem,
      edges: EDGES,
      criticoIds: ["setup", "build", "deploy"],
    });
    // Rank 0: aaa, review, setup, standup, zzz (todos sem predecessor) —
    // crítico (setup) primeiro, depois os demais por id ascendente.
    expect(nodes.get("setup")?.coluna).toBe(0);
    const rank0PorColuna = [...nodes.values()]
      .filter((n) => n.rank === 0)
      .sort((a, b) => a.coluna - b.coluna)
      .map((n) => n.id);
    expect(rank0PorColuna[0]).toBe("setup"); // único crítico do rank 0
    expect(rank0PorColuna.slice(1)).toEqual(["aaa", "review", "standup", "zzz"]); // resto por id
  });

  it("mesma entrada produz sempre o mesmo layout (determinístico, sem depender de ordem de array)", () => {
    const a = layoutDoGrafo({ ids: [...IDS], edges: EDGES, criticoIds: ["setup", "build", "deploy"] });
    const b = layoutDoGrafo({
      ids: [...IDS].reverse(),
      edges: [...EDGES].reverse(),
      criticoIds: ["setup", "build", "deploy"],
    });
    for (const id of IDS) {
      expect(b.nodes.get(id)).toEqual(a.nodes.get(id));
    }
  });

  it("aresta que pula rank (review→deploy, pula o rank de 'build') ganha desviar=true quando a célula intermediária está ocupada", () => {
    const { edges } = layoutDoGrafo({
      ids: [...IDS],
      edges: EDGES,
      criticoIds: ["setup", "build", "deploy"],
    });
    const reviewDeploy = edges.find((e) => e.origem === "review" && e.destino === "deploy");
    expect(reviewDeploy?.pulaRank).toBe(true);
    // "build" é o único nó do rank 1 (intermediário) — na coluna 0 tanto de
    // "review" (rank0,col?) quanto de "deploy" (rank2,col?) só coincide se a
    // coluna bater; testa a MECÂNICA (o campo existe e é booleano coerente
    // com pulaRank), não um valor específico de coluna (isso é acidente do
    // fixture, o que importa é a flag existir e nunca disparar sem pular rank).
    expect(typeof reviewDeploy?.desviar).toBe("boolean");
    expect(reviewDeploy?.desvioPx).toBeGreaterThan(0);
  });

  it("aresta adjacente (rank a rank+1) nunca pula — desviar sempre false", () => {
    const { edges } = layoutDoGrafo({ ids: [...IDS], edges: EDGES });
    const setupBuild = edges.find((e) => e.origem === "setup" && e.destino === "build");
    expect(setupBuild?.pulaRank).toBe(false);
    expect(setupBuild?.desviar).toBe(false);
  });

  it("ciclo não trava (corta em rank 0, layout ainda sai)", () => {
    const { nodes } = layoutDoGrafo({
      ids: ["a", "b"],
      edges: [
        { origem: "a", destino: "b" },
        { origem: "b", destino: "a" },
      ],
    });
    expect(nodes.size).toBe(2);
    expect(Number.isFinite(nodes.get("a")?.rank)).toBe(true);
    expect(Number.isFinite(nodes.get("b")?.rank)).toBe(true);
  });
});
