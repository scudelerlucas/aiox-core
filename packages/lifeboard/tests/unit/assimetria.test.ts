import { describe, expect, it, vi } from "vitest";
import {
  alavanca,
  alcance,
  scoreAssimetria,
  scoreAssimetriaLote,
} from "@/core/prioritize/assimetria";
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
  /** P6 (achado CRÍTICO #1) — para os testes de herança dentro do score. */
  parentId?: string | null;
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
    parentId: input.parentId ?? null,
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

  it("8) scoreAssimetria não muta task/tasks/edges, e não muda a ordem HIERARQ do fixture (property test)", async () => {
    const repo = new FixtureTasksRepository();
    const tasks = await repo.listAll();
    const edges = await repo.listEdges();
    const resultado = cpm();

    // Snapshot ANTES — deep clone, não referência (senão a comparação de
    // "não mutou" seria contra o próprio objeto que teria mudado junto).
    const tasksAntes = structuredClone(tasks);
    const edgesAntes = structuredClone(edges);
    const cpmAntes = structuredClone(resultado);
    const ordemAntes = [...tasks].sort(compareHierarq).map((t) => t.id);

    // Roda o score sobre TODA tarefa do fixture — é o "para cada" do teste
    // de propriedade, não só a task-build/task-docs de antes.
    for (const t of tasks) {
      scoreAssimetria(t, tasks, edges, resultado);
    }

    expect(tasks).toEqual(tasksAntes);
    expect(edges).toEqual(edgesAntes);
    expect(resultado).toEqual(cpmAntes);

    const ordemDepois = [...tasks].sort(compareHierarq).map((t) => t.id);
    expect(ordemDepois).toEqual(ordemAntes);

    // Documentado no cabeçalho do fixture: task-build (S125) vem antes de
    // task-docs (S60) na lista "hoje" — a mesma prova de antes, agora dentro
    // do teste de propriedade em vez de solta sem chamar scoreAssimetria.
    const build = tasks.find((t) => t.id === "task-build");
    const docs = tasks.find((t) => t.id === "task-docs");
    expect(build).toBeDefined();
    expect(docs).toBeDefined();
    if (!build || !docs) return;
    expect(scoreHierarq(build)).toBe(125);
    expect(scoreHierarq(docs)).toBe(60);
    expect(compareHierarq(build, docs)).toBeLessThan(0);
  });

  it("9) duas arestas de obsolescência (1ª origem ABERTA, 2ª origem DONE) → zera mesmo assim", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 3, esforco: 1, custo: 1 } });
    const origemAberta = task({ id: "origem-aberta", status: "open", title: "Ainda não feita" });
    const origemFeita = task({ id: "origem-feita", status: "done", title: "Já feita" });
    const edges = [
      edge({ origem: "origem-aberta", destino: "alvo", tipo: "obsolescencia" }),
      edge({ origem: "origem-feita", destino: "alvo", tipo: "obsolescencia" }),
    ];

    const score = scoreAssimetria(alvo, [alvo, origemAberta, origemFeita], edges, cpm());
    expect(score?.valor).toBe(0);
    expect(score?.obsoleta).toBe(true);
    expect(score?.porque).toContain("Já feita");
  });

  it("10) sinergia cuja origem não existe em `tasks` é ignorada — sem desconto", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 1, esforco: 1, custo: 2 } });
    const edges = [edge({ origem: "fantasma", destino: "alvo", tipo: "sinergia", peso: 0.9 })];

    const score = scoreAssimetria(alvo, [alvo], edges, cpm());
    expect(score?.c).toBe(2); // origem inexistente: nunca desconta
  });

  it("11) peso NaN é ignorado — c fica intacto, valor continua finito", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 1, esforco: 1, custo: 2 } });
    const origem = task({ id: "origem", status: "open" });
    const edges = [edge({ origem: "origem", destino: "alvo", tipo: "sinergia", peso: Number.NaN })];

    const score = scoreAssimetria(alvo, [alvo, origem], edges, cpm());
    expect(score?.c).toBe(2);
    expect(Number.isFinite(score?.valor)).toBe(true);
  });

  it("12) peso 1.5 (fora de 0..1) é ignorado — sem desconto", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 1, esforco: 1, custo: 2 } });
    const origem = task({ id: "origem", status: "open" });
    const edges = [edge({ origem: "origem", destino: "alvo", tipo: "sinergia", peso: 1.5 })];

    const score = scoreAssimetria(alvo, [alvo, origem], edges, cpm());
    expect(score?.c).toBe(2);
  });

  it("13) opcionalidade 100 (fora do domínio 1..3) → null", () => {
    const t = task({ id: "t", assimetria: { opcionalidade: 100, esforco: 1, custo: 1 } });
    expect(scoreAssimetria(t, [t], [], cpm())).toBeNull();
  });

  it("14) esforco 0.001 (fora das faixas 1|2|3|5) → null", () => {
    const t = task({ id: "t", assimetria: { opcionalidade: 1, esforco: 0.001, custo: 1 } });
    expect(scoreAssimetria(t, [t], [], cpm())).toBeNull();
  });

  it("15) custo Infinity → null", () => {
    const t = task({ id: "t", assimetria: { opcionalidade: 1, esforco: 1, custo: Number.POSITIVE_INFINITY } });
    expect(scoreAssimetria(t, [t], [], cpm())).toBeNull();
  });

  it("16) scoreAssimetriaLote devolve os MESMOS valores que scoreAssimetria tarefa a tarefa, no fixture inteiro", async () => {
    const repo = new FixtureTasksRepository();
    const tasks = await repo.listAll();
    const edges = await repo.listEdges();
    const resultado = cpm();

    const lote = scoreAssimetriaLote(tasks, edges, resultado);
    expect(lote.size).toBe(tasks.length);
    for (const t of tasks) {
      const avulso = scoreAssimetria(t, tasks, edges, resultado);
      expect(lote.get(t.id)).toEqual(avulso);
    }
  });
});

