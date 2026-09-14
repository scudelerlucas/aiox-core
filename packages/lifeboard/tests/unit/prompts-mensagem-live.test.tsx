import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · P7 — D14 (rodada 4): a frase que o operador lê em MODO LIVE.
 *
 * O crítico mediu o buraco: em modo live, o texto de sucesso vinha CRU do
 * Postgres — "roteamento automatico: maior espaco livre hoje (US$ 150.00)".
 * Sem acento, com ponto decimal, com o vocabulário do banco. Nenhum teste
 * tocava esse caminho: `prompts-actions.test.ts` mocka `live-client` inteiro,
 * e `prompts-live-client.test.ts` para no contrato HTTP.
 *
 * Aqui o caminho é o INTEIRO: `fetch` mockado devolvendo o que a RPC de 0013
 * devolve (código + números) → `novoPromptAction` (modo live) monta a frase →
 * o componente que a tela usa é RENDERIZADO com ela. A afirmação é sobre o
 * HTML final, não sobre um objeto intermediário.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/user-server", () => ({
  createSupabaseUserClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "lucasscudeler@gmail.com" } } }) },
  })),
}));
// `live-client.ts` chama `cache()` de "react" no topo do módulo — fora do Next
// isso lança na importação (mesmo motivo documentado em `prompts-live-client.test.ts`).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T): T => fn };
});

const { novoPromptAction } = await import("@/app/prompts/actions");
const { MensagemDaFila } = await import("@/components/prompts/mensagem-da-fila");

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

