import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { montarGrafoDoDia } from "@/core/prioritize/grafo-do-dia";
import type { Task } from "@/types/canonical";

function tarefa(id: string, isGoal = false): Task {
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
    updatedAt: "2026-09-30T06:00:00.000Z",
    estimativaDias: 1,
    iniciadoEm: null,
    parentId: null,
    isGoal,
    assimetria: null,
  };
}

describe("montarGrafoDoDia com poda", () => {
  it("calcula CPM e scores somente sobre as tarefas que ficam no grafo", () => {
    const conversa = tarefa("conversa-solta");
    const goal = tarefa("goal", true);
    const grafo = montarGrafoDoDia([conversa, goal], [], {
      conversasMaterializadas: new Set([conversa.id]),
      branchesColadas: new Map(),
    });

    expect(grafo.tasksDoGrafo.map((t) => t.id)).toEqual(["goal"]);
    expect(grafo.cpm.janelas.has(conversa.id)).toBe(false);
    expect(grafo.grafoV3.scores).not.toHaveProperty(conversa.id);
    expect(grafo.goalId).toBe("goal");
  });

  it("com proveniência vazia mantém a lista inteira e o resultado anterior", () => {
    const tasks = [tarefa("conversa-solta"), tarefa("goal", true)];
    const grafo = montarGrafoDoDia(tasks, [], {
      conversasMaterializadas: new Set(),
      branchesColadas: new Map(),
    });

    expect(grafo.tasksDoGrafo).toEqual(tasks);
    expect(grafo.goalId).toBe("goal");
    expect(grafo.grafoV3.scores).toHaveProperty("conversa-solta");
  });
});

describe("fiação da poda", () => {
  const pagina = readFileSync(
    fileURLToPath(new URL("../../src/app/page.tsx", import.meta.url)),
    "utf8",
  );
  const rota = readFileSync(
    fileURLToPath(new URL("../../src/app/api/grafo-bruto/route.ts", import.meta.url)),
    "utf8",
  );

  it("a página usa a proveniência e publica só tasksDoGrafo, mas Hoje recebe tasks", () => {
    expect(pagina).toMatch(/listConversasMaterializadas\?\.\(\)/);
    expect(pagina).toMatch(/listBranchesColadas\?\.\(\)/);
    expect(pagina).toMatch(/montarGrafoDoDia\(tasks, edges, \{/);
    expect(pagina).toMatch(/buildTodayList\(tasks\)/);
    expect(pagina).toMatch(/tasks=\{tasksDoGrafo\}/);
    expect(pagina).toMatch(/grafoV3=\{grafoV3\}/);
  });

  it("a rota usa a proveniência e serializa tarefas a partir de tasksDoGrafo", () => {
    expect(rota).toMatch(/listConversasMaterializadas\?\.\(\)/);
    expect(rota).toMatch(/listBranchesColadas\?\.\(\)/);
    expect(rota).toMatch(/montarGrafoDoDia\(tasks, edges, \{/);
    expect(rota).toMatch(/tarefas: tasksDoGrafo\.map/);
    expect(rota).toMatch(/arestas: edgesDoGrafo\.map/);
  });
});
