import { beforeEach, describe, expect, it } from "vitest";

import {
  arestaAddFixture,
  arestaDelFixture,
  definirPredecessorIdsFixture,
  listarEdgesFixture,
  listarNotesFixture,
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MÉDIO #4 (rodada 9) — O DESFAZER DE RELAÇÃO NÃO DEVOLVIA A POSIÇÃO NO MODO
 * EM QUE O APP RODA E É TESTADO.
 *
 * `listarEdgesFixture()` devolvia a ordem de inserção do `Map`; o gêmeo
 * `listarNotesFixture()` já ordenava. Medido pelo crítico: excluir a 1ª
 * relação e desfazer a devolvia à posição 2. Em modo live funcionaria
 * (`lifeboard_load` faz `order by e.created_at`, migration 0008), mas NADA no
 * repositório provava isso — o único teste da alegação era um `toContain`
 * sobre a string da migration, nunca uma execução.
 *
 * E o cenário do construtor passava porque o fixture tinha UMA relação saindo:
 * a ordem DENTRO do grupo nunca era exercida. A semente do store ganhou mais
 * duas, e é essa lista de três que estes testes movimentam.
 */
describe("MÉDIO #4 — a ordem das relações no fixture é a do banco vivo", () => {
  beforeEach(resetarFixtureStore);

  /** O grupo "saindo" de `task-build`, na ordem em que a página o mostra. */
  function saindoDeBuild(): string[] {
    return listarEdgesFixture()
      .filter((e) => e.origem === "task-build")
      .map((e) => e.id);
  }

  it("PRONTO QUANDO: o grupo tem ≥ 2 relações — a ordem dentro dele é exercida de verdade", () => {
    expect(saindoDeBuild().length).toBeGreaterThanOrEqual(2);
  });

  it("PRONTO QUANDO: a lista sai por `created_at` crescente, como `order by e.created_at`", () => {
    const datas = listarEdgesFixture().map((e) => e.createdAt);
    expect([...datas].sort()).toEqual(datas);
  });

  it("PRONTO QUANDO: excluir a 1ª do grupo e DESFAZER a devolve à 1ª posição", () => {
    const antes = saindoDeBuild();
    const primeira = listarEdgesFixture().find((e) => e.id === antes[0]);
    expect(primeira).toBeDefined();
    if (!primeira) return;

    expect(arestaDelFixture(primeira.id)).toEqual({ ok: true });
    expect(saindoDeBuild()).toEqual(antes.slice(1));

    // O desfazer manda a data ORIGINAL junto (migration 0017 + o parâmetro
    // `criadoEm` do fixture) — é ela que devolve a posição.
    const r = arestaAddFixture(
      primeira.origem,
      primeira.destino,
      primeira.tipo,
      primeira.peso,
      primeira.nota,
      primeira.createdAt,
    );
    expect("ok" in r).toBe(true);

    const depois = saindoDeBuild();
    expect(depois).toHaveLength(antes.length);
    // A relação restaurada volta para o ÍNDICE 0 — era aqui que ela ia parar
    // no índice 1 (a medição do crítico: "voltou à posição 2, não à 1").
    const restaurada = listarEdgesFixture().find(
      (e) =>
        e.origem === primeira.origem &&
        e.destino === primeira.destino &&
        e.tipo === primeira.tipo,
    );
    expect(restaurada?.createdAt).toBe(primeira.createdAt);
    expect(depois.indexOf(restaurada?.id ?? "")).toBe(0);
    // E a ordem relativa das outras duas não mudou.
    expect(depois.slice(1)).toEqual(antes.slice(1));
  });

  it("sem `criadoEm`, a relação nova entra no FIM do grupo — o comportamento normal", () => {
    const antes = saindoDeBuild();
    const r = arestaAddFixture("task-build", "task-chat-followup", "correlacao", 1, null);
    expect("ok" in r).toBe(true);
    const depois = saindoDeBuild();
    expect(depois.slice(0, antes.length)).toEqual(antes);
    expect(depois).toHaveLength(antes.length + 1);
  });

  it("as notas seguem `order by n.created_at desc` — o gêmeo que já estava certo", () => {
    const datas = listarNotesFixture().map((n) => n.createdAt);
    expect([...datas].sort().reverse()).toEqual(datas);
  });
});
