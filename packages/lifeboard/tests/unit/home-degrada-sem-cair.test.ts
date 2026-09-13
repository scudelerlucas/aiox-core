import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

/**
 * P4b (achado MÉDIO #12 do crítico hostil): os dois testes acima cobrem o
 * caminho da LISTA "hoje" (`buildTodayList`), mas nunca o caminho do CPM v3
 * (`caminhoCritico`/`scoreAssimetriaLote`) que `page.tsx` também chama dentro
 * do MESMO `try`. Uma exceção ali (ex.: um goal com ciclo que o algoritmo não
 * blinda, um dado do banco fora do que o CPM espera) tinha o mesmo poder de
 * derrubar a home com HTTP 500 — e nenhum teste provava que o `catch` cobria
 * essa frente também.
 */
vi.mock("@/core/prioritize/caminho-critico", () => ({
  caminhoCritico: () => {
    throw new Error("CPM explodiu — simula um goal/ciclo que o algoritmo não blinda");
  },
}));
/**
 * `factory.ts` importa os DOIS repositórios (fixture e Supabase) incondicio-
 * nalmente — o flip é em runtime (`LIFEBOARD_DATA_MODE`), não no import. O
 * módulo Supabase carrega `live-client.ts`, que chama `cache()` (API do React
 * que só existe dentro do bundler do Next, não em `react` puro sob Vitest) NO
 * TOPO DO MÓDULO — quebra só de importar, mesmo em modo fixture. Sem relação
 * com o achado #12; stub mínimo (nunca chamado, `LIFEBOARD_DATA_MODE` não
 * setada → fixture) só para o import não derrubar o teste.
 */
vi.mock("@/lib/supabase/live-client", () => ({
  loadLifeboardState: async () => {
    throw new Error("stub de teste — não deveria ser chamado em modo fixture");
  },
  mutateLifeboard: async () => ({ erro: "stub de teste" }),
}));

describe("Page() — o catch cobre também o caminho crítico (CPM), não só a lista de hoje", () => {
  it("caminhoCritico lançando ainda resolve para o fallback NaoConsegui (nunca HTTP 500)", async () => {
    // LIFEBOARD_DATA_MODE não setada → factory cai no fixture (env.ts):
    // zero I/O, zero rede, o teste exercita só o `try/catch` de `page.tsx`.
    const { default: Page } = await import("@/app/page");
    const elemento = await Page();
    const html = renderToStaticMarkup(elemento);
    expect(html).toContain("Não consegui ler as tarefas de hoje agora");
    expect(html).not.toContain("500");
  });
});
