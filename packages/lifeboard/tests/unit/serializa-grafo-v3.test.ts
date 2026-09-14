import { describe, expect, it } from "vitest";

import { serializaGrafoV3 } from "@/lib/serializa-grafo-v3";
import type { ResultadoCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { TaskEdge } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P4 — o serializador é o único ponto que atravessa o limite
 * Server → Client Component (RSC só serializa JSON-plain: sem `Set`, sem `Map`).
 * Este teste prova o round-trip: tudo que entra como `Set`/`Map` sai como
 * array/objeto simples, com os MESMOS dados (nenhuma entrada perdida, nenhuma
 * ordem trocada de um jeito que mude o conteúdo).
 */
function score(valor: number): ScoreAssimetria {
  return { valor, s1: 3, s2: 2, s3: 3, e: 2, c: 1, porque: "está no caminho crítico", obsoleta: false };
}

describe("serializaGrafoV3", () => {
  const cpm: ResultadoCPM = {
    goalId: "goal-1",
    critico: new Set(["a", "b", "goal-1"]),
    janelas: new Map([
      ["a", { es: 0, ef: 1, ls: 0, lf: 1, folga: 0, duracao: 1 }],
      ["b", { es: 1, ef: 3, ls: 1, lf: 3, folga: 0, duracao: 2 }],
    ]),
    semDuracao: ["b"],
    duracaoTotal: 3,
    emCiclo: ["z"],
  };
  const scores = new Map<string, ScoreAssimetria | null>([
    ["a", score(4.5)],
    ["b", null],
  ]);
  const edges: TaskEdge[] = [
    { id: "e1", origem: "a", destino: "b", tipo: "predecessor", peso: 1, nota: null, createdAt: "2026-09-13T00:00:00.000Z" },
  ];

  it("Set(critico)/array(semDuracao,emCiclo) viram array — mesmo conteúdo, sem Set/Map na saída", () => {
    const plano = serializaGrafoV3(edges, cpm, scores);

    expect(Array.isArray(plano.critico)).toBe(true);
    expect(plano.critico instanceof Set).toBe(false);
    expect([...plano.critico].sort()).toEqual(["a", "b", "goal-1"].sort());

    expect(Array.isArray(plano.semDuracao)).toBe(true);
    expect(plano.semDuracao).toEqual(["b"]);

    expect(Array.isArray(plano.emCiclo)).toBe(true);
    expect(plano.emCiclo).toEqual(["z"]);
  });

  it("Map(janelas) vira objeto simples — round-trip sem perder nenhuma janela", () => {
    const plano = serializaGrafoV3(edges, cpm, scores);
    expect(plano.janelas instanceof Map).toBe(false);
    expect(plano.janelas).toEqual({
      a: { es: 0, ef: 1, ls: 0, lf: 1, folga: 0, duracao: 1 },
      b: { es: 1, ef: 3, ls: 1, lf: 3, folga: 0, duracao: 2 },
    });
    // round-trip: o JSON que o RSC de fato atravessa não perde nada.
    const reidratado: unknown = JSON.parse(JSON.stringify(plano));
    expect(reidratado).toEqual(plano);
  });

  it("Map(scores) vira objeto simples, preservando `null`", () => {
    const plano = serializaGrafoV3(edges, cpm, scores);
    expect(plano.scores instanceof Map).toBe(false);
    expect(plano.scores["a"]).toEqual(score(4.5));
    expect(plano.scores["b"]).toBeNull();
  });

  it("goalId, duracaoTotal e edges atravessam sem transformação", () => {
    const plano = serializaGrafoV3(edges, cpm, scores);
    expect(plano.goalId).toBe("goal-1");
    expect(plano.duracaoTotal).toBe(3);
    expect(plano.edges).toBe(edges);
  });

  it("goalId null e coleções vazias serializam para array/objeto vazio (nunca undefined)", () => {
    const cpmVazio: ResultadoCPM = {
      goalId: null,
      critico: new Set(),
      janelas: new Map(),
      semDuracao: [],
      duracaoTotal: 0,
      emCiclo: [],
    };
    const plano = serializaGrafoV3([], cpmVazio, new Map());
    expect(plano).toEqual({
      edges: [],
      critico: [],
      janelas: {},
      semDuracao: [],
      emCiclo: [],
      goalId: null,
      duracaoTotal: 0,
      scores: {},
    });
  });
});
