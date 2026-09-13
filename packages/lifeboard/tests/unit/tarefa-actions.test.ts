import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { mutateLifeboard } from "@/lib/supabase/live-client";
import * as fixtureStore from "@/lib/repositories/tasks.fixture-store";
import {
  arestaAddAction,
  arestaDelAction,
  atomosSetAction,
  estimativaSetAction,
  goalSetAction,
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
    expect(r.erro).toMatch(/maior que zero/);
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
    expect(r).toEqual({ erro: "origem e destino não podem ser a mesma tarefa." });
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: tipo fora dos 4 tipos declarados", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "bloqueia" }),
    );
    expect(r.erro).toMatch(/^tipo precisa ser/);
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: peso fora de 0..1", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "sinergia", peso: "1.5" }),
    );
    expect(r).toEqual({ erro: "peso precisa ser um número entre 0 e 1." });
    nenhumaChamadaFoiFeita();
  });

  it("arestaDelAction: sem id", async () => {
    const r = await arestaDelAction({}, form({ task_id: "task-build" }));
    expect(r).toEqual({ erro: "Aresta não identificada." });
    nenhumaChamadaFoiFeita();
  });
});