describe("scoreAssimetria — herança de e/c (achado CRÍTICO #1, 13/09/2026)", () => {
  it("mãe com 2 filhas ABERTAS (e 2+3, c 1+2) → e=5, c=3 no score, não o átomo próprio da mãe", () => {
    const mae = task({ id: "mae", assimetria: { opcionalidade: 2, esforco: 5, custo: 5 } });
    const f1 = task({ id: "f1", parentId: "mae", assimetria: { opcionalidade: 1, esforco: 2, custo: 1 } });
    const f2 = task({ id: "f2", parentId: "mae", assimetria: { opcionalidade: 1, esforco: 3, custo: 2 } });
    const tasks = [mae, f1, f2];

    const score = scoreAssimetria(mae, tasks, [], cpm());
    expect(score).not.toBeNull();
    expect(score?.e).toBe(5);
    expect(score?.c).toBe(3);
    expect(score?.s2).toBe(2); // opcionalidade nunca herda — é sempre o átomo próprio
    expect(score?.porque).toMatch(/^herdado das subtarefas: /);

    const lote = scoreAssimetriaLote(tasks, [], cpm());
    expect(lote.get("mae")).toEqual(score);
  });

  it("sem filha aberta, e/c do score continuam os átomos próprios (nada muda sem subtarefas)", () => {
    const t = task({ id: "t", assimetria: { opcionalidade: 2, esforco: 3, custo: 2 } });
    const score = scoreAssimetria(t, [t], [], cpm());
    expect(score?.e).toBe(3);
    expect(score?.c).toBe(2);
    expect(score?.porque).not.toMatch(/^herdado/);
  });

  it("sinergia desconta sobre o c EFETIVO (pós-herança), não sobre o declarado da mãe", () => {
    // [BAIXO #3, rodada 3] `custo: 4` (o valor original deste teste) está
    // FORA do domínio — só {1,2,3,5} vale (`FAIXAS_ESFORCO_CUSTO`). Antes da
    // correção de `heranca.ts`, isso passava despercebido (a herança lia o
    // valor cru); agora um átomo fora do domínio conta como "sem átomos", o
    // que mudaria o que este teste queria provar. Troca para `custo: 5`
    // (válido) + `peso: 0.6`, mantendo a mesma prova com números válidos: o
    // desconto incide sobre o EFETIVO herdado da filha (5), nunca sobre o
    // declarado da mãe (2, que daria 2×0,4=0,8 → arredondaria diferente).
    const mae = task({ id: "mae", assimetria: { opcionalidade: 1, esforco: 1, custo: 2 } });
    const f1 = task({ id: "f1", parentId: "mae", assimetria: { opcionalidade: 1, esforco: 1, custo: 5 } });
    const origem = task({ id: "origem", status: "open" });
    const edges = [edge({ origem: "origem", destino: "mae", tipo: "sinergia", peso: 0.6 })];

    const score = scoreAssimetria(mae, [mae, f1, origem], edges, cpm());
    expect(score?.c).toBe(2); // efetivo herdado = 5; ×(1-0.6) = 2
  });
});

