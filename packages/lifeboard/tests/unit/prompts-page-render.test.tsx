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
}));
// PromptsClient/NovoPromptForm/CancelarBotao chamam `useRouter()` (via
// `usar-acao-prompt.ts`, para `router.refresh()` pós-sucesso) — fora de um
// app Next real isso lança "invariant expected app router to be mounted".
vi.mock("next/navigation", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("next/navigation")>();
  return { ...original, useRouter: () => ({ refresh: vi.fn() }) };
});

const { default: PaginaPrompts } = await import("@/app/prompts/page");

/**
 * OS-LIFEBOARD · P7 — render test de `/prompts` em modo FIXTURE (mesmo
 * espírito de `tarefa-page-render.test.tsx`): sem `LIFEBOARD_DATA_MODE` no
 * ambiente de teste, `env.LIFEBOARD_DATA_MODE` cai no default `"fixture"`,
 * que lê o store semeado por `prompts-fila.fixture.ts` — 3 contas, 5 itens
 * (um de cada estado), formulário "Novo prompt".
 */
describe("PaginaPrompts (fixture)", () => {
  it("PRONTO QUANDO: renderiza os 3 cartões de conta, o formulário e os 5 estados da fila", async () => {
    const elemento = await PaginaPrompts();
    const html = renderToStaticMarkup(elemento);

    expect(html).toContain("Prompts");
    expect(html).toContain("Novo prompt");

    // 3 cartões de conta.
    expect(html).toContain("Lucas");
    expect(html).toContain("Pandora");
    expect(html).toContain("Alma Petra");
    expect(html).toContain("teto atingido"); // almapetra.ltda@gmail.com está a 150 de 150

    // os 5 estados da fila (fixture cobre um de cada).
    expect(html).toContain("na fila");
    expect(html).toContain("em execução");
    expect(html).toContain("concluída");
    expect(html).toContain("falhou");
    expect(html).toContain("cancelada");

    // modelo por complexidade aparece na legenda do formulário.
    expect(html).toMatch(/Haiku/);
    expect(html).toMatch(/Sonnet/);
    expect(html).toMatch(/Opus/);
    expect(html).toMatch(/Fable/);
  });
});
