import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · o portão de entrada nunca tinha sido testado.
 *
 * `src/middleware.ts` decide quem entra no painel. Até 15/09/2026 ele era a
 * ÚNICA peça do sistema sem um único teste — e foi justamente onde a troca de
 * projeto Supabase estourou em erro 500 (hipótese H2 de
 * `docs/lifeboard/00-PROMPT-MELHORADO-vercel-troca-supabase-500-v1.0.md`).
 *
 * A casa já tem este teste para as rotas — `linha-do-tempo-degrada.test.tsx`,
 * `home-degrada-sem-cair.test.ts`: mocka o ponto de falha real e confere que a
 * função RESOLVE para a degradação, nunca REJEITA. O portão é o único lugar
 * onde essa rede faltava, e é o pior lugar para faltar: exceção crua no
 * middleware do Next vira 500 em TODAS as rotas de uma vez, não numa página só.
 *
 * O caso decisivo é o primeiro: a biblioteca do Supabase devolve erro de
 * autenticação como VALOR, mas RELANÇA o que não for erro de autenticação —
 * uma URL malformada (espaço, quebra de linha, `https://` perdido na hora de
 * colar a credencial) vira `TypeError` cru dentro de `getUser()`.
 */

const getUserMock = vi.fn();

// Função simples, não `vi.fn`: `vi.resetAllMocks()` apagaria a implementação
// de um mock aqui e o portão receberia `undefined` no lugar do cliente.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

const ENV_URL = "https://projeto-de-teste.supabase.co";
const ENV_ANON = "chave-anon-de-teste";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ENV_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ENV_ANON;
});

afterEach(() => {
  getUserMock.mockReset();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

async function chamar(caminho: string) {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("@/middleware");
  return middleware(new NextRequest(new URL(`https://painel.test${caminho}`)));
}

describe("portão de entrada — degrada sem cair", () => {
  it("erro que NÃO é de autenticação em getUser() → manda pro login, nunca rejeita", async () => {
    // Exatamente o que uma URL malformada produz: TypeError cru vindo do fetch,
    // que a biblioteca do Supabase relança em vez de devolver como valor.
    getUserMock.mockRejectedValue(new TypeError("Failed to parse URL"));

    const resposta = await chamar("/");

    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toContain("/login");
  });

  it("banco fora do ar em getUser() → manda pro login, nunca rejeita", async () => {
    getUserMock.mockRejectedValue(new Error("fetch failed"));

    const resposta = await chamar("/tarefa/abc");

    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toContain("/login");
  });

  it("sem sessão → manda pro login (sem marca de proibido)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const resposta = await chamar("/");

    expect(resposta.status).toBe(307);
    const destino = resposta.headers.get("location") ?? "";
    expect(destino).toContain("/login");
    expect(destino).not.toContain("error=forbidden");
  });

  it("logado mas fora da lista → login com marca de proibido", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "estranho@exemplo.com" } },
    });

    const resposta = await chamar("/");

    expect(resposta.headers.get("location")).toContain("error=forbidden");
  });

  it("e-mail da lista padrão entra", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "lucasscudeler@gmail.com" } },
    });

    const resposta = await chamar("/");

    expect(resposta.headers.get("location")).toBeNull();
    expect(resposta.status).toBe(200);
  });

  it.each(["/login", "/auth/callback", "/api/health"])(
    "%s continua público — não chama o Supabase",
    async (caminho) => {
      const resposta = await chamar(caminho);

      expect(resposta.headers.get("location")).toBeNull();
      expect(getUserMock).not.toHaveBeenCalled();
    },
  );

  it("sem Supabase configurado (dev/fixture) o portão fica desligado", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const resposta = await chamar("/");

    expect(resposta.headers.get("location")).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });
});
