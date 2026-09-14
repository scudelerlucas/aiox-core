import { describe, expect, it } from "vitest";
import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { DURACAO_PLACEHOLDER } from "@/core/prioritize/tipos-v3";
import { FixtureTasksRepository } from "@/lib/repositories/tasks.fixture";
import type { HierarqScore, Task, TaskEdge, TaskStatus } from "@/types/canonical";

/** Mesma convenção de `tests/unit/dag.test.ts`, estendida com os campos v3. */
interface TaskInput {
  id: string;
  status?: TaskStatus;
  predecessorIds?: string[];
  successorIds?: string[];
  estimativaDias?: number | null;
  isGoal?: boolean;
}

function task(input: TaskInput): Task {
  const hierarq: HierarqScore = { s1: 1, s2: 1, s3: 1 };
  return {
    id: input.id,
    projectId: "p",
    title: input.id,
    notes: null,
    dueDate: null,
    status: input.status ?? "open",
    priorityHierarq: hierarq,
    predecessorIds: input.predecessorIds ?? [],
    successorIds: input.successorIds ?? [],
    sourceId: "s",
    externalRef: input.id,
    updatedAt: "2026-07-09T00:00:00.000Z",
    estimativaDias: input.estimativaDias ?? null,
    iniciadoEm: null,
    parentId: null,
    isGoal: input.isGoal ?? false,
    assimetria: null,
  };
}

