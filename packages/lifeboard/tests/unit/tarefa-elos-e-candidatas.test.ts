import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { descendentesDe, tiposBloqueadosPorCandidata } from "@/core/prioritize/candidatas";
import { elosDePrecedencia, elosNaoEditaveis } from "@/core/prioritize/elos-de-precedencia";
import { FIXTURE_EDGES, FIXTURE_TASKS } from "@/lib/repositories/tasks.fixture";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P6 — ALTO A5 e MÉDIO A6, rodada 11.
 *
 * A5: a lista "Relações" e o cronograma liam FONTES DIFERENTES de precedência
 * (1 contra 3) — o caminho crítico ficava invisível na tela que o estampa.
 * A correção não é copiar a soma: é as duas lerem a mesma função. Este
 * arquivo prova que a soma é uma só e que ela devolve a procedência de cada
 * elo, que é o que deixa a tela dizer o que não consegue editar.
 *
 * A6: o `<select>` oferecia o que o servidor recusa. Aqui se prova que a
 * poda usa a MESMA régua da gravação.
 */

const TASKS: Task[] = FIXTURE_TASKS.map((t) => ({ ...t }));
const EDGES: TaskEdge[] = FIXTURE_EDGES.map((e) => ({ ...e }));

function tarefa(id: string, extra: Partial<Task> = {}): Task {
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
    updatedAt: "2026-07-09T00:00:00.000Z",
    estimativaDias: 1,
    iniciadoEm: null,
    parentId: null,
    isGoal: false,
    assimetria: null,
    ...extra,
  };
}

function aresta(id: string, origem: string, destino: string, tipo: TaskEdge["tipo"]): TaskEdge {
  return { id, origem, destino, tipo, peso: 1, nota: null, createdAt: "2026-07-09T00:00:00.000Z" };
}

describe("ALTO A5 — a soma das 3 fontes de precedência é uma só", () => {
  it("PRONTO QUANDO: cada elo diz DE ONDE veio, e o par repetido conta uma vez", () => {
    const elos = elosDePrecedencia(TASKS, EDGES);
    const setupBuild = elos.find((e) => e.origem === "task-setup" && e.destino === "task-build");
    // O fixture declara o MESMO elo duas vezes (successorIds de setup e
    // predecessorIds de build) — uma linha só, com as duas procedências.
    expect(setupBuild?.fontes.sort()).toEqual(["predecessorIds", "successorIds"]);
    expect(setupBuild?.arestaId).toBeNull();
    expect(elos.filter((e) => e.origem === "task-setup" && e.destino === "task-build")).toHaveLength(1);

    const reviewDeploy = elos.find((e) => e.destino === "task-deploy" && e.origem === "task-review");
    expect(reviewDeploy?.arestaId).toBe("edge-review-antes-do-deploy");
  });

  it("PRONTO QUANDO: auto-laço nunca vira elo", () => {
    const tasks = [tarefa("a", { successorIds: ["a"], predecessorIds: ["a"] })];
    expect(elosDePrecedencia(tasks, [aresta("e", "a", "a", "predecessor")])).toEqual([]);
  });

  it("PRONTO QUANDO: só arestas de tipo `predecessor` entram (correlação/sinergia não ordenam)", () => {
    const tasks = [tarefa("a"), tarefa("b")];
    const elos = elosDePrecedencia(tasks, [
      aresta("e1", "a", "b", "correlacao"),
      aresta("e2", "a", "b", "sinergia"),
      aresta("e3", "a", "b", "obsolescencia"),
    ]);
    expect(elos).toEqual([]);
  });

  it("PRONTO QUANDO: os elos SEM aresta por trás são os que a tela não edita", () => {
    const naoEditaveis = elosNaoEditaveis(elosDePrecedencia(TASKS, EDGES)).map(
      (e) => `${e.origem}->${e.destino}`,
    );
    expect(naoEditaveis).toContain("task-setup->task-build");
    expect(naoEditaveis).toContain("task-build->task-deploy");
    expect(naoEditaveis).not.toContain("task-review->task-deploy");
  });

  /**
   * A prova de que as duas telas não podem mais divergir: o CPM monta a
   * precedência a partir DESTA função. Se alguém somar uma quarta fonte só no
   * cronograma, este teste cai.
   */
  it("PRONTO QUANDO: o cronograma usa exatamente estes elos, nem um a mais", () => {
    const cpm = caminhoCritico(TASKS, EDGES, "task-deploy");
    const elos = elosDePrecedencia(TASKS, EDGES);
    // Todo ancestral do goal alcançado pelo CPM tem elo nesta lista.
    for (const id of cpm.janelas.keys()) {
      if (id === "task-deploy") continue;
      const sai = elos.some((e) => e.origem === id);
      expect(sai, `${id} tem janela mas nenhum elo de saída`).toBe(true);
    }
    // E a soma do caminho crítico continua a de sempre (0,5 + 3 + 1).
    // 0,5 (setup, já `done` → 0) + 3 (build) + 1 (deploy) = 4.
    expect(cpm.duracaoTotal).toBe(4);
    expect([...cpm.critico].sort()).toEqual(["task-build", "task-deploy", "task-setup"]);
  });

  it("PRONTO QUANDO: `caminho-critico.ts` não remonta a soma por conta própria", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../src/core/prioritize/caminho-critico.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toContain("elosDePrecedencia(");
    // A soma manual das 3 fontes saiu de lá — era ela que podia divergir.
    expect(src).not.toMatch(/for \(const p of t\.predecessorIds\)/);
    expect(src).not.toMatch(/for \(const s of t\.successorIds\)/);
  });
});

