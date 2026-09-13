import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/live-client", () => ({
  mutateLifeboard: vi.fn(async () => ({ ok: true }) as const),
}));

vi.mock("@/lib/repositories/tasks.fixture-store", () => ({
  notaAddFixture: vi.fn(() => ({ ok: true, id: "note-x" }) as const),
  notaDelFixture: vi.fn(() => ({ ok: true }) as const),
  subtarefaAddFixture: vi.fn(() => ({ ok: true, id: "task-x" }) as const),
  parentSetFixture: vi.fn(() => ({ ok: true }) as const),
  goalSetFixture: vi.fn(() => ({ ok: true }) as const),
  atomosSetFixture: vi.fn(() => ({ ok: true }) as const),
  estimativaSetFixture: vi.fn(() => ({ ok: true }) as const),
  statusSetFixture: vi.fn(() => ({ ok: true }) as const),
  arestaAddFixture: vi.fn(() => ({ ok: true, id: "edge-x" }) as const),
  arestaDelFixture: vi.fn(() => ({ ok: true }) as const),
}));

import { revalidatePath } from "next/cache";

import { mutateLifeboard } from "@/lib/supabase/live-client";
import * as fixtureStore from "@/lib/repositories/tasks.fixture-store";
import {
  arestaAddAction,
  arestaDelAction,
  atomosSetAction,
  estimativaSetAction,
  goalSetAction,
  mutar,
  notaAddAction,
  notaDelAction,
  parentSetAction,
  statusSetAction,
  subtarefaAddAction,
} from "@/app/tarefa/actions";

/**
 * OS-LIFEBOARD · P6 — os ramos de VALIDAÇÃO das server actions da tarefa
 * devolvem `{ erro }` em português SEM chamar `mutateLifeboard` (modo live)
 * nem qualquer função de `tasks.fixture-store` (modo fixture) — a régua de
 * UI/UX (B11 + "erro em português no campo, nunca JSON") é do lado do
 * cliente/servidor da ação, antes de gastar uma chamada.
 */
function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

function nenhumaChamadaFoiFeita(): void {
  expect(mutateLifeboard).not.toHaveBeenCalled();
  for (const fn of Object.values(fixtureStore)) {
    expect(fn as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  }
}

describe("tarefa/actions — validação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notaAddAction: texto vazio", async () => {
    const r = await notaAddAction({}, form({ task_id: "task-build", texto: "   " }));
    expect(r).toEqual({ erro: "Escreva algo antes de salvar a nota." });
    nenhumaChamadaFoiFeita();
  });

  it("notaAddAction: sem task_id", async () => {
    const r = await notaAddAction({}, form({ texto: "algo" }));
    expect(r).toEqual({ erro: "Tarefa não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("notaDelAction: sem id", async () => {
    const r = await notaDelAction({}, form({ task_id: "task-build" }));
    expect(r).toEqual({ erro: "Nota não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: título vazio", async () => {
    const r = await subtarefaAddAction({}, form({ parent_id: "task-build", title: "  " }));
    expect(r).toEqual({ erro: "O título da subtarefa não pode ficar vazio." });
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: sem parent_id", async () => {
    const r = await subtarefaAddAction({}, form({ title: "algo" }));
    expect(r).toEqual({ erro: "Tarefa mãe não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: estimativa <= 0", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "0" }),
    );
    expect(r.erro).toMatch(/0,25/);
    nenhumaChamadaFoiFeita();
  });

  // [BAIXO #10, crítico 13/09, rodada 2] antes desta correção, `subtarefa_add`
  // só exigia `> 0` (aceitava 0,1) enquanto `estimativa_set` exigia `>= 0,25`
  // — o MESMO campo, duas leis diferentes conforme a porta de entrada. Agora
  // as duas usam `estimativaValidaOuErro` (`DURACAO_MINIMA_DIAS`).
  it("subtarefaAddAction: estimativa 0,1 — abaixo do mínimo unificado (0,25); antes era aceita (achado BAIXO #10)", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "0.1" }),
    );
    expect(r.erro).toMatch(/0,25/);
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: título acima do teto (500) é recusado (achado ALTO #2, rodada 2)", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "x".repeat(501) }),
    );
    expect(r.erro).toMatch(/500/);
    nenhumaChamadaFoiFeita();
  });

  it("notaAddAction: autor acima do teto (120) é recusado (achado ALTO #2, rodada 2)", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "nota válida", autor: "x".repeat(121) }),
    );
    expect(r.erro).toMatch(/120/);
    nenhumaChamadaFoiFeita();
  });

  it("parentSetAction: parent_id igual a task_id", async () => {
    const r = await parentSetAction({}, form({ task_id: "task-build", parent_id: "task-build" }));
    expect(r).toEqual({ erro: "Uma tarefa não pode ser mãe de si mesma." });
    nenhumaChamadaFoiFeita();
  });

  it("goalSetAction: sem task_id", async () => {
    const r = await goalSetAction({}, form({ is_goal: "true" }));
    expect(r).toEqual({ erro: "Tarefa não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("atomosSetAction: opcionalidade fora do domínio (1..3)", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "9", esforco: "1", custo: "1" }),
    );
    expect(r.erro).toMatch(/^Átomos inválidos/);
    nenhumaChamadaFoiFeita();
  });

  it("atomosSetAction: esforço fora das faixas {1,2,3,5}", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "2", esforco: "4", custo: "1" }),
    );
    expect(r.erro).toMatch(/^Átomos inválidos/);
    nenhumaChamadaFoiFeita();
  });

  it("estimativaSetAction: abaixo do mínimo (0,25)", async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "0.1" }));
    expect(r.erro).toMatch(/0,25/);
    nenhumaChamadaFoiFeita();
  });

  // ALTO #3 (crítico 13/09) — sem teto superior, isto virava "numeric field
  // overflow" cru vindo do banco (numeric(6,2)). Pego aqui, antes da rede.
  it("estimativaSetAction: acima do teto (9999.99)", async () => {
    const r = await estimativaSetAction(
      {},
      form({ task_id: "task-build", estimativa_dias: "99999999" }),
    );
    expect(r.erro).toMatch(/9999.99 dias/);
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: estimativa acima do teto (9999.99)", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "99999999" }),
    );
    expect(r.erro).toMatch(/9999.99 dias/);
    nenhumaChamadaFoiFeita();
  });

  // ALTO #5 (crítico 13/09) — teto de tamanho do lado do cliente também.
  it("notaAddAction: texto acima de 10000 caracteres", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "a".repeat(10001) }),
    );
    expect(r.erro).toMatch(/10000 caracteres/);
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: nota acima de 2000 caracteres", async () => {
    const r = await arestaAddAction(
      {},
      form({
        origem: "task-build",
        destino: "task-deploy",
        tipo: "correlacao",
        nota: "a".repeat(2001),
      }),
    );
    expect(r.erro).toMatch(/2000 caracteres/);
    nenhumaChamadaFoiFeita();
  });

  it("statusSetAction: status fora do enum", async () => {
    const r = await statusSetAction({}, form({ task_id: "task-build", status: "cancelado" }));
    expect(r.erro).toMatch(/^status precisa ser/);
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: origem igual a destino", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-build", tipo: "predecessor" }),
    );
    expect(r).toEqual({ erro: "A tarefa de origem e a tarefa de destino não podem ser a mesma." });
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: tipo fora dos 4 tipos declarados", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "bloqueia" }),
    );
    expect(r.erro).toMatch(/^O tipo de relação precisa ser/);
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: peso fora de 0..1", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "sinergia", peso: "1.5" }),
    );
    expect(r).toEqual({ erro: "O desconto precisa ser um número entre 0 e 1." });
    nenhumaChamadaFoiFeita();
  });

  it("arestaDelAction: sem id", async () => {
    const r = await arestaDelAction({}, form({ task_id: "task-build" }));
    expect(r).toEqual({ erro: "Aresta não identificada." });
    nenhumaChamadaFoiFeita();
  });
});