function respostaDaRpc(corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("D14 — modo live: a frase final na tela (fetch mockado)", () => {
  const fetchMock = vi.fn();
  // `@/config/env` EXIGE URL/chave/segredo quando o modo é live (e lança se
  // faltarem) — valores de teste, nenhum deles real, nenhum deles impresso.
  const AMBIENTE_LIVE: Record<string, string> = {
    LIFEBOARD_DATA_MODE: "live",
    SUPABASE_URL: "https://exemplo-de-teste.supabase.co",
    SUPABASE_ANON_KEY: "chave-anon-de-teste",
    LIFEBOARD_LOAD_SECRET: "segredo-de-teste",
  };
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    for (const [chave, valor] of Object.entries(AMBIENTE_LIVE)) {
      original[chave] = process.env[chave];
      process.env[chave] = valor;
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const chave of Object.keys(AMBIENTE_LIVE)) {
      const antes = original[chave];
      if (antes === undefined) delete process.env[chave];
      else process.env[chave] = antes;
    }
  });

  it("roteamento automático que cabe: a tela mostra português, com acento e vírgula", async () => {
    // Exatamente o que a RPC devolveu ao vivo em 13/09 no bloco D14.
    fetchMock.mockResolvedValueOnce(
      respostaDaRpc({
        ok: true,
        id: "abc",
        conta: "lucasscudeler@gmail.com",
        complexidade: "baixa",
        modelo_sugerido: "Haiku",
        motivo_codigo: "auto_maior_espaco",
        cabe_hoje: true,
        headroom_usd: 30,
        espaco_livre_usd: 30,
        custo_estimado_usd: 5,
        na_fila_usd: 0,
        itens_na_frente: 0,
      }),
    );

    const estado = await novoPromptAction({}, form({ prompt: "listar PRs", complexidade: "baixa" }));

    expect(estado.mensagem).toBe(
      "Enfileirado para Lucas: é a conta com maior espaço livre hoje " +
        "(US$ 30,00 para uma tarefa baixa de US$ 5,00).",
    );

    const html = renderToStaticMarkup(
      <MensagemDaFila mensagem={estado.mensagem} cabeHoje={estado.cabeHoje} />,
    );
    expect(html).toContain(
      "Enfileirado para Lucas: é a conta com maior espaço livre hoje (US$ 30,00 para uma tarefa baixa de US$ 5,00).",
    );
    // O que NUNCA pode aparecer: o texto cru do banco.
    expect(html).not.toContain("roteamento automatico");
    expect(html).not.toContain("US$ 30.00");
    expect(html).toContain("text-state-done");
  });

  it("não cabe hoje: a frase avisa e a cor é de espera, não de sucesso", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaDaRpc({
        ok: true,
        id: "def",
        conta: "lsgpandora@gmail.com",
        complexidade: "maxima",
        modelo_sugerido: "Fable",
        motivo_codigo: "auto_nao_cabe_hoje",
        cabe_hoje: false,
        headroom_usd: 30,
        espaco_livre_usd: -10,
        custo_estimado_usd: 120,
        na_fila_usd: 40,
        itens_na_frente: 2,
      }),
    );

    const estado = await novoPromptAction(
      {},
      form({ prompt: "reescrever a carta", complexidade: "maxima" }),
    );

    expect(estado.mensagem).toBe(
      "Enfileirado para Pandora: nenhuma conta tem US$ 120,00 livres hoje para uma tarefa máxima — " +
        "a mais folgada tem US$ 30,00. Entra na fila e roda quando houver espaço.",
    );

    const html = renderToStaticMarkup(
      <MensagemDaFila mensagem={estado.mensagem} cabeHoje={estado.cabeHoje} />,
    );
    expect(html).toContain("Entra na fila e roda quando houver espaço.");
    expect(html).toContain("text-state-progress");
    // D13: nada de número negativo na tela, mesmo com espaco_livre_usd = -10.
    expect(html).not.toContain("-10");
    expect(html).not.toContain("US$ -");
  });

  it("escolha manual que cabe cita a fila da frente com o número REAL de itens", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaDaRpc({
        ok: true,
        id: "ghi",
        conta: "almapetra.ltda@gmail.com",
        complexidade: "alta",
        modelo_sugerido: "Opus",
        motivo_codigo: "manual_cabe",
        cabe_hoje: true,
        headroom_usd: 100,
        espaco_livre_usd: 80,
        custo_estimado_usd: 50,
        na_fila_usd: 20,
        itens_na_frente: 1,
      }),
    );

    const estado = await novoPromptAction(
      {},
      form({
        prompt: "auditar RLS",
        complexidade: "alta",
        conta: "almapetra.ltda@gmail.com",
      }),
    );

    const html = renderToStaticMarkup(
      <MensagemDaFila mensagem={estado.mensagem} cabeHoje={estado.cabeHoje} />,
    );
    expect(html).toContain("Enfileirado para Alma Petra (escolha manual): cabe hoje");
    expect(html).toContain("US$ 100,00 livres para uma tarefa alta de US$ 50,00.");
    expect(html).toContain("1 item na frente soma US$ 20,00.");
  });

  it("D22 — `NovoPromptForm` (produção) mostra a frase do enfileiramento", async () => {
    fetchMock.mockResolvedValueOnce(
      respostaDaRpc({
        ok: true,
        id: "jkl",
        conta: "lucasscudeler@gmail.com",
        complexidade: "baixa",
        modelo_sugerido: "Haiku",
        motivo_codigo: "auto_maior_espaco",
        cabe_hoje: true,
        headroom_usd: 30,
        espaco_livre_usd: 30,
        custo_estimado_usd: 5,
        na_fila_usd: 0,
        itens_na_frente: 0,
      }),
    );
    const estado = await novoPromptAction({}, form({ prompt: "listar PRs", complexidade: "baixa" }));

    vi.doMock("@/components/prompts/usar-acao-prompt", () => ({
      useAcaoPrompt: () => ({ estado, pendente: false, disparar: () => {} }),
    }));
    vi.resetModules();
    const { NovoPromptForm } = await import("@/components/prompts/novo-prompt-form");
    const html = renderToStaticMarkup(
      <NovoPromptForm
        complexidade="baixa"
        aoMudarComplexidade={() => {}}
        contaOverride=""
        aoMudarContaOverride={() => {}}
        modeloImplicado="Haiku"
        motivoAuto="agora iria para Lucas"
        contaAuto="lucasscudeler@gmail.com"
        tarefas={[]}
      />,
    );
    vi.doUnmock("@/components/prompts/usar-acao-prompt");
    vi.resetModules();

    expect(html).toContain('role="status"');
    expect(html).toContain(
      "Enfileirado para Lucas: é a conta com maior espaço livre hoje (US$ 30,00 para uma tarefa baixa de US$ 5,00).",
    );
  });

  /**
   * D22 (rodada 5) — O PAR QUE A PRODUÇÃO REALMENTE FORMA.
   *
   * Aqui morava o teste que "provava" #11 montando `<MensagemDaFila>` À MÃO com
   * a frase do cancelamento. Ele passava — e a tela continuava muda: quem
   * renderiza o cancelamento em produção é `CancelarBotao`, e ele só mostrava
   * `estado.erro`. O par testado (ação → componente escolhido pelo teste) não
   * era o par da produção (ação → componente que a tabela monta).
   *
   * Os dois testes abaixo montam os COMPONENTES DE PRODUÇÃO. O único ponto
   * substituído é o encanamento do hook (`useState`/`useTransition`/
   * `useRouter` não rodam sem DOM — este pacote não tem jsdom nem
   * testing-library, e instalar dependência não é uma opção aqui): o stub
   * devolve exatamente o que `useAcaoPrompt` guarda depois do `setEstado`, e o
   * estado vem da AÇÃO DE VERDADE, chamada com `fetch` mockado. A prova de
   * interação real (clicar, digitar, Enter) é a de navegador, no relatório da
   * rodada.
   */
  it("#11/D22 — `CancelarBotao` (produção) mostra a frase do cancelamento no [role=status]", async () => {
    const { cancelarPromptAction } = await import("@/app/prompts/actions");
    fetchMock.mockResolvedValueOnce(
      respostaDaRpc({
        ok: true,
        motivo_codigo: "cancelado_em_execucao",
        custo_lancado_usd: 50,
        tentativas: 1,
      }),
    );

    const estado = await cancelarPromptAction({}, form({ id: "fila-1" }));
    expect(estado.mensagem).toContain("Cancelado durante a execução.");

    vi.doMock("@/components/prompts/usar-acao-prompt", () => ({
      useAcaoPrompt: () => ({ estado, pendente: false, disparar: () => {} }),
    }));
    vi.resetModules();
    const { CancelarBotao } = await import("@/components/prompts/cancelar-botao");
    const html = renderToStaticMarkup(<CancelarBotao id="fila-1" emExecucao />);
    vi.doUnmock("@/components/prompts/usar-acao-prompt");
    vi.resetModules();

    expect(html).toContain('role="status"');
    expect(html).toContain("Cancelado durante a execução.");
    expect(html).toContain("US$ 50,00 entram no gasto de hoje como estimativa");
    // O botão continua lá — a frase não substituiu a ação.
    expect(html).toContain("cancelar");
  });

  it("D22 — `AjustarCustoBotao` (produção) deixa de ser mudo no sucesso", async () => {
    const { ajustarCustoPromptAction } = await import("@/app/prompts/actions");
    fetchMock.mockResolvedValueOnce(respostaDaRpc({ ok: true, custo_usd: 12.3 }));

    const estado = await ajustarCustoPromptAction({}, form({ id: "fila-8", custo_usd: "12,30" }));
    expect(estado.mensagem).toBe("Custo ajustado — o gasto de hoje já considera o número real.");

    vi.doMock("@/components/prompts/usar-acao-prompt", () => ({
      useAcaoPrompt: () => ({ estado, pendente: false, disparar: () => {} }),
    }));
    vi.resetModules();
    const { AjustarCustoBotao } = await import("@/components/prompts/ajustar-custo-botao");
    const html = renderToStaticMarkup(<AjustarCustoBotao id="fila-8" custoAtualUsd={50} />);
    vi.doUnmock("@/components/prompts/usar-acao-prompt");
    vi.resetModules();

    expect(html).toContain('role="status"');
    expect(html).toContain("Custo ajustado — o gasto de hoje já considera o número real.");
  });

  it("a região viva existe ANTES da frase (vazia e sr-only), nos dois botões", async () => {
    vi.doMock("@/components/prompts/usar-acao-prompt", () => ({
      useAcaoPrompt: () => ({ estado: {}, pendente: false, disparar: () => {} }),
    }));
    vi.resetModules();
    const { CancelarBotao } = await import("@/components/prompts/cancelar-botao");
    const { AjustarCustoBotao } = await import("@/components/prompts/ajustar-custo-botao");
    const htmlCancelar = renderToStaticMarkup(<CancelarBotao id="fila-1" />);
    const htmlAjustar = renderToStaticMarkup(<AjustarCustoBotao id="fila-8" custoAtualUsd={50} />);
    vi.doUnmock("@/components/prompts/usar-acao-prompt");
    vi.resetModules();

    for (const html of [htmlCancelar, htmlAjustar]) {
      expect(html).toContain('role="status"');
      expect(html).toContain("sr-only");
    }
  });
});
