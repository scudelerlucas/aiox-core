import { describe, expect, it } from "vitest";
import { alavanca, alcance, scoreAssimetria } from "@/core/prioritize/assimetria";
import { compareHierarq, scoreHierarq } from "@/core/prioritize/hierarq";
import type { ResultadoCPM } from "@/core/prioritize/tipos-v3";
import { FixtureTasksRepository } from "@/lib/repositories/tasks.fixture";
import type {
  AssimetriaDeclarada,
  HierarqScore,
  Task,
  TaskEdge,
  TaskStatus,
} from "@/types/canonical";

interface TaskInput {
  id: string;
  hierarq?: HierarqScore;
  status?: TaskStatus;
  predecessorIds?: string[];
  successorIds?: string[];
  assimetria?: AssimetriaDeclarada | null;
  title?: string;
}

/** Task mínima do modelo canônico — mesmo helper de hierarq.test.ts/dag.test.ts. */
function task(input: TaskInput): Task {
  return {
    id: input.id,
    projectId: "p",
    title: input.title ?? input.id,
    notes: null,
    dueDate: null,
    status: input.status ?? "open",
    priorityHierarq: input.hierarq ?? { s1: 1, s2: 1, s3: 1 },
    predecessorIds: input.predecessorIds ?? [],
    successorIds: input.successorIds ?? [],
    sourceId: "s",
    externalRef: input.id,
    updatedAt: "2026-07-09T00:00:00.000Z",
    assimetria: input.assimetria ?? null,
  };
}

function edge(overrides: Partial<TaskEdge> & Pick<TaskEdge, "origem" | "destino" | "tipo">): TaskEdge {
  return {
    id: `${overrides.origem}->${overrides.destino}`,
    peso: 1,
    nota: null,
    createdAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

/** ResultadoCPM montado à mão (P2 é construída em paralelo — não se importa dela). */
function cpm(overrides: Partial<ResultadoCPM> = {}): ResultadoCPM {
  return {
    goalId: null,
    critico: new Set<string>(),
    janelas: new Map(),
    semDuracao: [],
    duracaoTotal: 0,
    emCiclo: [],
    ...overrides,
  };
}

describe("scoreAssimetria — contrato P3 (tipos-v3.ts)", () => {
  it("1) sem `assimetria` declarada → null", () => {
    const t = task({ id: "sem-atomos" });
    expect(scoreAssimetria(t, [t], [], cpm())).toBeNull();
  });

  it("2) no caminho crítico, 5 sucessores, opcionalidade 3, e=1, c=1 → s1=3 s3=3 valor=27", () => {
    const alvo = task({
      id: "alvo",
      assimetria: { opcionalidade: 3, esforco: 1, custo: 1 },
      successorIds: ["s1", "s2"],
    });
    // 5 sucessores TRANSITIVOS: s1,s2 diretos + s3,s4 (via s1) + s5 (via s2).
    const tasks = [
      alvo,
      task({ id: "s1", successorIds: ["s3", "s4"] }),
      task({ id: "s2", successorIds: ["s5"] }),
      task({ id: "s3" }),
      task({ id: "s4" }),
      task({ id: "s5" }),
    ];
    const resultado = cpm({ critico: new Set(["alvo"]) });

    const score = scoreAssimetria(alvo, tasks, [], resultado);
    expect(score).not.toBeNull();
    expect(score?.s1).toBe(3);
    expect(score?.s3).toBe(3);
    expect(score?.valor).toBe(27);
    expect(score?.obsoleta).toBe(false);
  });

  it("3) mesma tarefa fora do CPM e sem sucessores → s1=1 s3=1 valor=3", () => {
    const alvo = task({
      id: "alvo",
      assimetria: { opcionalidade: 3, esforco: 1, custo: 1 },
    });
    const score = scoreAssimetria(alvo, [alvo], [], cpm());
    expect(score?.s1).toBe(1);
    expect(score?.s3).toBe(1);
    expect(score?.valor).toBe(3);
  });

  it("4) sinergia de origem ABERTA (peso 0.5) desconta c=2 → c=1 (max com 1); origem DONE não desconta", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 1, esforco: 1, custo: 2 } });
    const origemAberta = task({ id: "origem-aberta", status: "open" });
    const edges = [edge({ origem: "origem-aberta", destino: "alvo", tipo: "sinergia", peso: 0.5 })];

    const comDesconto = scoreAssimetria(alvo, [alvo, origemAberta], edges, cpm());
    expect(comDesconto?.c).toBe(1); // 2 × (1 − 0.5) = 1 → max(1,1) = 1

    const origemFeita = task({ id: "origem-aberta", status: "done" });
    const semDesconto = scoreAssimetria(alvo, [alvo, origemFeita], edges, cpm());
    expect(semDesconto?.c).toBe(2); // origem done: sinergia não se aplica mais
  });

  it("5) obsolescência com origem DONE → valor 0, obsoleta true, porquê cita o título da origem", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 3, esforco: 1, custo: 1 } });
    const origem = task({ id: "origem", status: "done", title: "Configurar ambiente" });
    const edges = [edge({ origem: "origem", destino: "alvo", tipo: "obsolescencia" })];

    const score = scoreAssimetria(alvo, [alvo, origem], edges, cpm());
    expect(score?.valor).toBe(0);
    expect(score?.obsoleta).toBe(true);
    expect(score?.porque).toContain("Configurar ambiente");
  });

  it("5b) obsolescência com origem AINDA ABERTA não zera nada", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 3, esforco: 1, custo: 1 } });
    const origem = task({ id: "origem", status: "open" });
    const edges = [edge({ origem: "origem", destino: "alvo", tipo: "obsolescencia" })];

    const score = scoreAssimetria(alvo, [alvo, origem], edges, cpm());
    expect(score?.obsoleta).toBe(false);
    expect(score?.valor).toBeGreaterThan(0);
  });

  it("6) alcance com ciclo A→B→A não trava e devolve faixa coerente", () => {
    const a = task({ id: "A", successorIds: ["B"] });
    const b = task({ id: "B", successorIds: ["A"] });
    // De A: alcança só B (A não conta a si mesma) → 1 sucessor transitivo → faixa 2.
    expect(alcance("A", [a, b], [])).toBe(2);
    expect(alcance("B", [a, b], [])).toBe(2);
  });

  it("7) átomo declarado inválido (custo 0, esforco string) → null", () => {
    // JSON.parse devolve `any`: permite montar um valor runtime inválido sem
    // `as` mentiroso — é exatamente o dado malformado que a validação existe
    // para pegar (ninguém no TypeScript normal escreveria esforco: "3").
    const assimetriaInvalida: AssimetriaDeclarada = JSON.parse(
      '{"opcionalidade":3,"esforco":"3","custo":0}',
    );
    const t = task({ id: "invalida", assimetria: assimetriaInvalida });
    expect(scoreAssimetria(t, [t], [], cpm())).toBeNull();
  });

  it("8) HIERARQ (scoreHierarq/compareHierarq) continua com a MESMA ordem — P3 não mudou produção", async () => {
    const repo = new FixtureTasksRepository();
    const tasks = await repo.listAll();
    const build = tasks.find((t) => t.id === "task-build");
    const docs = tasks.find((t) => t.id === "task-docs");
    expect(build).toBeDefined();
    expect(docs).toBeDefined();
    if (!build || !docs) return;

    // Documentado no cabeçalho do fixture: task-build (S125) vem antes de
    // task-docs (S60) na lista "hoje" — prova de que HIERARQ não mudou.
    expect(scoreHierarq(build)).toBe(125);
    expect(scoreHierarq(docs)).toBe(60);
    expect(compareHierarq(build, docs)).toBeLessThan(0);
  });
});

