import { describe, expect, it } from "vitest";

import { filhosPorPai, herancaEfetiva, herancaEmLote } from "@/core/prioritize/heranca";
import type { Task } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P6 — `herancaEfetiva()`: "a mãe herda esforço e custo como
 * soma RECURSIVA das filhas abertas" (hub, LIFEBOARD-V3-4z-atomos-e-gargalo-
 * 2026-09-13 §5/§6; recursão + guarda de ciclo: achado CRÍTICO #1 do crítico
 * de 13/09 — a v1 só olhava a 1ª geração e o score ignorava tudo isto).
 *
 * v2 (rodada 2, achado ALTO #1 + MÉDIO #4): a soma só vira herança de
 * verdade (`herdado: true`) quando é > 0 — soma zero cai nos átomos próprios
 * (`herdado: false`, `filhasSemAtomos` conta as filhas vazias); e
 * `herancaEmLote` memoiza a árvore inteira numa passada O(N).
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
    expect(r).toEqual({ esforco: 3, custo: 5, herdado: false, filhasAbertas: 0, filhasSemAtomos: 0 });
  });

  it("sem filha e sem átomos próprios, devolve 0/0 (não null) — herdado ainda false", () => {
    const mae = tarefa("mae");
    const r = herancaEfetiva(mae, [mae]);
    expect(r).toEqual({ esforco: 0, custo: 0, herdado: false, filhasAbertas: 0, filhasSemAtomos: 0 });
  });

  it("PRONTO QUANDO: com filhas ABERTAS, soma os átomos delas e ignora os da mãe", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 5, custo: 5 } });
    const f1 = tarefa("f1", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 2, custo: 1 } });
    const f2 = tarefa("f2", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 3, custo: 2 } });
    const r = herancaEfetiva(mae, [mae, f1, f2]);
    expect(r).toEqual({ esforco: 5, custo: 3, herdado: true, filhasAbertas: 2, filhasSemAtomos: 0 });
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
    expect(r).toEqual({ esforco: 3, custo: 2, herdado: true, filhasAbertas: 1, filhasSemAtomos: 0 });
  });

  it("PRONTO QUANDO: todas as filhas concluídas → cai no fallback dos átomos próprios (sem filha aberta)", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 2, custo: 2 } });
    const feita = tarefa("f1", {
      parentId: "mae",
      status: "done",
      assimetria: { opcionalidade: 1, esforco: 5, custo: 5 },
    });
    const r = herancaEfetiva(mae, [mae, feita]);
    expect(r).toEqual({ esforco: 2, custo: 2, herdado: false, filhasAbertas: 0, filhasSemAtomos: 0 });
  });

  it("PRONTO QUANDO [ALTO #1, rodada 2]: filha aberta SEM átomos e sem netas → cai nos átomos PRÓPRIOS da mãe (herdado:false), não herda 0/0", () => {
    // Este era o achado CRÍTICO/ALTO #1 da rodada 2: a v2 marcava `herdado: true`
    // com soma 0/0 aqui, e `assimetria.ts` inflava isso para 1/1 via
    // `Math.max(1, e)` — a mãe ganhava o MELHOR score em vez do pior sinal
    // possível ("subtarefa sem átomo nenhum").
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const semAtomos = tarefa("f1", { parentId: "mae" });
    const r = herancaEfetiva(mae, [mae, semAtomos]);
    expect(r).toEqual({ esforco: 3, custo: 3, herdado: false, filhasAbertas: 1, filhasSemAtomos: 1 });
  });

  it("PRONTO QUANDO [ALTO #1]: mãe + 1 filha vazia + 1 com átomos → soma só da que declarou, herdado:true", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 9, custo: 9 } });
    const vazia = tarefa("vazia", { parentId: "mae" });
    const comAtomos = tarefa("comAtomos", {
      parentId: "mae",
      assimetria: { opcionalidade: 1, esforco: 2, custo: 1 },
    });
    const r = herancaEfetiva(mae, [mae, vazia, comAtomos]);
    expect(r).toEqual({ esforco: 2, custo: 1, herdado: true, filhasAbertas: 2, filhasSemAtomos: 1 });
  });

  it("PRONTO QUANDO: 3 níveis — neta sem átomo próprio herda da bisneta (recursão através de gerações)", () => {
    // mae → filho (sem átomo próprio) → neto (com átomo). O filho não declara
    // nada — mas TEM um neto aberto com átomo, então o filho herda dele, e a
    // mãe herda do filho: a soma chega inteira à raiz, 2 níveis abaixo.
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 9, custo: 9 } });
    const filho = tarefa("filho", { parentId: "mae" }); // sem assimetria própria
    const neto = tarefa("neto", { parentId: "filho", assimetria: { opcionalidade: 1, esforco: 2, custo: 3 } });
    const r = herancaEfetiva(mae, [mae, filho, neto]);
    expect(r).toEqual({ esforco: 2, custo: 3, herdado: true, filhasAbertas: 1, filhasSemAtomos: 0 });

    // Conferido também a partir do filho diretamente — mesmo efetivo.
    const rFilho = herancaEfetiva(filho, [mae, filho, neto]);
    expect(rFilho).toEqual({ esforco: 2, custo: 3, herdado: true, filhasAbertas: 1, filhasSemAtomos: 0 });
  });

  it("PRONTO QUANDO [BAIXO #3, rodada 3]: filha com esforço FORA do domínio (0, só {1,2,3,5} vale) conta como SEM átomos — nunca soma o valor cru", () => {
    // Antes desta correção, `calcularDoMemo` lia `task.assimetria?.esforco`
    // sem checar o domínio (`atomosDeclaradosValidos`) — uma filha com
    // `esforco: 0` (fora do domínio) contribuía `0/3` de verdade; a mãe
    // acabava com esforço efetivo 0 → `assimetria.ts` dividia por zero
    // (`score.valor = Infinity`).
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 3, custo: 3 } });
    const foraDoDominio = tarefa("f1", {
      parentId: "mae",
      assimetria: { opcionalidade: 1, esforco: 0, custo: 3 },
    });
    const r = herancaEfetiva(mae, [mae, foraDoDominio]);
    // A filha inválida conta como SEM átomos — a mãe cai no fallback PRÓPRIO,
    // nunca herda o `esforco: 0` cru.
    expect(r).toEqual({ esforco: 3, custo: 3, herdado: false, filhasAbertas: 1, filhasSemAtomos: 1 });
    expect(Number.isFinite(r.esforco)).toBe(true);
    expect(Number.isFinite(r.custo)).toBe(true);
  });

  it("PRONTO QUANDO [BAIXO #3, rodada 3]: filha com OBJETO inteiro inválido (opcionalidade 7) não contribui esforço/custo, mesmo com esforço/custo individualmente válidos", () => {
    // `atomosDeclaradosValidos` é tudo-ou-nada: `opcionalidade: 7` (fora de
    // 1..3) invalida o objeto INTEIRO — o cartão da filha mostra "sem átomos
    // declarados" (`scoreAssimetriaNucleo` devolve `null`). Antes desta
    // correção, a herança ignorava essa invalidação e ainda somava
    // `esforco`/`custo` (5/5, individualmente dentro de {1,2,3,5}) da filha.
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 2, custo: 2 } });
    const objetoInvalido = tarefa("f1", {
      parentId: "mae",
      assimetria: { opcionalidade: 7, esforco: 5, custo: 5 },
    });
    const r = herancaEfetiva(mae, [mae, objetoInvalido]);
    expect(r).toEqual({ esforco: 2, custo: 2, herdado: false, filhasAbertas: 1, filhasSemAtomos: 1 });
  });

  it("3 níveis com 2 ramos: soma recursiva de cada ramo aberto", () => {
    const mae = tarefa("mae");
    const filhoA = tarefa("filhoA", { parentId: "mae" }); // herda do neto
    const netoA = tarefa("netoA", { parentId: "filhoA", assimetria: { opcionalidade: 1, esforco: 2, custo: 1 } });
    const filhoB = tarefa("filhoB", { parentId: "mae", assimetria: { opcionalidade: 2, esforco: 3, custo: 2 } }); // átomo próprio, sem filha
    const r = herancaEfetiva(mae, [mae, filhoA, netoA, filhoB]);
    expect(r).toEqual({ esforco: 5, custo: 3, herdado: true, filhasAbertas: 2, filhasSemAtomos: 0 });
  });

  it("PRONTO QUANDO: guarda de ciclo — A→B→A não trava; sem átomo algum na roda, cai no fallback (herdado:false)", () => {
    // parentId forma um ciclo: A é filha de B, B é filha de C, C é filha de A.
    // Nenhuma tem átomo próprio — sem a guarda, a recursão nunca pararia.
    const a = tarefa("A", { parentId: "B" });
    const b = tarefa("B", { parentId: "C" });
    const c = tarefa("C", { parentId: "A" });
    const r = herancaEfetiva(a, [a, b, c]);
    // Não trava (o teste terminaria por timeout se travasse) e devolve um
    // número finito e determinístico: a soma da roda inteira é 0 (ninguém
    // declarou átomo) → cai no fallback dos átomos próprios (0/0 aqui),
    // `herdado: false` — não mais o `herdado: true` que a v2 devolvia para
    // uma soma 0/0 (mesmo achado ALTO #1, aplicado ao caso de ciclo).
    expect(r).toEqual({ esforco: 0, custo: 0, herdado: false, filhasAbertas: 1, filhasSemAtomos: 1 });
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

describe("herancaEmLote (achado MÉDIO #4, rodada 2 — memoização O(N))", () => {
  it("PRONTO QUANDO: devolve, para cada tarefa, o MESMO resultado que `herancaEfetiva` tarefa a tarefa", () => {
    const mae = tarefa("mae", { assimetria: { opcionalidade: 2, esforco: 9, custo: 9 } });
    const filho = tarefa("filho", { parentId: "mae" });
    const neto = tarefa("neto", { parentId: "filho", assimetria: { opcionalidade: 1, esforco: 2, custo: 3 } });
    const irmao = tarefa("irmao", { parentId: "mae", assimetria: { opcionalidade: 1, esforco: 1, custo: 1 } });
    const todas = [mae, filho, neto, irmao];

    const lote = herancaEmLote(todas);
    for (const t of todas) {
      expect(lote.get(t.id)).toEqual(herancaEfetiva(t, todas));
    }
  });

  it("guarda de ciclo própria (mesmo resultado de `herancaEfetiva` para A→B→A)", () => {
    const a = tarefa("A", { parentId: "B" });
    const b = tarefa("B", { parentId: "C" });
    const c = tarefa("C", { parentId: "A" });
    const todas = [a, b, c];
    const lote = herancaEmLote(todas);
    expect(lote.get("A")).toEqual(herancaEfetiva(a, todas));
  });

  it("PRONTO QUANDO [BAIXO #2, rodada 3]: ciclo com átomos declarados DIFERENTES em cada nó — TODOS os nós batem entre lote e avulso, em qualquer ordem de `tasks`", () => {
    // Achado do crítico: sem âncora determinística, o nó B do MESMO ciclo
    // dava um valor em `herancaEmLote` ({3,3,herdado:false}) e outro em
    // `herancaEfetiva` ({5,5,herdado:true}) — o "nó que quebra o ciclo"
    // dependia de quem perguntou (`herancaEfetiva(b, …)` sempre entra por B)
    // ou da ordem de `tasks` (`herancaEmLote` entra pelo 1º da array que a
    // descida alcança). Aqui os 3 nós declaram átomos DIFERENTES — se a
    // âncora variasse, os números variariam junto — e o teste confere os 3,
    // não só A, em 3 ordens diferentes do mesmo array.
    const a = tarefa("A", { parentId: "B", assimetria: { opcionalidade: 1, esforco: 1, custo: 1 } });
    const b = tarefa("B", { parentId: "C", assimetria: { opcionalidade: 1, esforco: 3, custo: 3 } });
    const c = tarefa("C", { parentId: "A", assimetria: { opcionalidade: 1, esforco: 5, custo: 5 } });

    const ordens: Task[][] = [
      [a, b, c],
      [b, a, c],
      [c, b, a],
    ];

    let referencia: Map<string, ReturnType<typeof herancaEfetiva>> | null = null;
    for (const todas of ordens) {
      const lote = herancaEmLote(todas);

      // 1) dentro da MESMA ordem, lote bate com avulso para os 3 nós — não
      // só para o que por acaso é o primeiro do array.
      for (const t of todas) {
        expect(lote.get(t.id)).toEqual(herancaEfetiva(t, todas));
      }
      // 2) e entre ORDENS diferentes do array — a âncora não depende da
      // posição de ninguém em `tasks`.
      if (referencia) {
        for (const id of ["A", "B", "C"]) expect(lote.get(id)).toEqual(referencia.get(id));
      } else {
        referencia = lote;
      }
    }

    // Prova adicional, sem depender de qual nó "ganhou": nenhum resultado é
    // NaN/Infinity, e todo mundo com filha aberta é consistente com a soma
    // do que a herança do filho devolveu (a soma bate, não só a forma).
    const finalLote = herancaEmLote([a, b, c]);
    for (const id of ["A", "B", "C"]) {
      const r = finalLote.get(id);
      expect(r).toBeDefined();
      expect(Number.isFinite(r?.esforco)).toBe(true);
      expect(Number.isFinite(r?.custo)).toBe(true);
    }
  });

  it("PRONTO QUANDO [BAIXO #4, rodada 3]: cadeia de parentId com 3000 nós resolve correta e rápido (medido antes: 1029 ms; sem gate de relógio no gate obrigatório)", () => {
    // [BAIXO #4] a asserção de tempo era um `<100ms` de corrida ÚNICA dentro
    // do gate obrigatório (`vitest run`) — uma máquina ocupada falha o gate
    // por lentidão da CI, não por regressão de algoritmo. Agora: a asserção
    // de CORREÇÃO fica sem relógio nenhum (raiz herda 1/1; sem estouro de
    // pilha — o próprio teste rodar até o fim já prova isso), e o tempo vira
    // "melhor de 3 corridas" com folga larga (mesmo padrão de
    // `assimetria.test.ts`), só para flagrar uma regressão GROSSEIRA de
    // O(N²), nunca para travar o gate por ruído de máquina.
    const n = 3000;
    const tasks: Task[] = [];
    for (let i = 0; i < n; i += 1) {
      const id = `t${i}`;
      const parentId = i === 0 ? null : `t${i - 1}`;
      // Só a folha (última) declara átomo — força a cadeia inteira a herdar
      // dela, recursivamente, exatamente o cenário que era quadrático.
      const assimetria = i === n - 1 ? { opcionalidade: 1 as const, esforco: 1 as const, custo: 1 as const } : null;
      tasks.push(tarefa(id, { parentId, assimetria }));
    }

    const mapa = filhosPorPai(tasks);
    let melhorMs = Number.POSITIVE_INFINITY;
    let lote = herancaEmLote(tasks, mapa);
    for (let corrida = 0; corrida < 3; corrida += 1) {
      const inicio = performance.now();
      lote = herancaEmLote(tasks, mapa);
      melhorMs = Math.min(melhorMs, performance.now() - inicio);
    }

    expect(melhorMs).toBeLessThan(500);
    // A raiz herda o átomo da folha através de toda a cadeia — prova que o
    // resultado continua correto, não só rápido; e o teste ter terminado
    // (sem `RangeError: Maximum call stack size exceeded`) prova que não há
    // mais estouro de pilha na cadeia funda.
    expect(lote.get("t0")).toEqual({
      esforco: 1,
      custo: 1,
      herdado: true,
      filhasAbertas: 1,
      filhasSemAtomos: 0,
    });
  });
});

describe("herancaEfetiva/herancaEmLote — ciclo com membro `done` (achado MÉDIO #1, rodada 4)", () => {
  /**
   * Reprodução MÍNIMA do crítico: ciclo `a→b→c→a` de `parentId`, os três com
   * `{opcionalidade:3, esforco:5, custo:5}` (válidos), **b `done`**. Antes
   * desta correção: `herancaEmLote(...).keys()` saía sem `b` (o filtro de
   * "abertas" tirava `b` da lista de filhos ANTES de decidir quem empilha, e
   * o redirecionamento para a âncora do ciclo — achado BAIXO #2, rodada 3 —
   * fazia o `for` externo devolver na hora para `b` sem nunca escrevê-lo);
   * `herancaEfetiva(b, tasks)` caía no fallback `SEM_CONTRIBUICAO`
   * (`{esforco:0,custo:0,herdado:false}`) mesmo `b` tendo átomos válidos —
   * e `assimetria.ts` dividia por esse 0 → `Infinity`.
   */
  function grafoCicloComDone(): { a: Task; b: Task; c: Task; todas: Task[] } {
    const atomos = { opcionalidade: 3 as const, esforco: 5 as const, custo: 5 as const };
    const a = tarefa("a", { parentId: "b", assimetria: atomos });
    const b = tarefa("b", { parentId: "c", assimetria: atomos, status: "done" });
    const c = tarefa("c", { parentId: "a", assimetria: atomos });
    return { a, b, c, todas: [a, b, c] };
  }

  it("PRONTO QUANDO: TODOS os 3 nós ganham entrada em `herancaEmLote` — `b` (done) incluso, nunca `Infinity`/`SEM_CONTRIBUICAO`", () => {
    const { todas } = grafoCicloComDone();
    const lote = herancaEmLote(todas);

    // O bug era literalmente isto: `lote.size` saía 1 ou 2, nunca 3.
    expect([...lote.keys()].sort()).toEqual(["a", "b", "c"]);

    // `b`: o único filho aberto dela mesma (`a`, no anel) está em ciclo — não
    // resolvido a tempo — então `b` cai nos PRÓPRIOS átomos (5/5), não 0/0.
    expect(lote.get("b")).toEqual({
      esforco: 5,
      custo: 5,
      herdado: false,
      filhasAbertas: 1,
      filhasSemAtomos: 1,
    });
    // `c`: seu único filho (`b`) está `done` — não conta para a soma — `c`
    // também cai nos próprios átomos.
    expect(lote.get("c")).toEqual({
      esforco: 5,
      custo: 5,
      herdado: false,
      filhasAbertas: 0,
      filhasSemAtomos: 0,
    });
    // `a`: seu único filho (`c`) está ABERTO e já resolvido (5/5) — herda de
    // verdade.
    expect(lote.get("a")).toEqual({
      esforco: 5,
      custo: 5,
      herdado: true,
      filhasAbertas: 1,
      filhasSemAtomos: 0,
    });

    for (const t of todas) {
      expect(Number.isFinite(lote.get(t.id)?.esforco)).toBe(true);
      expect(Number.isFinite(lote.get(t.id)?.custo)).toBe(true);
    }
  });

  it("PRONTO QUANDO: `herancaEfetiva` avulso bate com `herancaEmLote`, para os 3 nós — inclusive consultando `b` (done) diretamente", () => {
    const { a, b, c, todas } = grafoCicloComDone();
    const lote = herancaEmLote(todas);

    for (const t of [a, b, c]) {
      expect(herancaEfetiva(t, todas)).toEqual(lote.get(t.id));
    }
    // A checagem específica do achado: consultar `b` avulso NUNCA mais
    // devolve o fallback `{esforco:0,custo:0,herdado:false}` de um nó
    // nunca-visitado — `b` tem átomos próprios válidos.
    expect(herancaEfetiva(b, todas)).not.toEqual({
      esforco: 0,
      custo: 0,
      herdado: false,
      filhasAbertas: 0,
      filhasSemAtomos: 0,
    });
  });

  it("PRONTO QUANDO: bate em TODAS as 3 permutações de qual membro do ciclo é `done` (a, depois b, depois c)", () => {
    const atomos = { opcionalidade: 3 as const, esforco: 5 as const, custo: 5 as const };
    const idsDoAnel = ["a", "b", "c"] as const;

    for (const doneId of idsDoAnel) {
      const nos = idsDoAnel.map((id) => {
        const proximo = idsDoAnel[(idsDoAnel.indexOf(id) + 1) % 3];
        return tarefa(id, {
          parentId: proximo,
          assimetria: atomos,
          status: id === doneId ? "done" : "open",
        });
      });
      const lote = herancaEmLote(nos);
      expect([...lote.keys()].sort()).toEqual(["a", "b", "c"]);
      for (const t of nos) {
        expect(herancaEfetiva(t, nos)).toEqual(lote.get(t.id));
        expect(Number.isFinite(lote.get(t.id)?.esforco)).toBe(true);
        expect(Number.isFinite(lote.get(t.id)?.custo)).toBe(true);
      }
    }
  });

  /**
   * Fuzz determinístico (semente FIXA — o mesmo teste sempre gera os MESMOS
   * grafos, sem flakiness): ~50 grafos aleatórios de até 14 nós, com
   * `parentId` aleatório (produz ciclos com frequência — nada impede um
   * `parentId` de apontar "para frente" e fechar um anel), `status`
   * aleatório (`done`/`open`), e átomos aleatórios (alguns válidos, alguns
   * `null`, alguns fora do domínio). PRNG mulberry32 — sem dependência nova,
   * determinístico por construção (mesma seed → mesma sequência sempre).
   */
  function mulberry32(seed: number): () => number {
    let estado = seed;
    return function (): number {
      estado |= 0;
      estado = (estado + 0x6d2b79f5) | 0;
      let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function grafoAleatorio(rand: () => number, n: number): Task[] {
    const ids = Array.from({ length: n }, (_, i) => `n${i}`);
    return ids.map((id) => {
      // parentId aleatório entre TODOS os ids (inclusive os próprios — mas
      // nunca a si mesmo) ou `null` — livre para formar ciclos.
      const candidatos = ids.filter((outroId) => outroId !== id);
      const temPai = rand() < 0.85 && candidatos.length > 0;
      const parentId = temPai ? candidatos[Math.floor(rand() * candidatos.length)] ?? null : null;
      const status = rand() < 0.3 ? "done" : "open";
      const sorteioAtomo = rand();
      let assimetria: Task["assimetria"] = null;
      if (sorteioAtomo < 0.6) {
        const faixas = [1, 2, 3, 5] as const;
        assimetria = {
          opcionalidade: (Math.floor(rand() * 3) + 1) as 1 | 2 | 3,
          esforco: faixas[Math.floor(rand() * faixas.length)] ?? 1,
          custo: faixas[Math.floor(rand() * faixas.length)] ?? 1,
        };
      } else if (sorteioAtomo < 0.75) {
        // fora do domínio de propósito — conta como "sem átomos" na herança.
        assimetria = { opcionalidade: 7, esforco: 0, custo: 0 };
      }
      return tarefa(id, { parentId, status, assimetria });
    });
  }

  it("PRONTO QUANDO [fuzz, semente fixa]: ~50 grafos aleatórios (até 14 nós, com ciclos e `done`) — lote.keys == todos os ids, lote == avulso nó a nó, sempre finito", () => {
    const rand = mulberry32(20260913); // semente fixa — data da rodada, só para ser memorável.
    const RODADAS = 50;

    for (let rodada = 0; rodada < RODADAS; rodada += 1) {
      const n = 2 + Math.floor(rand() * 13); // 2..14 nós.
      const tasks = grafoAleatorio(rand, n);
      const lote = herancaEmLote(tasks);

      expect([...lote.keys()].sort()).toEqual(tasks.map((t) => t.id).sort());

      for (const t of tasks) {
        const avulso = herancaEfetiva(t, tasks);
        const doLote = lote.get(t.id);
        expect(doLote).toEqual(avulso);
        expect(Number.isFinite(doLote?.esforco)).toBe(true);
        expect(Number.isFinite(doLote?.custo)).toBe(true);
        expect(doLote?.esforco).not.toBeNaN();
        expect(doLote?.custo).not.toBeNaN();
      }
    }
  });
});
