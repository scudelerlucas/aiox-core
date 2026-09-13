import { describe, expect, it } from "vitest";

import { passaNoFiltro } from "@/lib/filtro-de-fontes";
import { buildTodayList } from "@/core/prioritize/server-only";
import { normalizeHierarq } from "@/lib/supabase/normalize-task";
import { DEFAULT_HIERARQ, type Task } from "@/types/canonical";

/**
 * Segunda rodada do crítico hostil sobre o incidente de 13/09/2026. O conserto
 * de `kind`/`status` fechou a porta que caiu naquele dia; estes testes fecham
 * as duas que ficaram abertas para o MESMO HTTP 500 na rota `/`.
 */

function tarefa(parcial: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    projectId: "p-1",
    title: "Tarefa",
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 2, s2: 2, s3: 2 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "s-1",
    externalRef: "ext-1",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...parcial,
  };
}

describe("score HIERARQ que chega torto do Postgres", () => {
  /**
   * `public.tasks.priority_hierarq` é `jsonb NOT NULL` — e `NOT NULL` em jsonb
   * NÃO barra o valor JSON `null`: `'null'::jsonb` passa pela constraint, e a
   * coluna não tem CHECK de forma. A RPC devolve o jsonb cru.
   */
  it("derrubaria a home: desestruturar um score nulo lança dentro de buildTodayList", () => {
    const torta = tarefa({
      priorityHierarq: null as unknown as Task["priorityHierarq"],
    });
    expect(() => buildTodayList([torta])).toThrow();
  });

  it("saneado na fronteira, o mesmo dado vira o score neutro e a home renderiza", () => {
    const score = normalizeHierarq(null);
    expect(score).toEqual(DEFAULT_HIERARQ);
    expect(() =>
      buildTodayList([tarefa({ priorityHierarq: score })]),
    ).not.toThrow();
  });

  it("cobre as outras formas tortas que o banco aceita", () => {
    for (const bruto of [
      undefined,
      {},
      { s1: 3 },
      { s1: "3", s2: 2, s3: 1 },
      { s1: Number.NaN, s2: 2, s3: 1 },
      [1, 2, 3],
      "3",
    ]) {
      expect(normalizeHierarq(bruto)).toEqual(DEFAULT_HIERARQ);
    }
  });

  it("não mexe num score bem formado", () => {
    expect(normalizeHierarq({ s1: 3, s2: 5, s3: 2 })).toEqual({
      s1: 3,
      s2: 5,
      s3: 2,
    });
  });
});

describe("filtro por fonte", () => {
  /**
   * Antes, "sem filtro" era uma lista fixa dos 5 kinds conhecidos em julho. A
   * fonte `lms` (Cativa, no banco desde 12/08) não entrava nela: toda tarefa
   * dela sumiria da lista de hoje sem nada na tela dizer por quê.
   */
  it("filtro vazio mostra até a fonte que não está na união do TypeScript", () => {
    expect(passaNoFiltro("lms" as never, [])).toBe(true);
    expect(passaNoFiltro("calendar", [])).toBe(true);
    expect(passaNoFiltro(undefined, [])).toBe(true);
  });

  it("filtro com seleção restringe de verdade", () => {
    expect(passaNoFiltro("calendar", ["calendar"])).toBe(true);
    expect(passaNoFiltro("gmail", ["calendar"])).toBe(false);
    expect(passaNoFiltro("lms" as never, ["calendar"])).toBe(false);
  });

  it("tarefa sem fonte conhecida nunca some da lista", () => {
    expect(passaNoFiltro(undefined, ["calendar"])).toBe(true);
  });
});