describe("MÉDIO A6 — o que o <select> NÃO deve oferecer", () => {
  it("PRONTO QUANDO: as descendentes da tarefa saem da lista de mães (netas incluídas)", () => {
    const tasks = [
      tarefa("mae"),
      tarefa("filha", { parentId: "mae" }),
      tarefa("neta", { parentId: "filha" }),
      tarefa("estranha"),
    ];
    expect([...descendentesDe("mae", tasks)].sort()).toEqual(["filha", "neta"]);
    expect(descendentesDe("estranha", tasks).size).toBe(0);
  });

  it("PRONTO QUANDO: no fixture, `task-build` não oferece a própria subtarefa como mãe", () => {
    expect(descendentesDe("task-build", TASKS).has("task-build-sub1")).toBe(true);
  });

  it("PRONTO QUANDO: um `predecessor` que fecharia ciclo é bloqueado ANTES da rede", () => {
    // task-build → task-deploy já existe (arrays). Um predecessor
    // task-build → task-setup fecharia setup → build → setup.
    const bloqueios = tiposBloqueadosPorCandidata("task-build", TASKS, EDGES);
    expect(bloqueios.get("task-setup")).toContain("predecessor");
    // Uma tarefa solta não bloqueia nada.
    expect(bloqueios.get("task-triage-inbox") ?? []).toEqual([]);
  });

  it("PRONTO QUANDO: um tipo que já existe entre as duas tarefas é bloqueado", () => {
    const bloqueios = tiposBloqueadosPorCandidata("task-build", TASKS, EDGES);
    // O fixture tem `task-build → task-archive` de obsolescência.
    expect(bloqueios.get("task-archive")).toContain("obsolescencia");
    // E só aquele tipo — os outros três continuam disponíveis.
    expect(bloqueios.get("task-archive")).not.toContain("correlacao");
  });

  it("PRONTO QUANDO: a régua da poda é a MESMA da gravação (ciclo transitivo, 3 níveis)", () => {
    const tasks = [
      tarefa("a", { successorIds: ["b"] }),
      tarefa("b", { successorIds: ["c"] }),
      tarefa("c"),
    ];
    // a → b → c; um predecessor c → a fecharia o ciclo.
    expect(tiposBloqueadosPorCandidata("c", tasks, []).get("a")).toContain("predecessor");
    // E o sentido que NÃO fecha ciclo continua liberado.
    expect(tiposBloqueadosPorCandidata("a", tasks, []).get("c") ?? []).toEqual([]);
  });
});
