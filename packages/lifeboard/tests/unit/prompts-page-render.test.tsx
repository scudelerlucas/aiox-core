import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Mesmo motivo de `tarefa-page-render.test.tsx`: `factory.ts` e
 * `live-client.ts` puxam `cache()` de `"react"` no topo do módulo — fora do
 * Next real (`environment: "node"` do Vitest, sem a condition
 * `react-server`) isso lança ao só IMPORTAR, mesmo que o ramo fixture nunca
 * chame nada desses módulos. Stub vazio, só para este teste de render.
 */
vi.mock("@/lib/repositories/factory", () => ({
  getTasksRepository: vi.fn(),
  getSourcesRepository: vi.fn(),
}));
vi.mock("@/lib/supabase/live-client", () => ({
  loadFilaPromptsState: vi.fn(),
  enfileirarPrompt: vi.fn(),
  cancelarPromptFila: vi.fn(),
  ajustarCustoPrompt: vi.fn(),
}));
// PromptsClient/NovoPromptForm/CancelarBotao chamam `useRouter()` (via
// `usar-acao-prompt.ts`, para `router.refresh()` pós-sucesso) — fora de um
// app Next real isso lança "invariant expected app router to be mounted".
vi.mock("next/navigation", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("next/navigation")>();
  return { ...original, useRouter: () => ({ refresh: vi.fn() }) };
});

const { default: PaginaPrompts } = await import("@/app/prompts/page");
const { PromptsClient } = await import("@/components/prompts/prompts-client");
const { contaOverrideAtiva, contasAtivas } = await import("@/core/prompts/roteador");

/**
 * OS-LIFEBOARD · P7 — render test de `/prompts` em modo FIXTURE (mesmo
 * espírito de `tarefa-page-render.test.tsx`): sem `LIFEBOARD_DATA_MODE` no
 * ambiente de teste, `env.LIFEBOARD_DATA_MODE` cai no default `"fixture"`,
 * que lê o store semeado por `prompts-fila.fixture.ts` — 3 contas, 5 itens
 * (um de cada estado), formulário "Novo prompt".
 */
describe("PaginaPrompts (fixture)", () => {
  it("PRONTO QUANDO: renderiza os 3 cartões de conta, o formulário e os 5 estados da fila", async () => {
    const elemento = await PaginaPrompts({});
    const html = renderToStaticMarkup(elemento);

    expect(html).toContain("Prompts");
    expect(html).toContain("Novo prompt");

    // 3 cartões de conta.
    expect(html).toContain("Lucas");
    expect(html).toContain("Pandora");
    expect(html).toContain("Alma Petra");
    // MÉDIO 2 (rodada 9): a Alma Petra do fixture está no teto E com a trava de
    // medição ligada. Os DOIS selos aparecem (eram um `else if`, e o segundo
    // nunca renderizava), e o rodapé para de prometer "próximo espaço amanhã"
    // sobre uma conta que amanhã continua sem autorização.
    expect(html).toContain("teto atingido");
    expect(html).toContain("sem autorização agora");
    expect(html).toContain(
      "teto atingido e sem autorização — amanhã o teto zera, mas o disparo só volta quando a medição desta conta for atualizada",
    );
    expect(html).not.toContain("teto atingido — próximo espaço amanhã");

    // os 5 estados da fila (fixture cobre um de cada).
    expect(html).toContain("na fila");
    expect(html).toContain("em execução");
    expect(html).toContain("concluída");
    expect(html).toContain("falhou");
    expect(html).toContain("cancelada");
    // D7: o item pega e MUDO há 70 min diz as duas coisas na linha dele.
    expect(html).toContain("sem sinal");
    expect(html).toContain("volta para a fila no próximo pull");
    expect(html).toContain("último sinal há");

    // modelo por complexidade aparece na legenda do formulário.
    expect(html).toMatch(/Haiku/);
    expect(html).toMatch(/Sonnet/);
    expect(html).toMatch(/Opus/);
    expect(html).toMatch(/Fable/);
  });

  // ── RODADA 4 ────────────────────────────────────────────────────────────
  it("D13 — nenhum número negativo na tela, em conta nenhuma", async () => {
    const html = renderToStaticMarkup(await PaginaPrompts({}));
    expect(html).not.toContain("US$ -");
    // A Alma Petra está exatamente no teto: a frase é de ausência, não de dívida.
    expect(html).toContain("sem espaço livre agora");
  });

  it("D16 — o cartão do Lucas mostra 42,10: base publicada + o item concluído hoje", async () => {
    const html = renderToStaticMarkup(await PaginaPrompts({}));
    expect(html).toContain("US$ 42,10");
  });

  it("D15 — o 'mostrar mais' leva o CURSOR na URL (antes + antesId), nunca só o limite", async () => {
    const html = renderToStaticMarkup(
      await PaginaPrompts({ searchParams: Promise.resolve({ limite: "3" }) }),
    );
    expect(html).toContain("mostrar mais 3");
    expect(html).toMatch(/href="\/prompts\?limite=3&amp;antes=[^"]+&amp;antesId=[^"]+"/);
  });
});

