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
import { CONTAS, CUSTO_MAXIMO_POR_ITEM_USD, ROTULO_CONTA } from "@/core/prompts/tipos";
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
    expect(await ajustarCustoPromptAction({}, form({ id: "x", custo_usd: "-1" }))).toEqual({
      erro: `O custo precisa ficar entre 0 e ${CUSTO_MAXIMO_POR_ITEM_USD}.`,
    });
    expect(
      await ajustarCustoPromptAction({}, form({ id: "x", custo_usd: "1000000000" })),
    ).toEqual({ erro: `O custo precisa ficar entre 0 e ${CUSTO_MAXIMO_POR_ITEM_USD}.` });
    nenhumaChamadaFoiFeita();
  });

  /**
   * ALTO 2 (crítico da rodada 13): a tela recusava qualquer correção acima de
   * 500 — o MESMO número do teto do dia. Uma sessão que custou 620 não podia
   * ser relatada: o item morria valendo a estimativa (120) e o pull lia 380 de
   * headroom que não existiam. Agora o número real passa; quem barra despacho
   * é o pull, não a porta que registra o que já aconteceu.
   */
  it("ajustarCustoPromptAction: custo ACIMA do teto do dia passa (é medição, não despacho)", async () => {
    const r = await ajustarCustoPromptAction({}, form({ id: "fila-x", custo_usd: "620" }));
    expect(r).toMatchObject({ ok: true });
    expect(fixtureStore.ajustarCustoFixture).toHaveBeenCalledWith("fila-x", 620, null);
  });

  it("ajustarCustoPromptAction: aceita vírgula decimal (o operador digita em português)", async () => {
    const r = await ajustarCustoPromptAction({}, form({ id: "fila-x", custo_usd: "12,34" }));
    expect(r).toMatchObject({ ok: true });
    expect(fixtureStore.ajustarCustoFixture).toHaveBeenCalledWith("fila-x", 12.34, null);
  });
});

/**
 * M7 (rodada 11) — A MUTAÇÃO QUE PASSOU: apagar a troca e-mail → rótulo em
 * `formatarRecusaFila` (`src/app/prompts/actions.ts`). O crítico aplicou
 * exatamente isso e os 1350 testes continuaram verdes — a tela voltava a
 * mostrar `lucasscudeler@gmail.com` cru numa recusa, e o operador não precisa
 * saber qual e-mail é qual.
 *
 * `formatarRecusaFila` não é exportável (o arquivo é `"use server"`: só
 * função assíncrona sai dele), então a prova é pelo caminho de fora — a recusa
 * do repositório entra crua e a resposta da action sai traduzida.
 */
describe("P2 Codex (PR #42, 11ª rodada) — item que espera vaga de voo não aparece como pronto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { email: "lucasscudeler@gmail.com" } } });
  });

  const base = {
    ok: true,
    id: "fila-v",
    conta: "lsgpandora@gmail.com",
    complexidade: "baixa",
    cabeHoje: true,
    headroomUsd: 480,
    espacoLivreUsd: 480,
    custoEstimadoUsd: 5,
    naFilaUsd: 0,
    itensNaFrente: 0,
  };

  for (const motivoCodigo of ["manual_sem_vaga", "auto_sem_vaga"] as const) {
    it(`${motivoCodigo}: dinheiro cabe, mas a tela recebe cabeHoje=false (aviso, não sucesso)`, async () => {
      vi.mocked(fixtureStore.enfileirarFixture).mockReturnValueOnce({ ...base, motivoCodigo } as never);
      const r = await novoPromptAction({}, form({ prompt: "x", complexidade: "baixa" }));
      expect(r.ok).toBe(true);
      expect(r.cabeHoje).toBe(false);
    });
  }

  it("auto_maior_espaco com dinheiro: continua pronto (cabeHoje=true)", async () => {
    vi.mocked(fixtureStore.enfileirarFixture).mockReturnValueOnce({
      ...base,
      motivoCodigo: "auto_maior_espaco",
    } as never);
    const r = await novoPromptAction({}, form({ prompt: "x", complexidade: "baixa" }));
    expect(r.cabeHoje).toBe(true);
  });
});

describe("M7 — a recusa nunca mostra e-mail cru na tela", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { email: "lucasscudeler@gmail.com" } } });
  });

  it("novoPromptAction: e-mail da casa vira rótulo, e o ponto decimal vira vírgula", async () => {
    vi.mocked(fixtureStore.enfileirarFixture).mockReturnValueOnce({
      erro:
        "fila: uma tarefa máxima custa cerca de US$ 120.00 e o teto diário da conta " +
        "lucasscudeler@gmail.com é US$ 100.00 — nunca vai caber.",
    } as never);
    const r = await novoPromptAction({}, form({ prompt: "x", complexidade: "maxima" }));
    expect(r.erro, "o e-mail cru chegou à tela").not.toContain("@gmail.com");
    expect(r.erro).toContain("Lucas");
    expect(r.erro).toContain("US$ 120,00");
    expect(r.erro).not.toContain("fila: ");
  });

  it("todas as contas da casa têm rótulo — nenhuma escapa", async () => {
    // Lê a lista do contrato, não uma cópia à mão: a cópia tinha três contas e
    // a 4ª (arborcactus@) passava sem ser testada (Minor do CodeRabbit, PR #42).
    expect(CONTAS.length).toBeGreaterThanOrEqual(4);
    for (const conta of CONTAS) {
      const rotulo = ROTULO_CONTA[conta];
      vi.mocked(fixtureStore.enfileirarFixture).mockReturnValueOnce({
        erro: `fila: a conta ${conta} recusou.`,
      } as never);
      const r = await novoPromptAction({}, form({ prompt: "x", complexidade: "baixa" }));
      expect(r.erro, `${conta} chegou crua à tela`).not.toContain(conta);
      expect(r.erro).toContain(rotulo);
    }
  });
});
