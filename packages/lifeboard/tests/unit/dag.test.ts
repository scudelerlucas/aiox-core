import { describe, expect, it } from "vitest";
import { detectCycleIds, resolveActionable } from "@/core/prioritize/dag";
import { buildTodayList } from "@/core/prioritize/today";
import type { HierarqScore, Task, TaskStatus } from "@/types/canonical";

interface TaskInput {
  id: string;
  hierarq?: HierarqScore;
  status?: TaskStatus;
  predecessorIds?: string[];
  successorIds?: string[];
}

function task(input: TaskInput): Task {
  return {
    id: input.id,
    projectId: "p",
    title: input.id,
    notes: null,
    dueDate: null,
    status: input.status ?? "open",
    priorityHierarq: input.hierarq ?? { s1: 1, s2: 1, s3: 1 },
    predecessorIds: input.predecessorIds ?? [],
    successorIds: input.successorIds ?? [],
    sourceId: "s",
    externalRef: input.id,
    updatedAt: "2026-07-09T00:00:00.000Z",
  };
}

describe("resolveActionable — dependências (PRD §4 / arch §8)", () => {
  it("PRONTO QUANDO: a lista acionável bate com o esperado e a bloqueada some", () => {
    const tasks = [
      task({ id: "setup", status: "done" }),
      task({ id: "build", hierarq: { s1: 5, s2: 5, s3: 5 }, predecessorIds: ["setup"] }),
      task({ id: "docs", hierarq: { s1: 5, s2: 4, s3: 3 } }),
      task({ id: "deploy", predecessorIds: ["build"] }), // build ainda aberto
    ];
    const { actionable, blocked, cyclic, hasCycle } = resolveActionable(tasks);

    // build é acionável (predecessor 'setup' está done); docs não tem predecessor.
    expect(actionable.map((t) => t.id).sort()).toEqual(["build", "docs"]);
    // deploy fica bloqueada (predecessor 'build' ainda aberto).
    expect(blocked.map((t) => t.id)).toEqual(["deploy"]);
    expect(cyclic).toHaveLength(0);
    expect(hasCycle).toBe(false);
  });

  it("tarefa com predecessor ABERTO nunca aparece como acionável", () => {
    const tasks = [
      task({ id: "a" }), // aberta
      task({ id: "b", predecessorIds: ["a"] }), // depende de 'a' (aberta)
    ];
    const { actionable, blocked } = resolveActionable(tasks);
    expect(actionable.map((t) => t.id)).toEqual(["a"]);
    expect(actionable.map((t) => t.id)).not.toContain("b");
    expect(blocked.map((t) => t.id)).toEqual(["b"]);
  });

  it("predecessor 'done' (presente na lista) resolve → tarefa vira acionável", () => {
    const tasks = [
      task({ id: "a", status: "done" }),
      task({ id: "b", predecessorIds: ["a"] }),
    ];
    expect(resolveActionable(tasks).actionable.map((t) => t.id)).toEqual(["b"]);
  });

  it("[AUTO-DECISION] predecessor AUSENTE da lista é tratado como resolvido", () => {
    const tasks = [task({ id: "b", predecessorIds: ["fantasma-inexistente"] })];
    const { actionable, blocked } = resolveActionable(tasks);
    expect(actionable.map((t) => t.id)).toEqual(["b"]);
    expect(blocked).toHaveLength(0);
  });

  it("concluídas ('done') não são candidatas a acionável nem bloqueada", () => {
    const { actionable, blocked, cyclic } = resolveActionable([
      task({ id: "x", status: "done" }),
    ]);
    expect(actionable).toHaveLength(0);
    expect(blocked).toHaveLength(0);
    expect(cyclic).toHaveLength(0);
  });
});

