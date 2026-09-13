import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · P7 — achado MÉDIO #6 do crítico hostil (rodada 2,
 * 13/09/2026): nenhum teste tocava os NOMES/PARÂMETROS reais das RPCs da
 * fila — `tests/unit/prompts-actions.test.ts` mocka `@/lib/supabase/
 * live-client` INTEIRO (correto para aquele teste, que prova só a validação
 * das server actions), então um erro no nome da RPC ou nas chaves do corpo
 * (`p_secret`/`p_payload`/`p_id`) nunca quebraria nenhum teste.
 *
 * Este arquivo NÃO mocka `live-client` — importa as funções REAIS e mocka só
 * `fetch`, provando o contrato HTTP exato contra o Postgres real
 * (`supabase/migrations/0007_lifeboard_v3_fila_prompts.sql` +
 * `0009_lifeboard_v3_fila_ajustes.sql` + `0011_lifeboard_v3_fila_ajustes_2.sql`):
 * nome da RPC na URL, `p_secret`/`p_payload`/`p_id` no corpo — exatamente
 * os nomes que `fila_prompts_enfileirar(p_secret, p_payload)`,
 * `fila_prompts_cancelar(p_secret, p_id)` e `fila_prompts_listar(p_secret)`
 * esperam.
 *
 * `react`'s `cache()` não existe no `react` puro que o Vitest carrega (só no
 * bundler do Next) — `live-client.ts` chama `cache()` no topo do módulo, e
 * `home-degrada-sem-cair.test.ts` já documentou que isso quebra a importação
 * direta. Mock parcial de `react` (identidade no lugar de `cache`) resolve
 * isso só NESTE arquivo — cada arquivo de teste tem seu próprio registro de
 * módulos no Vitest, então isto não vaza para os outros testes.
 */
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T): T => fn };
});

import { cancelarPromptFila, enfileirarPrompt, loadFilaPromptsState } from "@/lib/supabase/live-client";

function respostaOk(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("live-client — fila de prompts (contrato HTTP real das RPCs)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enfileirarPrompt POSTa em .../rpc/fila_prompts_enfileirar com p_secret e p_payload", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ ok: true, id: "abc", conta: "lucasscudeler@gmail.com", modelo_sugerido: "Haiku", motivo: "x" }),
    );

    const r = await enfileirarPrompt({ prompt: "oi", complexidade: "baixa" });

    expect(r).toEqual({
      ok: true,
      id: "abc",
      conta: "lucasscudeler@gmail.com",
      motivo: "x",
      cabeHoje: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_enfileirar$/);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["p_payload", "p_secret"]);
    expect(body.p_payload).toEqual({ prompt: "oi", complexidade: "baixa" });
  });

  it("enfileirarPrompt manda a conta escolhida manualmente dentro de p_payload.conta", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ ok: true, id: "xyz" }));

    await enfileirarPrompt({
      prompt: "oi",
      complexidade: "alta",
      conta: "lsgpandora@gmail.com",
      criado_por: "lucasscudeler@gmail.com",
      task_id: null,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { p_payload: Record<string, unknown> };
    expect(body.p_payload).toEqual({
      prompt: "oi",
      complexidade: "alta",
      conta: "lsgpandora@gmail.com",
      criado_por: "lucasscudeler@gmail.com",
      task_id: null,
    });
  });

  it("cancelarPromptFila POSTa em .../rpc/fila_prompts_cancelar com p_secret e p_id", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ ok: true }));

    const r = await cancelarPromptFila("fila-123");

    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_cancelar$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["p_id", "p_secret"]);
    expect(body.p_id).toBe("fila-123");
  });

  it("loadFilaPromptsState POSTa em .../rpc/fila_prompts_listar com p_secret, p_limite e p_antes_de", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ fila: [], consumo: [], temMais: false, limite: 50 }));

    const r = await loadFilaPromptsState();

    expect(r).toEqual({ fila: [], consumo: [], temMais: false, limite: 50 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_listar$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // D8 (rodada 3): a RPC pagina — o corpo leva p_limite e p_antes_de junto.
    expect(Object.keys(body).sort()).toEqual(["p_antes_de", "p_limite", "p_secret"]);
    expect(body.p_limite).toBe(50);
    expect(body.p_antes_de).toBeNull();
  });

  // ── D8 (rodada 3): paginação ────────────────────────────────────────────
  it("loadFilaPromptsState(limite, antesDe) manda os dois na chamada e devolve temMais", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ fila: [], consumo: [], temMais: true, limite: 100 }),
    );

    const r = await loadFilaPromptsState(100, "2026-09-13T10:00:00.000Z");

    expect(r.temMais).toBe(true);
    expect(r.limite).toBe(100);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.p_limite).toBe(100);
    expect(body.p_antes_de).toBe("2026-09-13T10:00:00.000Z");
  });

  it("loadFilaPromptsState: resposta sem temMais/limite (banco velho) não quebra a página", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ fila: [], consumo: [] }));
    const r = await loadFilaPromptsState(25);
    expect(r).toEqual({ fila: [], consumo: [], temMais: false, limite: 25 });
  });

  // ── D7 (rodada 3): cancelar aceita item `pega` ──────────────────────────
  it("cancelarPromptFila é a MESMA RPC para na_fila e pega — quem decide é o banco", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ ok: true }));
    const r = await cancelarPromptFila("item-em-execucao");
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_cancelar$/);
    expect((JSON.parse(init.body as string) as { p_id: string }).p_id).toBe("item-em-execucao");
  });

  it("cancelarPromptFila: item já fechado -> a mensagem em português da RPC atravessa", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "23514",
          message: "Item nao encontrado ou ja fechado (concluida, falhou ou cancelada): abc",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    const r = await cancelarPromptFila("abc");
    expect(r).toEqual({
      erro: "Item nao encontrado ou ja fechado (concluida, falhou ou cancelada): abc",
    });
  });

  it("enfileirarPrompt: RPC devolve check_violation (23514) -> erro é a mensagem da RPC (achado MÉDIO #10)", async () => {
    // D3 (rodada 3): a única recusa que sobrou na admissão.
    const mensagem =
      "fila: uma tarefa máxima custa cerca de US$ 120.00 e o teto diário desta conta é US$ 10.00 — nunca vai caber.";
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "23514", message: mensagem }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const r = await enfileirarPrompt({ prompt: "oi", complexidade: "maxima" });

    expect(r).toEqual({ erro: mensagem });
  });

  it("cancelarPromptFila: RPC devolve insufficient_privilege (42501) -> mensagem fixa, sem eco do texto cru", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "42501", message: "fila_prompts_cancelar: acesso negado" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const r = await cancelarPromptFila("fila-123");

    expect(r).toEqual({ erro: "Acesso negado — avise o Lucas." });
  });
});
