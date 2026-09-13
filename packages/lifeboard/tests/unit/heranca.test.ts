import { describe, expect, it } from "vitest";

import { herancaEfetiva } from "@/core/prioritize/heranca";
import type { Task } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P6 — `herancaEfetiva()`: "a mãe herda esforço e custo como
 * soma RECURSIVA das filhas abertas" (hub, LIFEBOARD-V3-4z-atomos-e-gargalo-
 * 2026-09-13 §5/§6; recursão + guarda de ciclo: achado CRÍTICO #1 do crítico
 * de 13/09 — a v1 só olhava a 1ª geração e o score ignorava tudo isto).
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

describe("herancaEfetiva", () => {
  it("PRONTO QUANDO: sem filha nenhuma, usa os átomos próprios (herdado = false)", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 5 } });
    const r = herancaEfetiva(mae, [mae]);
    expect(r).toEqual({ esforco: 3, custo: 5, herdado: false, filhasAbertas: 0 });
  });

  it("sem filha e sem átomos próprios, devolve 0/0 (não null) — herdado ainda false", () => {
    const mae = tarefa("mae");
    const r = herancaEfetiva(mae, [mae]);
    expect(r).toEqual({ esforco: 0, custo: 0, herdado: false, filhasAbertas: 0 });
  });

  it("PRONTO QUANDO: com filhas ABERTAS, soma os átomos delas e ignora os da mãe", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 5, custo: 5 } });
    const f1 = tarefa("f1", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 2, custo: 1 } });
    const f2 = tarefa("f2", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 3, custo: 2 } });
    const r = herancaEfetiva(mae, [mae, f1, f2]);
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
    const r = herancaEfetiva(mae, [mae, aberta, feita]);
    expect(r).toEqual({ esforco: 3, custo: 2, herdado: true, filhasAbertas: 1 });
  });

  it("PRONTO QUANDO: todas as filhas concluídas → cai no fallback dos átomos próprios (sem filha aberta)", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 2, custo: 2 } });
    const feita = tarefa("f1", {
      parentId: "mae",
      status: "done",
      assimetria: { opcionalidade: 1, esforco: 5, custo: 5 },
    });
    const r = herancaEfetiva(mae, [mae, feita]);
    expect(r).toEqual({ esforco: 2, custo: 2, herdado: false, filhasAbertas: 0 });
  });

  it("filha aberta SEM átomos declarados E sem netas conta como 0 na soma, mas ainda marca herdado", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const semAtomos = tarefa("f1", { parentId: "mae" });
    const r = herancaEfetiva(mae, [mae, semAtomos]);
    expect(r).toEqual({ esforco: 0, custo: 0, herdado: true, filhasAbertas: 1 });
  });

  it("PRONTO QUANDO: 3 níveis — neta sem átomo próprio herda da bisneta (recursão através de gerações)", () => {
    // mae → filho (sem átomo próprio) → neto (com átomo). O filho não declara
    // nada — mas TEM um neto aberto com átomo, então o filho herda dele, e a
    // mãe herda do filho: a soma chega inteira à raiz, 2 níveis abaixo.
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 9, custo: 9 } });
    const filho = tarefa("filho", { parentId: "mae" }); // sem assimetria própria
    const neto = tarefa("neto", { parentId: "filho", assimetria: { opcionalidade: 1, esforco: 2, custo: 3 } });
    const r = herancaEfetiva(mae, [mae, filho, neto]);
    expect(r).toEqual({ esforco: 2, custo: 3, herdado: true, filhasAbertas: 1 });

    // Conferido também a partir do filho diretamente — mesmo efetivo.
    const rFilho = herancaEfetiva(filho, [mae, filho, neto]);
    expect(rFilho).toEqual({ esforco: 2, custo: 3, herdado: true, filhasAbertas: 1 });
  });

  it("3 níveis com 2 ramos: soma recursiva de cada ramo aberto", () => {
    const mae = tarefa("mae");
    const filhoA = tarefa("filhoA", { parentId: "mae" }); // herda do neto
    const netoA = tarefa("netoA", { parentId: "filhoA", assimetria: { opcionalidade: 1, esforco: 2, custo: 1 } });
    const filhoB = tarefa("filhoB", { parentId: "mae", assimetria: { opcionalidade: 2, esforco: 3, custo: 2 } }); // átomo próprio, sem filha
    const r = herancaEfetiva(mae, [mae, filhoA, netoA, filhoB]);
    expect(r).toEqual({ esforco: 5, custo: 3, herdado: true, filhasAbertas: 2 });
  });

  it("PRONTO QUANDO: guarda de ciclo — A→B→A não trava e devolve contribuição zero para o nó em ciclo", () => {
    // parentId forma um ciclo: A é filha de B, B é filha de C, C é filha de A.
    // Nenhuma tem átomo próprio — sem a guarda, a recursão nunca pararia.
    const a = tarefa("A", { parentId: "B" });
    const b = tarefa("B", { parentId: "C" });
    const c = tarefa("C", { parentId: "A" });
    const r = herancaEfetiva(a, [a, b, c]);
    // Não trava (o teste terminaria por timeout se travasse) e devolve um
    // número finito e determinístico: a 2ª visita ao nó já visitado contribui 0.
    expect(r).toEqual({ esforco: 0, custo: 0, herdado: true, filhasAbertas: 1 });
    expect(Number.isFinite(r.esforco)).toBe(true);
    expect(Number.isFinite(r.custo)).toBe(true);
  });

  it("não muta a tarefa nem o array de tarefas recebidos", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const filhas = [tarefa("f1", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 1, custo: 1 } })];
    const todas = [mae, ...filhas];
    const copiaMae = { ...mae };
    const copiaTodas = todas.map((t) => ({ ...t }));
    herancaEfetiva(mae, todas);
    expect(mae).toEqual(copiaMae);
    expect(todas).toEqual(copiaTodas);
  });

  it("filhosMapa pré-construído (uso em lote) devolve o mesmo resultado que sem ele", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 5, custo: 5 } });
    const f1 = tarefa("f1", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 2, custo: 1 } });
    const todas = [mae, f1];

    const semMapa = herancaEfetiva(mae, todas);
    const mapa = new Map<string, Task[]>([["mae", [f1]]]);
    const comMapa = herancaEfetiva(mae, todas, mapa);
    expect(comMapa).toEqual(semMapa);
  });
});