/**
 * D20 (rodada 4): a semente ganhou o retrato do item que morreu sem fechar —
 * o único caso em que o custo do dia é ESTIMATIVA da casa. Sem este bloco, a
 * tela podia voltar a calar sobre a parcela estimada sem nenhum teste reclamar.
 */
describe("PaginaPrompts — a parcela de estimativa (D20)", () => {
  it("o cartão diz quanto é estimativa e a linha marca a célula de custo", async () => {
    const html = renderToStaticMarkup(await PaginaPrompts({}));
    expect(html).toContain("US$ 50,00 do consumo são estimativa de 1 item que morreu sem fechar");
    expect(html).toContain("dá para ajustar na linha da fila.");
    expect(html).toContain("estimativa da casa");
    expect(html).toContain("ajustar custo");
    expect(html).toContain("expirou 3 vezes sem fechamento");
  });

  it("o botão de ajuste NÃO aparece em item cujo custo foi medido por gente", async () => {
    const html = renderToStaticMarkup(await PaginaPrompts({}));
    // A semente tem uma `concluida` de US$ 3,42 medida pelo worker.
    expect(html).toContain("US$ 3,42");
    // 2 ocorrências = 1 item estimado × as duas árvores da tabela (a de
    // desktop e a de cartões do mobile). Se um item MEDIDO ganhasse o botão,
    // este número saltaria para 4.
    expect((html.match(/ajustar custo/g) ?? []).length).toBe(2);
  });
});

/**
 * P2 do Codex (PR #42, 23ª rodada): o seletor manual de conta seguia a lista
 * fixa `CONTAS` do TypeScript. Removida uma conta pela migration de
 * `painel_contas_da_casa()`, o cartão sumia (a tela já filtra desde a 22ª) mas
 * o formulário continuava oferecendo a conta — e o envio batia na recusa do
 * banco. Agora o seletor oferece só o que o banco devolveu, e uma escolha que
 * deixou de existir volta a ser "automático".
 */
describe("23ª rodada — o seletor manual oferece só as contas que o banco devolveu", () => {
  const consumoDe = (conta: string) =>
    ({
      conta,
      tetoUsd: 500,
      consumoHojeUsd: 0,
      reservadoUsd: 0,
      naFilaUsd: 0,
      estimativaUsd: 0,
      estimativaItens: 0,
      emEspera: 0,
      medidoAteEm: null,
      defasagemHoras: null,
      historico: null,
    }) as never;
  const tresContas = ["lucasscudeler@gmail.com", "lsgpandora@gmail.com", "almapetra.ltda@gmail.com"].map(consumoDe);

  it("conta fora do `consumo` não vira opção do seletor", () => {
    const html = renderToStaticMarkup(<PromptsClient consumo={tresContas} tarefas={[]} agora={Date.now()} />);
    expect(html).toContain('value="almapetra.ltda@gmail.com"');
    expect(html).not.toContain('value="arborcactus@gmail.com"');
  });

  it("escolha que deixou de existir volta a ser automática; a que existe fica", () => {
    expect(contasAtivas(tresContas)).toEqual([
      "lucasscudeler@gmail.com",
      "lsgpandora@gmail.com",
      "almapetra.ltda@gmail.com",
    ]);
    expect(contaOverrideAtiva("arborcactus@gmail.com", tresContas)).toBe("");
    expect(contaOverrideAtiva("lsgpandora@gmail.com", tresContas)).toBe("lsgpandora@gmail.com");
    expect(contaOverrideAtiva("", tresContas)).toBe("");
  });
});
