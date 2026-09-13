import { describe, expect, it } from "vitest";

import { heranca } from "@/core/prioritize/heranca";
import type { Task } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P6 — `heranca()`: "a mãe herda esforço e custo como soma
 * das filhas abertas" (hub, LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13 §5/§6).
 */
function tarefa(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: "proj",
    title: id,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "source-1",
    externalRef: id,
    updatedAt: "2026-09-13T00:00:00.000Z",
    estimativaDias: null,
    iniciadoEm: null,
    parentId: null,
    isGoal: false,
    assimetria: null,
    ...overrides,
  };
}

describe("heranca", () => {
  it("PRONTO QUANDO: sem filha nenhuma, usa os átomos próprios (herdado = false)", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 5 } });
    const r = heranca(mae, []);
    expect(r).toEqual({ esforco: 3, custo: 5, herdado: false, filhasAbertas: 0 });
  });

  it("sem filha e sem átomos próprios, devolve 0/0 (não null) — herdado ainda false", () => {
    const mae = tarefa("mae");
    const r = heranca(mae, []);
    expect(r).toEqual({ esforco: 0, custo: 0, herdado: false, filhasAbertas: 0 });
  });

  it("PRONTO QUANDO: com filhas ABERTAS, soma os átomos delas e ignora os da mãe", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 5, custo: 5 } });
    const f1 = tarefa("f1", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 2, custo: 1 } });
    const f2 = tarefa("f2", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 3, custo: 2 } });
    const r = heranca(mae, [f1, f2]);
    expect(r).toEqual({ esforco: 5, custo: 3, herdado: true, filhasAbertas: 2 });
  });

  it("filha CONCLUÍDA (done) não entra na soma", () => {
    const mae = tarefa("mae");
    const aberta = tarefa("f1", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 3, custo: 2 } });
    const feita = tarefa("f2", {
      parentId: "mae",
      status: "done",
      assimetria: { opcionalidade: 1, esforco: 5, custo: 5 },
    });
    const r = heranca(mae, [aberta, feita]);
    expect(r).toEqual({ esforco: 3, custo: 2, herdado: true, filhasAbertas: 1 });
  });

  it("todas as filhas concluídas → cai no fallback dos átomos próprios (sem filha aberta)", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 2, custo: 2 } });
    const feita = tarefa("f1", {
      parentId: "mae",
      status: "done",
      assimetria: { opcionalidade: 1, esforco: 5, custo: 5 },
    });
    const r = heranca(mae, [feita]);
    expect(r).toEqual({ esforco: 2, custo: 2, herdado: false, filhasAbertas: 0 });
  });

  it("filha aberta SEM átomos declarados conta como 0 na soma, mas ainda marca herdado", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const semAtomos = tarefa("f1", { parentId: "mae" });
    const r = heranca(mae, [semAtomos]);
    expect(r).toEqual({ esforco: 0, custo: 0, herdado: true, filhasAbertas: 1 });
  });

  it("não muta a tarefa nem o array de filhas recebidos", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const filhas = [tarefa("f1", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 1, custo: 1 } })];
    const copiaMae = { ...mae };
    const copiaFilhas = filhas.map((f) => ({ ...f }));
    heranca(mae, filhas);
    expect(mae).toEqual(copiaMae);
    expect(filhas).toEqual(copiaFilhas);
  });
});
