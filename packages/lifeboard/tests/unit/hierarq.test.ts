import { describe, expect, it } from "vitest";
import { compareHierarq, scoreHierarq } from "@/core/prioritize/hierarq";
import type { HierarqScore, Task } from "@/types/canonical";

/** Task mínima com um HierarqScore dado (camada O só olha `priorityHierarq`). */
function task(id: string, hierarq: HierarqScore): Task {
  return {
    id,
    projectId: "p",
    title: id,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: hierarq,
    predecessorIds: [],
    successorIds: [],
    sourceId: "s",
    externalRef: id,
    updatedAt: "2026-07-09T00:00:00.000Z",
  };
}

/** Ordena por HIERARQ e devolve só os ids (facilita as asserções de ordem). */
function orderedIds(tasks: Task[]): string[] {
  return [...tasks].sort(compareHierarq).map((t) => t.id);
}

describe("scoreHierarq — S = s1 × s2 × s3 (PRD §4)", () => {
  it("multiplica os três pesos", () => {
    expect(scoreHierarq(task("a", { s1: 5, s2: 5, s3: 5 }))).toBe(125);
    expect(scoreHierarq(task("b", { s1: 5, s2: 4, s3: 3 }))).toBe(60);
    expect(scoreHierarq(task("c", { s1: 1, s2: 1, s3: 1 }))).toBe(1);
    expect(scoreHierarq(task("d", { s1: 2, s2: 3, s3: 4 }))).toBe(24);
  });
});

describe("compareHierarq — ordenação primária pelo PRODUTO (desc)", () => {
  it("ordena por S = s1×s2×s3 decrescente", () => {
    const tasks = [
      task("baixo", { s1: 2, s2: 1, s3: 1 }), // 2
      task("alto", { s1: 5, s2: 5, s3: 5 }), // 125
      task("medio", { s1: 5, s2: 4, s3: 3 }), // 60
    ];
    expect(orderedIds(tasks)).toEqual(["alto", "medio", "baixo"]);
  });

  it("compareHierarq(a,b) < 0 quando a tem produto maior", () => {
    const a = task("a", { s1: 5, s2: 5, s3: 5 }); // 125
    const b = task("b", { s1: 5, s2: 4, s3: 3 }); // 60
    expect(compareHierarq(a, b)).toBeLessThan(0);
    expect(compareHierarq(b, a)).toBeGreaterThan(0);
  });
});

describe("compareHierarq — desempate na ordem EXATA S1 > S3 > S2 (PRD §4)", () => {
  it("PROVA que s1 é o desempate PRIMÁRIO: mesmo produto, maior s1 vence", () => {
    // Todas com produto 24, mas s1 distintos (4 > 3 > 2). s2/s3 propositalmente
    // "invertidos" para mostrar que NÃO influenciam enquanto s1 difere.
    const A = task("A", { s1: 4, s2: 2, s3: 3 }); // 24, s1=4
    const B = task("B", { s1: 3, s2: 4, s3: 2 }); // 24, s1=3
    const C = task("C", { s1: 2, s2: 3, s3: 4 }); // 24, s1=2 (maior s3, ignorado)
    expect(orderedIds([C, A, B])).toEqual(["A", "B", "C"]);
  });

  it("PROVA que s3 desempata ANTES de s2: mesmo produto e mesmo s1, maior s3 vence apesar de menor s2", () => {
    // Produto 24, s1 igual (=2). Diferem em s3 e s2 de forma OPOSTA:
    //   D tem s2 MAIOR (6) mas s3 MENOR (2);  E tem s3 MAIOR (4) e s2 menor (3).
    // Se s2 mandasse, D viria antes. Como s3 > s2 na ordem, E vence.
    const D = task("D", { s1: 2, s2: 6, s3: 2 }); // 24, s1=2, s3=2, s2=6
    const E = task("E", { s1: 2, s2: 3, s3: 4 }); // 24, s1=2, s3=4, s2=3
    expect(orderedIds([D, E])).toEqual(["E", "D"]);
    expect(compareHierarq(E, D)).toBeLessThan(0); // E antes de D
  });

  it("cadeia completa: produto → s1 → s3 num único sort", () => {
    const tasks = [
      task("t24-s1_2-s3_4", { s1: 2, s2: 3, s3: 4 }), // 24, s1=2, s3=4
      task("t24-s1_2-s3_2", { s1: 2, s2: 6, s3: 2 }), // 24, s1=2, s3=2
      task("t24-s1_4", { s1: 4, s2: 2, s3: 3 }), // 24, s1=4
      task("t60", { s1: 5, s2: 4, s3: 3 }), // 60
    ];
    expect(orderedIds(tasks)).toEqual([
      "t60", // maior produto primeiro
      "t24-s1_4", // produto 24, maior s1
      "t24-s1_2-s3_4", // produto 24, s1=2, maior s3
      "t24-s1_2-s3_2", // produto 24, s1=2, menor s3
    ]);
  });

  it("empate TOTAL (mesmos pesos) → comparador retorna 0 (ordem estável)", () => {
    const a = task("a", { s1: 3, s2: 3, s3: 3 });
    const b = task("b", { s1: 3, s2: 3, s3: 3 });
    expect(compareHierarq(a, b)).toBe(0);
  });
});