/**
 * OS-LIFEBOARD · P6 — achado MÉDIO #7 (crítico 13/09): o arquivo só tinha os
 * ramos de rejeição. Aqui, cada ação com entrada VÁLIDA em modo `live`:
 * chama `mutateLifeboard` com o `(op, payload)` exato do contrato
 * (`0008_lifeboard_v3_escrita_ajustes.sql`) e revalida as rotas certas.
 */
describe("tarefa/actions — sucesso (modo live: mutateLifeboard com op+payload exatos)", () => {
  const modoOriginal = process.env.LIFEBOARD_DATA_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIFEBOARD_DATA_MODE = "live";
  });

  afterEach(() => {
    if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
    else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
  });

  it("notaAddAction", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "uma nota válida", autor: "Lucas" }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith("nota_add", {
      task_id: "task-build",
      texto: "uma nota válida",
      autor: "Lucas",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
    expect(revalidatePath).toHaveBeenCalledWith("/linha-do-tempo");
  });

  it("notaDelAction", async () => {
    const r = await notaDelAction({}, form({ id: "note-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("nota_del", { id: "note-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("subtarefaAddAction", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "nova subtarefa", estimativa_dias: "2" }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith("subtarefa_add", {
      parent_id: "task-build",
      title: "nova subtarefa",
      estimativa_dias: 2,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("parentSetAction", async () => {
    const r = await parentSetAction({}, form({ task_id: "task-docs", parent_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("parent_set", {
      task_id: "task-docs",
      parent_id: "task-build",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-docs");
  });

  it("goalSetAction", async () => {
    const r = await goalSetAction({}, form({ task_id: "task-deploy", is_goal: "true" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("goal_set", {
      task_id: "task-deploy",
      is_goal: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("atomosSetAction", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "2", esforco: "3", custo: "1" }),
    );
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("atomos_set", {
      task_id: "task-build",
      assimetria: { opcionalidade: 2, esforco: 3, custo: 1 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("estimativaSetAction", async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "3.5" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("estimativa_set", {
      task_id: "task-build",
      estimativa_dias: 3.5,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("statusSetAction", async () => {
    const r = await statusSetAction({}, form({ task_id: "task-build", status: "done" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("status_set", {
      task_id: "task-build",
      status: "done",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("arestaAddAction", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "sinergia", peso: "0.5" }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith("aresta_add", {
      origem: "task-build",
      destino: "task-deploy",
      tipo: "sinergia",
      peso: 0.5,
      nota: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("arestaDelAction", async () => {
    const r = await arestaDelAction({}, form({ id: "edge-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("aresta_del", { id: "edge-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });
});

/**
 * [BAIXO #6, rodada 3 do crítico 13/09] os 10 testes de sucesso acima só
 * cobrem `LIFEBOARD_DATA_MODE=live` — o `switch` do despachante fixture em
 * `mutar()` (`src/app/tarefa/actions.ts`) nunca rodava em nenhum teste.
 * Mesmas 10 operações, mesmas entradas VÁLIDAS, mas com o modo default
 * (qualquer valor ≠ "live" cai em fixture — `src/config/env.ts`): cada teste
 * afirma qual função do `tasks.fixture-store` foi chamada, com que
 * argumentos — nunca `mutateLifeboard`.
 */
describe("tarefa/actions — sucesso (modo fixture: tasks.fixture-store com args exatos)", () => {
  const modoOriginal = process.env.LIFEBOARD_DATA_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LIFEBOARD_DATA_MODE;
  });

  afterEach(() => {
    if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
    else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
  });

  function nenhumaChamadaLiveFoiFeita(): void {
    expect(mutateLifeboard).not.toHaveBeenCalled();
  }

  it("notaAddAction", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "uma nota válida", autor: "Lucas" }),
    );
    expect(r).toEqual({ ok: true, id: "note-x" });
    expect(fixtureStore.notaAddFixture).toHaveBeenCalledWith(
      "task-build",
      "uma nota válida",
      "Lucas",
    );
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("notaDelAction", async () => {
    const r = await notaDelAction({}, form({ id: "note-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.notaDelFixture).toHaveBeenCalledWith("note-1");
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("subtarefaAddAction", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "nova subtarefa", estimativa_dias: "2" }),
    );
    expect(r).toEqual({ ok: true, id: "task-x" });
    expect(fixtureStore.subtarefaAddFixture).toHaveBeenCalledWith(
      "task-build",
      "nova subtarefa",
      2,
    );
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("parentSetAction", async () => {
    const r = await parentSetAction({}, form({ task_id: "task-docs", parent_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.parentSetFixture).toHaveBeenCalledWith("task-docs", "task-build");
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-docs");
  });

  it("goalSetAction", async () => {
    const r = await goalSetAction({}, form({ task_id: "task-deploy", is_goal: "true" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.goalSetFixture).toHaveBeenCalledWith("task-deploy", true);
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("atomosSetAction", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "2", esforco: "3", custo: "1" }),
    );
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.atomosSetFixture).toHaveBeenCalledWith("task-build", {
      opcionalidade: 2,
      esforco: 3,
      custo: 1,
    });
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("estimativaSetAction", async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "3.5" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.estimativaSetFixture).toHaveBeenCalledWith("task-build", 3.5);
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("statusSetAction", async () => {
    const r = await statusSetAction({}, form({ task_id: "task-build", status: "done" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.statusSetFixture).toHaveBeenCalledWith("task-build", "done");
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("arestaAddAction", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "sinergia", peso: "0.5" }),
    );
    expect(r).toEqual({ ok: true, id: "edge-x" });
    expect(fixtureStore.arestaAddFixture).toHaveBeenCalledWith(
      "task-build",
      "task-deploy",
      "sinergia",
      0.5,
      null,
    );
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("arestaDelAction", async () => {
    const r = await arestaDelAction({}, form({ id: "edge-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.arestaDelFixture).toHaveBeenCalledWith("edge-1");
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });
});

/**
 * [BAIXO #6, rodada 4 do crítico 13/09] o ramo `default` do dispatcher
 * fixture (`mutar()`) nunca tinha teste — nenhuma action pública chama
 * `mutar` com um `op` fora da lista de `case`s, então o ramo só é alcançável
 * chamando `mutar` diretamente (por isso o export "só para teste" em
 * `actions.ts`). `op` já é tipado como `string` puro (não um union), então
 * nenhum `as`/cast é necessário para "forçar" um valor inválido — passar
 * qualquer string fora da lista já é válido em TypeScript normal.
 */
describe("tarefa/actions — mutar(): operação desconhecida (achado BAIXO #6, rodada 4)", () => {
  const modoOriginal = process.env.LIFEBOARD_DATA_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LIFEBOARD_DATA_MODE; // fixture — é onde o `switch` mora.
  });

  afterEach(() => {
    if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
    else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
  });

  it("devolve a mensagem fixa e loga o valor recebido no console — nunca ecoa `op` na tela", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await mutar("operacao-que-nao-existe", { foo: "bar" });

    expect(r).toEqual({ erro: "Operação desconhecida." });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toContain("operacao-que-nao-existe");
    expect(mutateLifeboard).not.toHaveBeenCalled();
    for (const fn of Object.values(fixtureStore)) {
      expect(fn as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    }

    consoleErrorSpy.mockRestore();
  });
});
