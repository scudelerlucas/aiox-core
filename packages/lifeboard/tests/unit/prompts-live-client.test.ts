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

    expect(r).toEqual({ ok: true, id: "abc", conta: "lucasscudeler@gmail.com", motivo: "x" });
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

  it("loadFilaPromptsState POSTa em .../rpc/fila_prompts_listar com só p_secret", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk({ fila: [], consumo: [] }));

    const r = await loadFilaPromptsState();

    expect(r).toEqual({ fila: [], consumo: [] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/fila_prompts_listar$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["p_secret"]);
  });

  it("enfileirarPrompt: RPC devolve check_violation (23514) -> erro é a mensagem da RPC (achado MÉDIO #10)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "23514",
          message:
            "fila: conta lucasscudeler@gmail.com ficaria em US$ 154.99 hoje (medido US$ 149.99 + reservado US$ 0.00 + este item US$ 5.00) — teto US$ 150.00",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const r = await enfileirarPrompt({ prompt: "oi", complexidade: "baixa" });

    expect(r).toEqual({
      erro:
        "fila: conta lucasscudeler@gmail.com ficaria em US$ 154.99 hoje (medido US$ 149.99 + reservado US$ 0.00 + este item US$ 5.00) — teto US$ 150.00",
    });
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
