/**
 * O login precisa DIZER quando o provedor está desligado — e nunca travar por
 * causa desta checagem.
 *
 * Caso real de 17/09/2026: o painel de produção apontava para o projeto Supabase
 * de outro sistema (`ofskmjpzlgzmnivmkyop`), onde o login Google nunca foi
 * ligado. Clicar em "Entrar com Google" levava o operador para fora do app, numa
 * página com `{"code":400,...,"msg":"Unsupported provider: provider is not
 * enabled"}` e nada mais. Estes testes fixam as duas metades da correção:
 * a resposta explícita do Supabase vira frase em português COM o ref do projeto,
 * e todo o resto (rede fora, resposta estranha, variável ausente) deixa o login
 * seguir como antes.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consultarProvedorGoogle,
  mensagemProvedorDesligado,
  refDoProjeto,
} from "@/lib/supabase/provedor-de-login";

function respostaFake(corpo: unknown, ok = true): Response {
  return {
    ok,
    json: async () => corpo,
  } as unknown as Response;
}

describe("consultarProvedorGoogle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("diz 'desligado' quando o Supabase responde que o Google está off — o caso de 17/09", async () => {
    const buscar = vi.fn(async () => respostaFake({ external: { google: false } }));

    const estado = await consultarProvedorGoogle(
      "https://ofskmjpzlgzmnivmkyop.supabase.co",
      "chave-anon",
      buscar as unknown as typeof fetch,
    );

    expect(estado).toBe("desligado");
  });

  it("diz 'ligado' quando o provedor está habilitado", async () => {
    const buscar = vi.fn(async () =>
      respostaFake({ external: { google: true, github: false } }),
    );

    const estado = await consultarProvedorGoogle(
      "https://hciiilopyivjaekaxfqp.supabase.co",
      "chave-anon",
      buscar as unknown as typeof fetch,
    );

    expect(estado).toBe("ligado");
  });

  it("consulta o endpoint público de settings, com a chave anon no cabeçalho", async () => {
    const buscar = vi.fn(async () => respostaFake({ external: { google: true } }));

    await consultarProvedorGoogle(
      "https://abc.supabase.co/",
      "chave-anon",
      buscar as unknown as typeof fetch,
    );

    expect(buscar).toHaveBeenCalledWith(
      "https://abc.supabase.co/auth/v1/settings",
      expect.objectContaining({
        headers: { apikey: "chave-anon" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("cancela e degrada quando a requisição não termina dentro do prazo", async () => {
    vi.useFakeTimers();
    let sinal: AbortSignal | undefined;
    const buscar = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      sinal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });

    const consulta = consultarProvedorGoogle(
      "https://abc.supabase.co",
      "chave-anon",
      buscar as typeof fetch,
    );
    await vi.runAllTimersAsync();

    await expect(consulta).resolves.toBe("indeterminado");
    expect(sinal?.aborted).toBe(true);
  });

  it("cancela e degrada quando a leitura do corpo não termina dentro do prazo", async () => {
    vi.useFakeTimers();
    let sinal: AbortSignal | undefined;
    const buscar = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      sinal = init?.signal ?? undefined;
      return {
        ok: true,
        json: () => new Promise<unknown>(() => undefined),
      } as Response;
    });

    const consulta = consultarProvedorGoogle(
      "https://abc.supabase.co",
      "chave-anon",
      buscar as typeof fetch,
    );
    await vi.runAllTimersAsync();

    await expect(consulta).resolves.toBe("indeterminado");
    expect(sinal?.aborted).toBe(true);
  });

  // ── Degrada, nunca derruba ────────────────────────────────────────────────
  // Em todos os casos abaixo a resposta é "indeterminado", e quem chama segue
  // com o login normal. Uma checagem auxiliar não pode virar a razão de alguém
  // não conseguir entrar.

  it("degrada quando a rede falha", async () => {
    const buscar = vi.fn(async () => {
      throw new Error("rede fora");
    });

    const estado = await consultarProvedorGoogle(
      "https://abc.supabase.co",
      "chave-anon",
      buscar as unknown as typeof fetch,
    );

    expect(estado).toBe("indeterminado");
  });

  it("degrada quando a resposta não é ok", async () => {
    const buscar = vi.fn(async () => respostaFake({}, false));

    expect(
      await consultarProvedorGoogle(
        "https://abc.supabase.co",
        "chave-anon",
        buscar as unknown as typeof fetch,
      ),
    ).toBe("indeterminado");
  });

  it("degrada quando o corpo não tem a forma esperada", async () => {
    const semExternal = vi.fn(async () => respostaFake({ outra_coisa: 1 }));
    const externalNulo = vi.fn(async () => respostaFake({ external: null }));
    const googleAusente = vi.fn(async () => respostaFake({ external: { github: true } }));

    expect(
      await consultarProvedorGoogle("https://a.supabase.co", "k", semExternal as unknown as typeof fetch),
    ).toBe("indeterminado");
    expect(
      await consultarProvedorGoogle("https://a.supabase.co", "k", externalNulo as unknown as typeof fetch),
    ).toBe("indeterminado");
    expect(
      await consultarProvedorGoogle("https://a.supabase.co", "k", googleAusente as unknown as typeof fetch),
    ).toBe("indeterminado");
  });

  it("nem chama a rede quando falta URL ou chave", async () => {
    const buscar = vi.fn(async () => respostaFake({ external: { google: false } }));

    expect(
      await consultarProvedorGoogle("", "chave", buscar as unknown as typeof fetch),
    ).toBe("indeterminado");
    expect(
      await consultarProvedorGoogle("https://a.supabase.co", "", buscar as unknown as typeof fetch),
    ).toBe("indeterminado");
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("refDoProjeto", () => {
  it("extrai o ref da URL do Supabase", () => {
    expect(refDoProjeto("https://hciiilopyivjaekaxfqp.supabase.co")).toBe(
      "hciiilopyivjaekaxfqp",
    );
    expect(refDoProjeto("https://ofskmjpzlgzmnivmkyop.supabase.co/")).toBe(
      "ofskmjpzlgzmnivmkyop",
    );
  });

  it("devolve vazio quando a URL não dá para ler", () => {
    expect(refDoProjeto("")).toBe("");
    expect(refDoProjeto("não-é-url")).toBe("");
  });
});

describe("mensagemProvedorDesligado", () => {
  it("nomeia o projeto e diz onde ligar — em português, sem JSON", () => {
    const frase = mensagemProvedorDesligado("ofskmjpzlgzmnivmkyop");

    expect(frase).toContain("ofskmjpzlgzmnivmkyop");
    expect(frase).toContain("Authentication → Providers → Google");
    expect(frase).not.toContain("{");
    expect(frase).not.toContain("validation_failed");
  });

  it("sem ref, ainda diz o que fazer", () => {
    const frase = mensagemProvedorDesligado("");

    expect(frase).toContain("projeto Supabase configurado");
    expect(frase).toContain("Authentication → Providers → Google");
  });
});