describe("scoreAssimetria — sem `Math.max(1, e)` (achado ALTO #1, rodada 2 do crítico)", () => {
  it("PRONTO QUANDO: mãe + 1 subtarefa aberta SEM átomos → usa os átomos PRÓPRIOS da mãe, não 1/1", () => {
    const mae = task({ id: "mae", assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const vazia = task({ id: "vazia", parentId: "mae" }); // sem assimetria — 0/0 crua

    const score = scoreAssimetria(mae, [mae, vazia], [], cpm());
    expect(score).not.toBeNull();
    // s1=1 s2=2 s3=1 (sem CPM/sucessores) → 2; e=3, c=3 → 2/9 = 0,2222…,
    // arredondado a 2 casas (regra do contrato) → 0,22 — não 2/1 = 2 (o que
    // o piso `Math.max(1, e)` removido dava antes).
    expect(score?.e).toBe(3);
    expect(score?.c).toBe(3);
    expect(score?.valor).toBe(0.22);
    expect(score?.porque).not.toMatch(/^herdado/);
  });

  it("PRONTO QUANDO: mãe + 1 vazia + 1 com átomos → soma só da que declarou, herdado:true", () => {
    // esforco/custo declarados só aceitam {1,2,3,5} — 5 aqui (não 9, fora do domínio).
    const mae = task({ id: "mae", assimetria: { opcionalidade: 2, esforco: 5, custo: 5 } });
    const vazia = task({ id: "vazia", parentId: "mae" });
    const comAtomos = task({
      id: "comAtomos",
      parentId: "mae",
      assimetria: { opcionalidade: 1, esforco: 2, custo: 1 },
    });

    const score = scoreAssimetria(mae, [mae, vazia, comAtomos], [], cpm());
    expect(score?.e).toBe(2);
    expect(score?.c).toBe(1);
    expect(score?.porque).toMatch(/^herdado das subtarefas: /);
  });

  it("PRONTO QUANDO: acrescentar uma subtarefa VAZIA a uma mãe com átomo próprio NÃO muda o score (achado medido: A pulava 25×)", () => {
    const mae = task({ id: "mae", assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const antes = scoreAssimetria(mae, [mae], [], cpm());

    const vazia = task({ id: "vazia", parentId: "mae" });
    const depois = scoreAssimetria(mae, [mae, vazia], [], cpm());

    expect(antes).not.toBeNull();
    expect(depois).toEqual(antes);

    // Mesma prova em lote — `scoreAssimetriaLote` usa o caminho memoizado
    // (`herancaEmLote`), tem que bater com o avulso.
    const lote = scoreAssimetriaLote([mae, vazia], [], cpm());
    expect(lote.get("mae")).toEqual(antes);
  });
});

describe("scoreAssimetria — herança respeita o domínio dos átomos (achado BAIXO #3, rodada 3)", () => {
  it("PRONTO QUANDO: filha com esforço FORA do domínio (0) nunca deixa `e` chegar a 0 — score nunca é Infinity", () => {
    // Antes desta correção, `heranca.ts` lia `task.assimetria?.esforco` cru
    // — uma filha com `esforco: 0` (fora de {1,2,3,5}) contribuía 0 de
    // verdade, `e` da mãe virava 0, e `s1*s2*s3/(e*c)` dividia por zero.
    const mae = task({ id: "mae", assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const foraDoDominio = task({
      id: "f1",
      parentId: "mae",
      assimetria: { opcionalidade: 1, esforco: 0, custo: 3 },
    });

    const score = scoreAssimetria(mae, [mae, foraDoDominio], [], cpm());
    expect(score).not.toBeNull();
    expect(score?.e).toBe(3); // fallback nos átomos PRÓPRIOS da mãe — não 0.
    expect(Number.isFinite(score?.valor)).toBe(true);
    expect(score?.valor).not.toBe(Infinity);
    expect(Number.isNaN(score?.valor)).toBe(false);
  });

  it("PRONTO QUANDO: filha com objeto INTEIRO inválido (opcionalidade 7) não contribui esforço/custo, mesmo o cartão dela mostrando 'sem átomos declarados'", () => {
    const mae = task({ id: "mae", assimetria: { opcionalidade: 2, esforco: 2, custo: 2 } });
    const objetoInvalido = task({
      id: "f1",
      parentId: "mae",
      assimetria: { opcionalidade: 7, esforco: 5, custo: 5 },
    });

    // O cartão da filha mostra "sem átomos declarados" — `scoreAssimetria`
    // dela devolve `null`.
    expect(scoreAssimetria(objetoInvalido, [mae, objetoInvalido], [], cpm())).toBeNull();

    // E a mãe NÃO herda o 5/5 individualmente válido dessa filha — cai nos
    // átomos PRÓPRIOS dela (2/2), porque o objeto inteiro da filha é inválido.
    const score = scoreAssimetria(mae, [mae, objetoInvalido], [], cpm());
    expect(score?.e).toBe(2);
    expect(score?.c).toBe(2);
    expect(score?.porque).not.toMatch(/^herdado/);
  });
});

describe("scoreAssimetriaLote — memoização da herança (achado MÉDIO #4, rodada 2)", () => {
  it("PRONTO QUANDO: cadeia de parentId com 3000 nós não é mais quadrática (medido antes: 1029 ms; agora dezenas de ms)", () => {
    const n = 3000;
    const tasks: Task[] = [];
    for (let i = 0; i < n; i += 1) {
      // `t0` (a raiz, a que o teste mede) precisa de átomo PRÓPRIO válido
      // para `scoreAssimetria` não devolver `null` de cara (a regra é: sem
      // `assimetria` declarada na PRÓPRIA tarefa, nem entra na conta da
      // herança) — mas o e/c dela vêm da herança mesmo assim, porque tem
      // filha aberta (a cadeia inteira). Só a folha (última) declara átomo
      // no MEIO da cadeia — força a herança a atravessar os 2999 nós.
      let assimetria: Task["assimetria"] = null;
      if (i === 0) assimetria = { opcionalidade: 2, esforco: 5, custo: 5 };
      if (i === n - 1) assimetria = { opcionalidade: 1, esforco: 1, custo: 1 };
      tasks.push(task({ id: `t${i}`, parentId: i === 0 ? null : `t${i - 1}`, assimetria }));
    }

    // Tempo de parede oscila com a carga da máquina (CI compartilhado, outros
    // processos): mede o MELHOR de 3 corridas e compara com a régua da
    // regressão (1029 ms) com folga larga — o que se prova é "não é mais
    // quadrático", não um número exato.
    let melhorMs = Number.POSITIVE_INFINITY;
    let lote = scoreAssimetriaLote(tasks, [], cpm());
    for (let corrida = 0; corrida < 3; corrida += 1) {
      const inicio = performance.now();
      lote = scoreAssimetriaLote(tasks, [], cpm());
      melhorMs = Math.min(melhorMs, performance.now() - inicio);
    }

    expect(melhorMs).toBeLessThan(500);
    expect(lote.get("t0")?.e).toBe(1);
    expect(lote.get("t0")?.c).toBe(1);
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

describe("scoreAssimetria — rodada 2 do crítico", () => {
  it("obsolescência com duas origens done: o porquê cita a aresta mais antiga, seja qual for a ordem do array", () => {
    const alvo = task({ id: "alvo", assimetria: { opcionalidade: 2, esforco: 1, custo: 1 } });
    const d1 = task({ id: "d1", title: "Primeira Done", status: "done" });
    const d2 = task({ id: "d2", title: "Segunda Done", status: "done" });
    const e1 = edge({ id: "e1", origem: "d1", destino: "alvo", tipo: "obsolescencia", createdAt: "2026-01-01T00:00:00Z" });
    const e2 = edge({ id: "e2", origem: "d2", destino: "alvo", tipo: "obsolescencia", createdAt: "2026-02-01T00:00:00Z" });
    const a = scoreAssimetria(alvo, [alvo, d1, d2], [e1, e2], cpm());
    const b = scoreAssimetria(alvo, [d2, alvo, d1], [e2, e1], cpm());
    expect(a?.porque).toBe("desnecessária: Primeira Done já foi feita");
    expect(b?.porque).toBe(a?.porque);
    expect(a?.valor).toBe(0);
  });

  it("arredonda a 2 casas: 1/3 → 0.33 (a regra do contrato tem teste)", () => {
    const t = task({ id: "t", assimetria: { opcionalidade: 1, esforco: 3, custo: 1 } });
    expect(scoreAssimetria(t, [t], [], cpm())?.valor).toBe(0.33);
  });

  it.each([
    [1, "custa pouco"],
    [1.01, "custa um valor moderado"],
    [2, "custa um valor moderado"],
    [2.5, "custa caro"],
    [3, "custa caro"],
    [3.01, "custa muito caro"],
    [4.9, "custa muito caro"],
    [5, "custa muito caro"],
  ])("faixa do custo no porquê: c=%s → %s (nunca subestima)", (custoEfetivo, frase) => {
    // custo declarado 5 com sinergia de peso p → c = max(1, 5·(1−p)); escolhe p para cair em custoEfetivo
    const t = task({ id: "t", assimetria: { opcionalidade: 1, esforco: 1, custo: 5 } });
    const o = task({ id: "o" });
    const peso = Math.min(1, Math.max(0, 1 - custoEfetivo / 5));
    const r = scoreAssimetria(t, [t, o], [edge({ origem: "o", destino: "t", tipo: "sinergia", peso })], cpm());
    expect(r?.c).toBe(Math.round(custoEfetivo * 100) / 100);
    expect(r?.porque).toContain(frase);
  });
});

describe("scoreAssimetria — guarda defensiva contra e/c inválido (achado MÉDIO #1, rodada 4)", () => {
  /**
   * A correção de `heranca.ts` (mesmo achado) já garante que `efetiva.esforco`
   * nunca chega aqui 0/não-finito para uma tarefa com átomos válidos — mas
   * `assimetria.ts` não pode depender de `heranca.ts` nunca falhar de novo
   * (o comentário antigo "nada mais pode fazer `e` chegar a 0 aqui" já
   * tinha essa mesma garantia e ainda assim se provou falso). Este teste
   * isola a guarda EM SI: mocka `heranca.ts` para devolver um `{esforco:0,
   * custo:0}` hipotético (simulando um defeito FUTURO ali) e prova que o
   * score, mesmo assim, nunca vaza `Infinity`/`NaN` — vira `null`.
   */
  it("PRONTO QUANDO: `herancaEfetiva`/`herancaEmLote` devolvendo esforço 0 (defeito hipotético) → score `null`, nunca `Infinity`", async () => {
    vi.resetModules();
    vi.doMock("@/core/prioritize/heranca", () => ({
      filhosPorPai: () => new Map(),
      herancaEfetiva: () => ({
        esforco: 0,
        custo: 0,
        herdado: false,
        filhasAbertas: 0,
        filhasSemAtomos: 0,
      }),
      herancaEmLote: (tasksDoLote: Task[]) =>
        new Map(
          tasksDoLote.map((t) => [
            t.id,
            { esforco: 0, custo: 0, herdado: false, filhasAbertas: 0, filhasSemAtomos: 0 },
          ]),
        ),
    }));

    try {
      const { scoreAssimetria: scoreAssimetriaComHerancaQuebrada, scoreAssimetriaLote: loteComHerancaQuebrada } =
        await import("@/core/prioritize/assimetria");
      const t = task({ id: "t", assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });

      expect(scoreAssimetriaComHerancaQuebrada(t, [t], [], cpm())).toBeNull();
      expect(loteComHerancaQuebrada([t], [], cpm()).get("t")).toBeNull();
    } finally {
      // Nunca deixar o mock vazar para os outros arquivos de teste do mesmo
      // processo vitest (`vi.doMock` não é hoisted, mas o cache de módulos é
      // compartilhado no processo).
      vi.doUnmock("@/core/prioritize/heranca");
      vi.resetModules();
    }
  });
});