describe("detectCycleIds — detecção de ciclo (PRD §11 stress-1, espelha trigger E1)", () => {
  it("ciclo A→B→A (via predecessorIds) é detectado; ambos marcados", () => {
    const tasks = [
      task({ id: "A", predecessorIds: ["B"] }),
      task({ id: "B", predecessorIds: ["A"] }),
    ];
    const cyclic = detectCycleIds(tasks);
    expect(cyclic.has("A")).toBe(true);
    expect(cyclic.has("B")).toBe(true);
  });

  it("ciclo expresso via successorIds também é detectado (dupla representação do trigger)", () => {
    const tasks = [
      task({ id: "A", successorIds: ["B"] }), // A → B
      task({ id: "B", successorIds: ["A"] }), // B → A
    ];
    const cyclic = detectCycleIds(tasks);
    expect(cyclic.has("A")).toBe(true);
    expect(cyclic.has("B")).toBe(true);
  });

  it("auto-referência (X depende de si mesma) é ciclo trivial", () => {
    expect(detectCycleIds([task({ id: "X", predecessorIds: ["X"] })]).has("X")).toBe(true);
  });

  it("grafo acíclico (cadeia linear) não marca ninguém", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", predecessorIds: ["a"] }),
      task({ id: "c", predecessorIds: ["b"] }),
    ];
    expect(detectCycleIds(tasks).size).toBe(0);
  });
});

describe("resolveActionable + buildTodayList — ciclo não derruba o serviço", () => {
  it("tasks do ciclo são EXCLUÍDAS de 'hoje'; tarefas sãs seguem processadas", () => {
    const tasks = [
      task({ id: "A", predecessorIds: ["B"] }), // ciclo A↔B
      task({ id: "B", predecessorIds: ["A"] }),
      task({ id: "livre", hierarq: { s1: 5, s2: 5, s3: 5 } }), // fora do ciclo
    ];

    // Não deve lançar (degradação graciosa).
    const dag = resolveActionable(tasks);
    expect(dag.hasCycle).toBe(true);
    expect(dag.cyclic.map((t) => t.id).sort()).toEqual(["A", "B"]);
    expect(dag.actionable.map((t) => t.id)).toEqual(["livre"]);

    const today = buildTodayList(tasks);
    // 'livre' entra em "hoje"; A e B ficam de fora, em excludedCycles.
    expect(today.items.map((i) => i.task.id)).toEqual(["livre"]);
    expect(today.excludedCycles.map((t) => t.id).sort()).toEqual(["A", "B"]);
  });
});

describe("buildTodayList — lista 'hoje' ordenada + justificativa (PRD §4)", () => {
  const tasks = [
    task({ id: "setup", status: "done" }),
    task({ id: "build", hierarq: { s1: 5, s2: 5, s3: 5 }, predecessorIds: ["setup"] }), // 125
    task({ id: "docs", hierarq: { s1: 5, s2: 4, s3: 3 } }), // 60, s1=5
    task({ id: "review", hierarq: { s1: 3, s2: 4, s3: 5 } }), // 60, s1=3
    task({ id: "deploy", predecessorIds: ["build"] }), // bloqueada
  ];

  it("ordena por HIERARQ e omite bloqueadas/concluídas", () => {
    const ids = buildTodayList(tasks).items.map((i) => i.task.id);
    // build(125) > docs(60,s1=5) > review(60,s1=3). deploy bloqueada; setup done.
    expect(ids).toEqual(["build", "docs", "review"]);
    expect(ids).not.toContain("deploy");
    expect(ids).not.toContain("setup");
  });

  it("cada item carrega uma justificativa curta (topo, desempate por s1)", () => {
    const items = buildTodayList(tasks).items;
    expect(items[0]?.reason).toBe("S alto (125) e sem dependência aberta");
    expect(items[1]?.reason).toBe("S 60, sem dependência aberta");
    // review empata em produto (60) com docs, perde no desempate por s1 (3 < 5).
    expect(items[2]?.reason).toBe("desempate por s1");
  });

  it("um único item pendente recebe a razão 'único item pendente'", () => {
    const only = buildTodayList([task({ id: "solo", hierarq: { s1: 2, s2: 2, s3: 2 } })]);
    expect(only.items).toHaveLength(1);
    expect(only.items[0]?.reason).toBe("único item pendente");
  });
});
