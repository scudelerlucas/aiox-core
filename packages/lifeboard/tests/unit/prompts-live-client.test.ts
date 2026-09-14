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

import {
  ajustarCustoPrompt,
  cancelarPromptFila,
  enfileirarPrompt,
  loadFilaPromptsState,
} from "@/lib/supabase/live-client";

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
    // D14 (rodada 4): a RPC devolve CÓDIGO + NÚMEROS, nunca uma frase.
    fetchMock.mockResolvedValueOnce(
      respostaOk({
        ok: true,
        id: "abc",
        conta: "lucasscudeler@gmail.com",
        complexidade: "baixa",
        modelo_sugerido: "Haiku",
        motivo_codigo: "auto_maior_espaco",
        cabe_hoje: true,
        headroom_usd: 30,
        espaco_livre_usd: 25,
        custo_estimado_usd: 5,
        na_fila_usd: 5,
        itens_na_frente: 1,
      }),
    );

    const r = await enfileirarPrompt({ prompt: "oi", complexidade: "baixa" });

    expect(r).toEqual({
      ok: true,
      id: "abc",
      conta: "lucasscudeler@gmail.com",
      complexidade: "baixa",
      motivoCodigo: "auto_maior_espaco",
      cabeHoje: true,
      headroomUsd: 30,
      espacoLivreUsd: 25,
      custoEstimadoUsd: 5,
      naFilaUsd: 5,
      itensNaFrente: 1,
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

    expect(r).toEqual({ ok: true, motivoCancelamento: undefined, custoLancadoUsd: 0, tentativas: 0 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_cancelar$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["p_id", "p_secret"]);
    expect(body.p_id).toBe("fila-123");
  });

  it("loadFilaPromptsState POSTa em .../rpc/fila_prompts_listar com p_secret, p_limite e p_antes_de", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ fila: [], consumo: [], temMais: false, limite: 50 }));

    const r = await loadFilaPromptsState();

    expect(r).toEqual({
      fila: [],
      consumo: [],
      temMais: false,
      limite: 50,
      proximoAntesDe: null,
      proximoAntesId: null,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_listar$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // D15 (rodada 4): o cursor é `(criado_em, id)` — os dois vão no corpo.
    expect(Object.keys(body).sort()).toEqual([
      "p_antes_de",
      "p_antes_id",
      "p_limite",
      "p_secret",
    ]);
    expect(body.p_limite).toBe(50);
    expect(body.p_antes_de).toBeNull();
    expect(body.p_antes_id).toBeNull();
  });

  // ── D8 (rodada 3): paginação ────────────────────────────────────────────
  it("loadFilaPromptsState(limite, antesDe, antesId) manda o cursor inteiro e devolve o próximo", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({
        fila: [],
        consumo: [],
        temMais: true,
        limite: 100,
        proximoAntesDe: "2026-09-13T09:00:00.000Z",
        proximoAntesId: "11111111-2222-3333-4444-555555555555",
      }),
    );

    const r = await loadFilaPromptsState(
      100,
      "2026-09-13T10:00:00.000Z",
      "99999999-8888-7777-6666-555555555555",
    );

    expect(r.temMais).toBe(true);
    expect(r.limite).toBe(100);
    expect(r.proximoAntesDe).toBe("2026-09-13T09:00:00.000Z");
    expect(r.proximoAntesId).toBe("11111111-2222-3333-4444-555555555555");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.p_limite).toBe(100);
    expect(body.p_antes_de).toBe("2026-09-13T10:00:00.000Z");
    expect(body.p_antes_id).toBe("99999999-8888-7777-6666-555555555555");
  });

  it("loadFilaPromptsState: resposta sem temMais/limite (banco velho) não quebra a página", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ fila: [], consumo: [] }));
    const r = await loadFilaPromptsState(25);
    expect(r).toEqual({
      fila: [],
      consumo: [],
      temMais: false,
      limite: 25,
      proximoAntesDe: null,
      proximoAntesId: null,
    });
  });

  // ── D7 (rodada 3): cancelar aceita item `pega` ──────────────────────────
  it("cancelarPromptFila é a MESMA RPC para na_fila e pega — quem decide é o banco", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaOk({ ok: true, motivo_codigo: "cancelado_em_execucao", custo_lancado_usd: 50, tentativas: 1 }),
    );
    const r = await cancelarPromptFila("item-em-execucao");
    // #11/D12 (rodada 4): a RPC diz QUAL cancelamento foi e quanto entrou no dia.
    expect(r).toEqual({
      ok: true,
      motivoCancelamento: "cancelado_em_execucao",
      custoLancadoUsd: 50,
      tentativas: 1,
    });
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

  // ── D20 (rodada 4): a porta de saída do operador ─────────────────────────
  it("ajustarCustoPrompt POSTa com p_secret, p_id, p_custo_usd e p_session_id (D26)", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ ok: true, custo_usd: 12.34 }));

    const r = await ajustarCustoPrompt("fila-9", 12.34);

    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_ajustar_custo$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // D26 (rodada 6): a aridade de 4 é a única viva no banco (a de 3 saiu para
    // a chamada não ficar ambígua no PostgREST). Sem vínculo, `p_session_id`
    // vai nulo — e a RPC trata nulo como "não mexer no vínculo".
    expect(Object.keys(body).sort()).toEqual([
      "p_custo_usd",
      "p_id",
      "p_secret",
      "p_session_id",
    ]);
    expect(body.p_id).toBe("fila-9");
    expect(body.p_custo_usd).toBe(12.34);
    expect(body.p_session_id).toBeNull();
  });

  it("ajustarCustoPrompt com sessão: o vínculo vai no corpo (D26)", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ ok: true, custo_usd: 30 }));
    await ajustarCustoPrompt("fila-9", 30, "session_abc");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.p_session_id).toBe("session_abc");
  });

  it("ajustarCustoPrompt: item de outro dia -> a mensagem em português da RPC atravessa", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "23514", message: "Só dá para ajustar o custo de item fechado hoje." }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    const r = await ajustarCustoPrompt("fila-9", 1);
    expect(r).toEqual({ erro: "Só dá para ajustar o custo de item fechado hoje." });
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