function edge(origem: string, destino: string, tipo: TaskEdge["tipo"]): TaskEdge {
  return {
    id: `edge-${origem}-${destino}`,
    origem,
    destino,
    tipo,
    peso: 1,
    nota: null,
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

describe("caminhoCritico — exemplo CANÔNICO de livro-texto", () => {
  /**
   * Grafo (activity-on-node), 7 atividades, goal = G:
   *
   *   A(3) ─┬─► C(2) ─────────────► E(1) ─┐
   *         └─► D(4) ─┬─────────────┘      ├─► G(2)
   *   B(2) ───────────┘         └─► F(3) ──┘
   *
   * Precedências: A→C, A→D, B→D, C→E, D→E, D→F, E→G, F→G.
   *
   * ES/EF (forward pass):
   *   A: 0/3 · B: 0/2 · C: 3/5 · D: 3/7 (max(EF A=3, EF B=2)) · E: 7/8
   *   (max(EF C=5, EF D=7)) · F: 7/10 (ES=EF D=7) · G: 10/12 (max(EF E=8, EF F=10))
   *
   * LS/LF (backward pass, LF(G)=EF(G)=12):
   *   G: 10/12 · F: LF=LS(G)=10, LS=7 · E: LF=LS(G)=10, LS=9
   *   D: LF=min(LS E=9, LS F=7)=7, LS=3 · C: LF=LS(E)=9, LS=7
   *   A: LF=min(LS C=7, LS D=3)=3, LS=0 · B: LF=LS(D)=3, LS=1
   *
   * Folga (LF−EF): A=0 · B=1 · C=4 · D=0 · E=2 · F=0 · G=0.
   * Caminho crítico = A→D→F→G (3+4+3+2 = 12 = duracaoTotal). B, C, E folgam.
   */
  it("PRONTO QUANDO: crítico = {A,D,F,G} e duracaoTotal = 12", () => {
    const tasks = [
      task({ id: "A", estimativaDias: 3 }),
      task({ id: "B", estimativaDias: 2 }),
      task({ id: "C", predecessorIds: ["A"], estimativaDias: 2 }),
      task({ id: "D", predecessorIds: ["A", "B"], estimativaDias: 4 }),
      task({ id: "E", predecessorIds: ["C", "D"], estimativaDias: 1 }),
      task({ id: "F", predecessorIds: ["D"], estimativaDias: 3 }),
      task({ id: "G", predecessorIds: ["E", "F"], estimativaDias: 2, isGoal: true }),
    ];

    const resultado = caminhoCritico(tasks, []);

    expect(resultado.goalId).toBe("G");
    expect(resultado.duracaoTotal).toBe(12);
    expect([...resultado.critico].sort()).toEqual(["A", "D", "F", "G"]);
    expect(resultado.semDuracao).toEqual([]);
    expect(resultado.emCiclo).toEqual([]);

    // Folgas conferidas ponto a ponto (não só o veredito booleano).
    expect(resultado.janelas.get("A")?.folga).toBe(0);
    expect(resultado.janelas.get("B")?.folga).toBe(1);
    expect(resultado.janelas.get("C")?.folga).toBe(4);
    expect(resultado.janelas.get("D")?.folga).toBe(0);
    expect(resultado.janelas.get("E")?.folga).toBe(2);
    expect(resultado.janelas.get("F")?.folga).toBe(0);
    expect(resultado.janelas.get("G")?.folga).toBe(0);
    expect(resultado.janelas.get("G")?.ef).toBe(12);
  });
});

describe("caminhoCritico — fixture real (task-deploy é o goal)", () => {
  it("crítico = setup→build→deploy; task-review tem folga; task-docs fica de fora", async () => {
    const repo = new FixtureTasksRepository();
    const tasks = await repo.listAll();
    const edges = await repo.listEdges();

    const resultado = caminhoCritico(tasks, edges);

    expect(resultado.goalId).toBe("task-deploy");
    // setup (done, duração 0) → build (3d) → deploy (1d) é o ramo mais longo.
    // task-review (placeholder 1d) → deploy tem folga 2: ficar pronto agora
    // não mexe na data do goal (régua de Goldratt) — NÃO é crítico, mesmo
    // tendo outro sucessor (task-chat-followup) fora do caminho do goal.
    expect([...resultado.critico].sort()).toEqual(["task-build", "task-deploy", "task-setup"]);
    expect(resultado.janelas.get("task-review")?.folga).toBe(2);
    expect(resultado.critico.has("task-docs")).toBe(false);
    expect(resultado.janelas.has("task-docs")).toBe(false); // não leva ao goal: sem janela
    expect(resultado.duracaoTotal).toBe(4); // 0 (setup) + 3 (build) + 1 (deploy)
    expect(resultado.janelas.get("task-setup")?.duracao).toBe(0);
    expect(resultado.semDuracao).toContain("task-review"); // sem estimativaDias
  });
});

describe("caminhoCritico — ramo lateral pesado NÃO fabrica crítico (rodada 1 do crítico)", () => {
  it("A→M→G, A→N(5)→G, M→H(10): M tem folga 4 com ou sem H; H não ganha janela", () => {
    const base = [
      task({ id: "A", estimativaDias: 1, successorIds: ["M", "N"] }),
      task({ id: "M", estimativaDias: 1, successorIds: ["G"] }),
      task({ id: "N", estimativaDias: 5, successorIds: ["G"] }),
      task({ id: "G", estimativaDias: 1, isGoal: true }),
    ];
    const semH = caminhoCritico(base, []);
    const comH = caminhoCritico(
      [...base.slice(0, 1), task({ id: "M", estimativaDias: 1, successorIds: ["G", "H"] }), ...base.slice(2),
        task({ id: "H", estimativaDias: 10 })],
      [],
    );
    for (const r of [semH, comH]) {
      expect([...r.critico].sort()).toEqual(["A", "G", "N"]);
      expect(r.janelas.get("M")?.folga).toBe(4);
      expect(r.duracaoTotal).toBe(7);
    }
    expect(comH.janelas.has("H")).toBe(false);
  });
});

describe("caminhoCritico — regras de goal", () => {
  it("vários isGoal: vence o menor id, independente da ordem do array", () => {
    const a = task({ id: "A", estimativaDias: 1, isGoal: true });
    const b = task({ id: "B", estimativaDias: 2, isGoal: true });
    expect(caminhoCritico([a, b], []).goalId).toBe("A");
    expect(caminhoCritico([b, a], []).goalId).toBe("A");
  });

  it("goalId explícito ausente do grafo cai na cascata: isGoal, senão null", () => {
    const a = task({ id: "A", estimativaDias: 1, isGoal: true });
    expect(caminhoCritico([a], [], "nao-existe").goalId).toBe("A");
    expect(caminhoCritico([task({ id: "B", estimativaDias: 1 })], [], "nao-existe").goalId).toBeNull();
  });

  it("goal done: duração 0, duracaoTotal = EF dos predecessores", () => {
    const r = caminhoCritico(
      [task({ id: "A", estimativaDias: 3, successorIds: ["G"] }), task({ id: "G", status: "done", isGoal: true })],
      [],
    );
    expect(r.duracaoTotal).toBe(3);
    expect([...r.critico].sort()).toEqual(["A", "G"]);
  });

  it("goal isolado (ninguém leva a ele): só ele tem janela e é o único crítico", () => {
    const r = caminhoCritico(
      [task({ id: "G", estimativaDias: 2, isGoal: true }), task({ id: "X", estimativaDias: 9 })],
      [],
    );
    expect([...r.critico]).toEqual(["G"]);
    expect(r.janelas.size).toBe(1);
    expect(r.duracaoTotal).toBe(2);
  });

  it("aresta com ponta fora da lista é ignorada", () => {
    const r = caminhoCritico(
      [task({ id: "A", estimativaDias: 1, successorIds: ["G"] }), task({ id: "G", estimativaDias: 1, isGoal: true })],
      [edge("fantasma", "G", "predecessor"), edge("A", "fantasma", "predecessor")],
    );
    expect([...r.critico].sort()).toEqual(["A", "G"]);
    expect(r.duracaoTotal).toBe(2);
  });

  it("não muta tasks nem edges", () => {
    const tasks = [task({ id: "A", estimativaDias: 1, successorIds: ["G"] }), task({ id: "G", estimativaDias: 1, isGoal: true })];
    const edges = [edge("A", "G", "predecessor")];
    const antes = structuredClone({ tasks, edges });
    caminhoCritico(tasks, edges);
    expect({ tasks, edges }).toEqual(antes);
  });
});

describe("caminhoCritico — sem goal", () => {
  it("goalId: null e o caminho mais longo do DAG inteiro", () => {
    // A alimenta dois ramos terminais (nenhuma tarefa é isGoal): B (curto) e
    // C (longo). Sem goal explícito, o "fim mais tardio" é o ramo A→C.
    const tasks = [
      task({ id: "A", estimativaDias: 3 }),
      task({ id: "B", predecessorIds: ["A"], estimativaDias: 2 }),
      task({ id: "C", predecessorIds: ["A"], estimativaDias: 5 }),
    ];

    const resultado = caminhoCritico(tasks, []);

    expect(resultado.goalId).toBeNull();
    expect(resultado.duracaoTotal).toBe(8); // A(3) + C(5)
    expect([...resultado.critico].sort()).toEqual(["A", "C"]);
    expect(resultado.janelas.get("B")?.folga).toBe(3); // 8 − 5 (EF de B)
  });
});

describe("caminhoCritico — tarefa sem duração", () => {
  it("entra com o PLACEHOLDER e aparece em semDuracao", () => {
    const tasks = [task({ id: "solo" })]; // sem estimativaDias, aberta
    const resultado = caminhoCritico(tasks, []);

    expect(resultado.semDuracao).toEqual(["solo"]);
    expect(resultado.janelas.get("solo")?.duracao).toBe(DURACAO_PLACEHOLDER);
  });
});

describe("caminhoCritico — ciclo não derruba o cálculo", () => {
  it("A↔B em emCiclo; C (livre) calcula normalmente; nunca lança", () => {
    const tasks = [
      task({ id: "A", predecessorIds: ["B"] }),
      task({ id: "B", predecessorIds: ["A"] }),
      task({ id: "C", estimativaDias: 2 }),
    ];

    expect(() => caminhoCritico(tasks, [])).not.toThrow();
    const resultado = caminhoCritico(tasks, []);

    expect(resultado.emCiclo.slice().sort()).toEqual(["A", "B"]);
    expect(resultado.janelas.has("A")).toBe(false);
    expect(resultado.janelas.has("B")).toBe(false);
    expect(resultado.janelas.get("C")?.ef).toBe(2);
    expect(resultado.critico.has("A")).toBe(false);
    expect(resultado.critico.has("B")).toBe(false);
  });
});

describe("caminhoCritico — obsolescência", () => {
  it("destino de obsolescência com origem done some do grafo e do crítico", () => {
    const tasks = [
      task({ id: "X", status: "done" }),
      task({ id: "Y", estimativaDias: 2 }), // vira obsoleta
      task({ id: "Z", predecessorIds: ["Y"], estimativaDias: 1, isGoal: true }),
    ];
    const edges = [edge("X", "Y", "obsolescencia")];

    const resultado = caminhoCritico(tasks, edges);

    expect(resultado.janelas.has("Y")).toBe(false); // saiu do grafo
    expect(resultado.critico.has("Y")).toBe(false);
    // Y sumiu ⇒ predecessor "Y" de Z fica órfão ⇒ resolvido (convenção de dag.ts).
    expect(resultado.goalId).toBe("Z");
    expect(resultado.janelas.get("Z")?.es).toBe(0);
    expect(resultado.duracaoTotal).toBe(1);
  });
});

describe("caminhoCritico — duas fontes de precedência, mesma aresta", () => {
  it("successorIds + edge 'predecessor' dizendo A→B contam uma vez", () => {
    const tasks = [
      task({ id: "A", successorIds: ["B"], estimativaDias: 2 }),
      task({ id: "B", estimativaDias: 3, isGoal: true }),
    ];
    const edges = [edge("A", "B", "predecessor")]; // mesma aresta, 2ª fonte

    const resultado = caminhoCritico(tasks, edges);

    // Se a união não deduplicasse, nada aqui quebraria matematicamente (ES usa
    // max, não soma) — mas os valores abaixo confirmam que a aresta dobrada
    // não introduz nenhuma distorção: EF(A) alimenta ES(B) uma única vez.
    expect(resultado.janelas.get("A")?.ef).toBe(2);
    expect(resultado.janelas.get("B")?.es).toBe(2);
    expect(resultado.duracaoTotal).toBe(5);
    expect([...resultado.critico].sort()).toEqual(["A", "B"]);
  });
});

describe("caminhoCritico — rodada 2 do crítico", () => {
  it("durações decimais (0.1 → 0.2 → 0.3): cadeia única é toda crítica, folga lê 0", () => {
    const r = caminhoCritico(
      [
        task({ id: "A", estimativaDias: 0.1, successorIds: ["B"] }),
        task({ id: "B", estimativaDias: 0.2, successorIds: ["G"] }),
        task({ id: "G", estimativaDias: 0.3, isGoal: true }),
      ],
      [],
    );
    expect([...r.critico].sort()).toEqual(["A", "B", "G"]);
    expect(r.janelas.get("A")?.folga).toBe(0);
    expect(r.janelas.get("B")?.folga).toBe(0);
  });

  it("dois ramos empatados por soma de decimais (0.1+0.2 vs 0.3) são ambos críticos", () => {
    const r = caminhoCritico(
      [
        task({ id: "A", estimativaDias: 1, successorIds: ["M", "N"] }),
        task({ id: "M", estimativaDias: 0.1, successorIds: ["M2"] }),
        task({ id: "M2", estimativaDias: 0.2, successorIds: ["G"] }),
        task({ id: "N", estimativaDias: 0.3, successorIds: ["G"] }),
        task({ id: "G", estimativaDias: 1, isGoal: true }),
      ],
      [],
    );
    expect([...r.critico].sort()).toEqual(["A", "G", "M", "M2", "N"]);
  });

  it("dependente cujo único predecessor está em ciclo é tratado como livre (ES 0)", () => {
    const r = caminhoCritico(
      [
        task({ id: "A", estimativaDias: 1, successorIds: ["B"] }),
        task({ id: "B", estimativaDias: 1, successorIds: ["A"] }),
        task({ id: "D", estimativaDias: 5, predecessorIds: ["A"], successorIds: ["G"] }),
        task({ id: "G", estimativaDias: 1, isGoal: true }),
      ],
      [],
    );
    expect([...r.emCiclo].sort()).toEqual(["A", "B"]);
    expect(r.janelas.get("D")?.es).toBe(0);
    expect(r.duracaoTotal).toBe(6);
  });

  it("iniciadoEm não muda o cálculo (fora do escopo do CPM, dia 0 = agora)", () => {
    const base = task({ id: "A", estimativaDias: 3, successorIds: ["G"], status: "in_progress" });
    const g = task({ id: "G", estimativaDias: 1, isGoal: true });
    const semInicio = caminhoCritico([base, g], []);
    const comInicio = caminhoCritico([{ ...base, iniciadoEm: "2020-01-01T00:00:00.000Z" }, g], []);
    expect(comInicio.janelas.get("A")).toEqual(semInicio.janelas.get("A"));
  });
});

describe("caminhoCritico — estimativaDias inválida vira placeholder (rodada 3 do crítico)", () => {
  it.each([
    ["Infinity", Infinity],
    ["NaN", NaN],
    ["zero", 0],
    ["negativa", -2],
  ])("estimativaDias %s → placeholder + semDuracao; duracaoTotal finita", (_nome, valor) => {
    const r = caminhoCritico(
      [task({ id: "A", estimativaDias: valor, successorIds: ["G"] }), task({ id: "G", estimativaDias: 1, isGoal: true })],
      [],
    );
    expect(r.semDuracao).toContain("A");
    expect(r.janelas.get("A")?.duracao).toBe(DURACAO_PLACEHOLDER);
    expect(Number.isFinite(r.duracaoTotal)).toBe(true);
    expect(r.duracaoTotal).toBe(DURACAO_PLACEHOLDER + 1);
  });

  it("goal sem estimativaDias entra em semDuracao e ainda é crítico", () => {
    const r = caminhoCritico([task({ id: "G", isGoal: true })], []);
    expect(r.semDuracao).toEqual(["G"]);
    expect([...r.critico]).toEqual(["G"]);
  });
});