describe("alavanca — átomo s1", () => {
  it("3 quando o id está em cpm.critico", () => {
    expect(alavanca("x", cpm({ critico: new Set(["x"]) }))).toBe(3);
  });

  it("2 quando há janela e a folga é < 2 dias", () => {
    const resultado = cpm({
      janelas: new Map([["x", { es: 0, ef: 1, ls: 1, lf: 1.5, folga: 1, duracao: 1 }]]),
    });
    expect(alavanca("x", resultado)).toBe(2);
  });

  it("1 quando há janela mas a folga é ≥ 2 dias", () => {
    const resultado = cpm({
      janelas: new Map([["x", { es: 0, ef: 1, ls: 3, lf: 4, folga: 3, duracao: 1 }]]),
    });
    expect(alavanca("x", resultado)).toBe(1);
  });

  it("1 quando o id nem aparece no CPM", () => {
    expect(alavanca("fantasma", cpm())).toBe(1);
  });
});

describe("alcance — átomo s3 (mesmas 3 fontes de precedência do CPM)", () => {
  it("conta sucessor declarado via `TaskEdge` tipo predecessor", () => {
    const a = task({ id: "A" });
    const b = task({ id: "B" });
    const c = task({ id: "C" });
    const edges = [
      edge({ origem: "A", destino: "B", tipo: "predecessor" }),
      edge({ origem: "B", destino: "C", tipo: "predecessor" }),
    ];
    expect(alcance("A", [a, b, c], edges)).toBe(2); // B e C → 2 sucessores → faixa 2
  });

  it("conta sucessor via `predecessorIds` lido ao contrário", () => {
    const a = task({ id: "A" });
    const b = task({ id: "B", predecessorIds: ["A"] }); // A → B
    expect(alcance("A", [a, b], [])).toBe(2);
  });

  it("0 sucessores → faixa 1; 4+ → faixa 3", () => {
    const isolada = task({ id: "sozinha" });
    expect(alcance("sozinha", [isolada], [])).toBe(1);

    const raiz = task({ id: "raiz", successorIds: ["f1", "f2", "f3", "f4"] });
    const filhos = ["f1", "f2", "f3", "f4"].map((id) => task({ id }));
    expect(alcance("raiz", [raiz, ...filhos], [])).toBe(3);
  });
});
