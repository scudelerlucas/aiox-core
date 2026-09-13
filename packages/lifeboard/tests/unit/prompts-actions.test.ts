import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/live-client", () => ({
  enfileirarPrompt: vi.fn(async () => ({ ok: true, id: "fila-x" }) as const),
  cancelarPromptFila: vi.fn(async () => ({ ok: true }) as const),
}));

vi.mock("@/lib/repositories/prompts-fila.fixture-store", () => ({
  enfileirarFixture: vi.fn(() => ({ ok: true, id: "fila-x" }) as const),
  cancelarFixture: vi.fn(() => ({ ok: true }) as const),
}));

import { cancelarPromptFila, enfileirarPrompt } from "@/lib/supabase/live-client";
import * as fixtureStore from "@/lib/repositories/prompts-fila.fixture-store";
import { cancelarPromptAction, novoPromptAction } from "@/app/prompts/actions";

/**
 * OS-LIFEBOARD · P7 — os ramos de VALIDAÇÃO das server actions da fila
 * devolvem `{ erro }` em português SEM chamar `enfileirarPrompt`/
 * `cancelarPromptFila` (modo live) nem `enfileirarFixture`/`cancelarFixture`
 * (modo fixture) — mesma disciplina de `tests/unit/tarefa-actions.test.ts`.
 */
function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

function nenhumaChamadaFoiFeita(): void {
  expect(enfileirarPrompt).not.toHaveBeenCalled();
  expect(cancelarPromptFila).not.toHaveBeenCalled();
  for (const fn of Object.values(fixtureStore)) {
    expect(fn as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  }
}

describe("prompts/actions — validação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("novoPromptAction: prompt vazio", async () => {
    const r = await novoPromptAction({}, form({ prompt: "   ", complexidade: "baixa" }));
    expect(r).toEqual({ erro: "Escreva o prompt antes de enviar." });
    nenhumaChamadaFoiFeita();
  });

  it("novoPromptAction: prompt acima de 20000 caracteres", async () => {
    const r = await novoPromptAction(
      {},
      form({ prompt: "a".repeat(20001), complexidade: "baixa" }),
    );
    expect(r).toEqual({ erro: "O prompt passou de 20000 caracteres — encurte antes de enviar." });
    nenhumaChamadaFoiFeita();
  });

  it("novoPromptAction: complexidade inválida", async () => {
    const r = await novoPromptAction({}, form({ prompt: "algo", complexidade: "urgentissima" }));
    expect(r).toEqual({ erro: "complexidade precisa ser uma de: baixa, média, alta, máxima." });
    nenhumaChamadaFoiFeita();
  });

  it("novoPromptAction: válido chama enfileirarFixture em modo fixture (default)", async () => {
    const r = await novoPromptAction({}, form({ prompt: "algo válido", complexidade: "media" }));
    expect(r).toEqual({ ok: true, id: "fila-x", conta: undefined, motivo: undefined });
    expect(fixtureStore.enfileirarFixture).toHaveBeenCalledWith({
      prompt: "algo válido",
      complexidade: "media",
      conta: null,
      criadoPor: null,
      taskId: null,
    });
    expect(enfileirarPrompt).not.toHaveBeenCalled();
  });

  it("cancelarPromptAction: sem id", async () => {
    const r = await cancelarPromptAction({}, form({}));
    expect(r).toEqual({ erro: "Item não identificado." });
    nenhumaChamadaFoiFeita();
  });

  it("cancelarPromptAction: com id chama cancelarFixture em modo fixture", async () => {
    const r = await cancelarPromptAction({}, form({ id: "fila-x" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.cancelarFixture).toHaveBeenCalledWith("fila-x");
    expect(cancelarPromptFila).not.toHaveBeenCalled();
  });
});
