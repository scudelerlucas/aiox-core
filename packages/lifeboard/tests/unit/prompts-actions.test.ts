import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/live-client", () => ({
  enfileirarPrompt: vi.fn(async () => ({ ok: true, id: "fila-x" }) as const),
  cancelarPromptFila: vi.fn(async () => ({ ok: true }) as const),
  ajustarCustoPrompt: vi.fn(async () => ({ ok: true }) as const),
}));

vi.mock("@/lib/repositories/prompts-fila.fixture-store", () => ({
  enfileirarFixture: vi.fn(() => ({ ok: true, id: "fila-x" }) as const),
  cancelarFixture: vi.fn(() => ({ ok: true }) as const),
  ajustarCustoFixture: vi.fn(() => ({ ok: true }) as const),
}));

// Achado MÉDIO #14: `emailDaSessao()` (em actions.ts) chama isto — mockado
// para não depender de `next/headers` fora de um request real do Next.
const getUserMock = vi.fn(async () => ({ data: { user: { email: "lucasscudeler@gmail.com" } } }));
vi.mock("@/lib/supabase/user-server", () => ({
  createSupabaseUserClient: vi.fn(async () => ({ auth: { getUser: getUserMock } })),
}));

import { cancelarPromptFila, enfileirarPrompt } from "@/lib/supabase/live-client";
import * as fixtureStore from "@/lib/repositories/prompts-fila.fixture-store";
import {
  ajustarCustoPromptAction,
  cancelarPromptAction,
  novoPromptAction,
} from "@/app/prompts/actions";

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
    getUserMock.mockResolvedValue({ data: { user: { email: "lucasscudeler@gmail.com" } } });
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
    expect(r).toMatchObject({ ok: true, id: "fila-x", conta: undefined, mensagem: undefined });
    // Achado MÉDIO #14: criadoPor vem da sessão (mockada acima), nunca de um
    // campo do formulário — o form não manda "criado_por".
    expect(fixtureStore.enfileirarFixture).toHaveBeenCalledWith({
      prompt: "algo válido",
      complexidade: "media",
      conta: null,
      criadoPor: "lucasscudeler@gmail.com",
      taskId: null,
    });
    expect(enfileirarPrompt).not.toHaveBeenCalled();
  });

  it("novoPromptAction: sem sessão (getUser falha) grava criadoPor null, sem quebrar a ação", async () => {
    getUserMock.mockRejectedValueOnce(new Error("sem cookie de sessão"));
    const r = await novoPromptAction({}, form({ prompt: "algo válido", complexidade: "baixa" }));
    expect(r).toMatchObject({ ok: true, id: "fila-x", conta: undefined, mensagem: undefined });
    expect(fixtureStore.enfileirarFixture).toHaveBeenCalledWith({
      prompt: "algo válido",
      complexidade: "baixa",
      conta: null,
      criadoPor: null,
      taskId: null,
    });
  });

  it("novoPromptAction: LIFEBOARD_DATA_MODE=live chama enfileirarPrompt com o payload snake_case certo", async () => {
    const modoOriginal = process.env.LIFEBOARD_DATA_MODE;
    process.env.LIFEBOARD_DATA_MODE = "live";
    try {
      const r = await novoPromptAction(
        {},
        form({ prompt: "prompt live", complexidade: "alta", conta: "lsgpandora@gmail.com" }),
      );
      expect(r).toMatchObject({ ok: true, id: "fila-x", conta: undefined, mensagem: undefined });
      expect(enfileirarPrompt).toHaveBeenCalledWith({
        prompt: "prompt live",
        complexidade: "alta",
        conta: "lsgpandora@gmail.com",
        criado_por: "lucasscudeler@gmail.com",
        task_id: null,
      });
      expect(fixtureStore.enfileirarFixture).not.toHaveBeenCalled();
    } finally {
      if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
      else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
    }
  });

  it("cancelarPromptAction: sem id", async () => {
    const r = await cancelarPromptAction({}, form({}));
    expect(r).toEqual({ erro: "Item não identificado." });
    nenhumaChamadaFoiFeita();
  });

  it("cancelarPromptAction: com id chama cancelarFixture em modo fixture", async () => {
    const r = await cancelarPromptAction({}, form({ id: "fila-x" }));
    // MÉDIO 4 (rodada 6): o `tom` acompanha toda resposta de cancelamento —
    // `sucesso` quando nada foi lançado no dia, `atencao` quando foi.
    expect(r).toEqual({ ok: true, mensagem: undefined, tom: "sucesso" });
    expect(fixtureStore.cancelarFixture).toHaveBeenCalledWith("fila-x");
    expect(cancelarPromptFila).not.toHaveBeenCalled();
  });

  // ── D20 (rodada 4): ajustar custo ────────────────────────────────────────
  it("ajustarCustoPromptAction: sem id", async () => {
    const r = await ajustarCustoPromptAction({}, form({ custo_usd: "10" }));
    expect(r).toEqual({ erro: "Item não identificado." });
    nenhumaChamadaFoiFeita();
  });

  it("ajustarCustoPromptAction: custo vazio, não-número e fora da faixa", async () => {
    expect(await ajustarCustoPromptAction({}, form({ id: "x", custo_usd: "  " }))).toEqual({
      erro: "Escreva o custo real antes de salvar.",
    });
    expect(await ajustarCustoPromptAction({}, form({ id: "x", custo_usd: "doze" }))).toEqual({
      erro: "O custo precisa ser um número (ex.: 12,30).",
    });
    expect(await ajustarCustoPromptAction({}, form({ id: "x", custo_usd: "900" }))).toEqual({
      erro: "O custo precisa ficar entre 0 e 500.",
    });
    nenhumaChamadaFoiFeita();
  });

  it("ajustarCustoPromptAction: aceita vírgula decimal (o operador digita em português)", async () => {
    const r = await ajustarCustoPromptAction({}, form({ id: "fila-x", custo_usd: "12,34" }));
    expect(r).toMatchObject({ ok: true });
    expect(fixtureStore.ajustarCustoFixture).toHaveBeenCalledWith("fila-x", 12.34, null);
  });
});
