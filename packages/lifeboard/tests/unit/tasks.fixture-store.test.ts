import { beforeEach, describe, expect, it } from "vitest";

import {
  arestaAddFixture,
  definirPredecessorIdsFixture,
  parentSetFixture,
  resetarFixtureStore,
} from "@/lib/repositories/tasks.fixture-store";

/**
 * OS-LIFEBOARD · P6 — testes diretos (sem mock) do store mutável do fixture.
 * `tarefa-actions.test.ts` mocka este módulo inteiro (testa só a VALIDAÇÃO das
 * server actions) — este arquivo é o único que exercita a lógica real de
 * `tasks.fixture-store.ts`, inclusive o anti-ciclo (achado MÉDIO #13).
 */
describe("arestaAddFixture — anti-ciclo lê as 3 fontes de precedência (achado #13, 13/09)", () => {
  beforeEach(resetarFixtureStore);

  it("PRONTO QUANDO: recusa um predecessor circular cuja precedência vem de `predecessorIds` (task-setup → task-build)", () => {
    // Nota: no fixture SEMEADO, `predecessorIds`/`successorIds` vêm
    // espelhados nos dois lados (task-build.predecessorIds=[task-setup] E
    // task-setup.successorIds=[task-build]) — então este caso, sozinho, não
    // prova que a 3ª fonte (`predecessorIds` invertido) participa: a 1ª
    // fonte (`successorIds` direto) já bastaria para achar o ciclo. Mantido
    // como teste de regressão do comportamento visível (`task-build →
    // task-setup` fecha setup→build→setup); a prova ISOLADA da 3ª fonte é o
    // teste seguinte (achado BAIXO #9, rodada 2).
    const r = arestaAddFixture("task-build", "task-setup", "predecessor", 1, null);
    expect(r).toEqual({
      erro: "Essa aresta criaria um ciclo de dependências (predecessor circular).",
    });
  });

  it("PRONTO QUANDO [BAIXO #9, crítico 13/09, rodada 2]: recusa um ciclo cuja precedência vem SÓ de `predecessorIds`, sem `successorIds` espelhado do outro lado", () => {
    // `task-standup` e `task-notes-idea` não têm nenhuma relação no fixture
    // semeado (nem array, nem `TaskEdge`) — usamos `definirPredecessorIdsFixture`
    // para fazer `task-notes-idea` apontar `task-standup` como predecessor
    // SEM tocar em `task-standup.successorIds`. Se a aresta `task-standup →
    // task-notes-idea` for recusada por ciclo, foi a 3ª fonte (`predecessorIds`
    // lido ao contrário) que achou sozinha — a 1ª fonte (`successorIds`) está
    // vazia dos dois lados.
    definirPredecessorIdsFixture("task-notes-idea", ["task-standup"]);
    const r = arestaAddFixture("task-notes-idea", "task-standup", "predecessor", 1, null);
    expect(r).toEqual({
      erro: "Essa aresta criaria um ciclo de dependências (predecessor circular).",
    });
  });

  it("aresta predecessor sem ciclo continua aceita normalmente", () => {
    const r = arestaAddFixture("task-docs", "task-triage-inbox", "predecessor", 1, null);
    expect(r).toEqual({ ok: true, id: expect.any(String) as unknown as string });
  });

  it("origem inexistente → mensagem humanizada, sem citar 'origem' cru", () => {
    const r = arestaAddFixture("fantasma", "task-build", "predecessor", 1, null);
    expect(r).toEqual({ erro: "A tarefa de origem não existe (ou não é sua)." });
  });

  it("destino inexistente → mensagem humanizada", () => {
    const r = arestaAddFixture("task-build", "fantasma", "predecessor", 1, null);
    expect(r).toEqual({ erro: "A tarefa de destino não existe (ou não é sua)." });
  });
});

describe("parentSetFixture — mensagens humanizadas + ciclo de hierarquia (achado #14/#18)", () => {
  beforeEach(resetarFixtureStore);

  it("task_id inexistente → 'A tarefa não existe (ou não é sua).'", () => {
    const r = parentSetFixture("fantasma", "task-build");
    expect(r).toEqual({ erro: "A tarefa não existe (ou não é sua)." });
  });

  it("parent_id inexistente → 'A tarefa mãe não existe (ou não é sua).'", () => {
    const r = parentSetFixture("task-build", "fantasma");
    expect(r).toEqual({ erro: "A tarefa mãe não existe (ou não é sua)." });
  });

  it("ciclo A→B→A → 'viraria ancestral de si mesma' (não mais 'mãe de si mesma')", () => {
    parentSetFixture("task-docs", "task-build"); // docs vira filha de build
    const r = parentSetFixture("task-build", "task-docs"); // build → filha de docs fecharia o ciclo
    expect(r).toEqual({
      erro: "Isso criaria um ciclo de hierarquia: a tarefa viraria ancestral de si mesma.",
    });
  });
});

describe("resetarFixtureStore — devolve o store ao estado seed", () => {
  it("uma mutação some depois do reset", () => {
    const antes = arestaAddFixture("task-docs", "task-standup", "correlacao", 1, null);
    expect(antes).toEqual({ ok: true, id: expect.any(String) as unknown as string });
    resetarFixtureStore();
    // A mesma aresta pode ser adicionada de novo sem "já existe" — prova que
    // o estado voltou ao seed, não acumulou a mutação anterior.
    const depois = arestaAddFixture("task-docs", "task-standup", "correlacao", 1, null);
    expect(depois).toEqual({ ok: true, id: expect.any(String) as unknown as string });
  });
});
