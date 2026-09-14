import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetarFixtureStore } from "@/lib/repositories/tasks.fixture-store";

/**
 * `factory.ts` importa (no topo do módulo, incondicional) os repositórios
 * SUPABASE — mesmo quando o ramo executado em fixture nunca os chama. Esses
 * repositórios sobem até `live-client.ts`, que usa `cache()` de `"react"`:
 * em Next.js real isso é servido pela condition `react-server`; sob Vitest
 * puro (`environment: "node"`, sem essa condition) `cache` não existe em
 * `react` 18.3.1 e o `import` já lança ao avaliar o módulo — mesmo problema
 * bateria em QUALQUER teste que importasse `app/page.tsx`/`linha-do-tempo`
 * diretamente (nenhum teste existente o faz; este é o primeiro a importar
 * uma `page.tsx` real). Mock local, só neste arquivo: em modo fixture a
 * página nunca chama `getTasksRepository`, então o stub nunca precisa fazer
 * nada — só evita puxar a cadeia de import que quebra fora do Next.
 *
 * `getSourcesRepository` PRECISA devolver algo utilizável mesmo em modo
 * fixture: a página (achado BAIXO #8, rodada 2) sempre chama `.listAll()`
 * para resolver o rótulo da fonte no cabeçalho — sem isto o teste quebraria
 * com "Cannot read properties of undefined".
 */
vi.mock("@/lib/repositories/factory", () => ({
  getTasksRepository: vi.fn(),
  getSourcesRepository: vi.fn(() => ({
    listAll: vi.fn().mockResolvedValue([]),
    listSyncLogs: vi.fn().mockResolvedValue([]),
  })),
}));
// Mesmo motivo: `src/app/tarefa/actions.ts` importa `mutateLifeboard` deste
// módulo — em modo fixture ela nunca é chamada, mas o import sozinho já
// avaliaria `cache()` fora do Next. Stub vazio, só para este teste de render.
vi.mock("@/lib/supabase/live-client", () => ({
  mutateLifeboard: vi.fn(),
}));
// Os client components desta árvore chamam `useRouter()` (`usar-acao-tarefa.ts`,
// para `router.refresh()` pós-sucesso) — fora de um app Next real isso lança
// "invariant expected app router to be mounted". `notFound` continua o
// implementação de verdade (é o que o 2º teste abaixo verifica).
vi.mock("next/navigation", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("next/navigation")>();
  return { ...original, useRouter: () => ({ refresh: vi.fn() }) };
});

const { default: PaginaTarefa } = await import("@/app/tarefa/[id]/page");

/**
 * OS-LIFEBOARD · P6 — render test da página da tarefa em modo FIXTURE (mesmo
 * espírito de `linha-do-tempo-render.test.tsx`): `renderToStaticMarkup` sob
 * `environment: "node"`, sem `LIFEBOARD_DATA_MODE` no ambiente de teste →
 * `env.LIFEBOARD_DATA_MODE` cai no default `"fixture"` (`config/env.ts`), que
 * lê do store em memória semeado por `tasks.fixture.ts`.
 *
 * `task-build` é o alvo: tem 3 notas, 1 filha (`task-build-sub1`, P6) e 1
 * aresta declarada (`edge-docs-correlaciona-build`, correlação, destino
 * = task-build) — o que dá pra checar as 4 seções sem precisar de fixture
 * nova.
 */
describe("PaginaTarefa (fixture)", () => {
  // [MÉDIO #12, crítico 13/09] o store fica em `globalThis` (persiste entre
  // testes do mesmo processo) — sem resetar, um teste anterior que gravasse
  // no store vazaria estado para este. `resetarFixtureStore` existia mas
  // nunca era chamado por nenhum teste.
  beforeEach(resetarFixtureStore);

  it("PRONTO QUANDO: renderiza título, notas, filha, aresta e score de task-build", async () => {
    const elemento = await PaginaTarefa({ params: Promise.resolve({ id: "task-build" }) });
    const html = renderToStaticMarkup(elemento);

    expect(html).toContain("Implementar motor HIERARQ"); // título da tarefa
    expect(html).toContain("Notas (3)");
    expect(html).toContain("Desempate s1 &gt; s3 &gt; s2 confirmado com o operador."); // nota 1
    expect(html).toContain("Página da tarefa (P6) testada contra este fixture."); // nota 3 (P6)
    expect(html).toContain("Subtarefas (1)");
    expect(html).toContain("Revisar testes do motor HIERARQ"); // filha (task-build-sub1)
    expect(html).toContain("correlação"); // chip da aresta declarada
    expect(html).toMatch(/A = \d/); // score de assimetria (task-build tem `assimetria` declarada)
  });

  /**
   * [MÉDIO #3, rodada 5 do crítico] A região viva NASCIA JUNTO COM O TEXTO —
   * `MensagemSucesso` devolvia `null` até haver mensagem, e um leitor de tela
   * só anuncia o conteúdo novo de uma `aria-live` que já estava no documento.
   * Agora TODA região da página existe desde o primeiro render, vazia; o
   * texto entra por troca de conteúdo. Este teste conta as regiões no HTML
   * inicial e exige que todas estejam vazias.
   *
   * [MÉDIO #2, rodada 6] eram 8 e nenhuma pertencia aos DOIS formulários de
   * criação — salvar nota (a ação primária da página!) e adicionar subtarefa
   * não anunciavam nada. Agora são 10: cada formulário da página tem a sua.
   *
   * Reverter para ver falhar: em `src/components/task/mensagem-sucesso.tsx`,
   * voltar o `if (!mensagem) return null;` — a contagem cai de 10 para 3.
   */
  it("PRONTO QUANDO: as regiões vivas (role=status) já nascem no DOM, todas vazias", async () => {
    const elemento = await PaginaTarefa({ params: Promise.resolve({ id: "task-build" }) });
    const html = renderToStaticMarkup(elemento);

    const total = html.match(/role="status"/g)?.length ?? 0;
    const vazias = html.match(/role="status"[^>]*><\/p>/g)?.length ?? 0;
    // 7 formulários (nota nova, subtarefa nova, duração, mãe, meta, status,
    // átomos) + a região "Relação criada." do formulário de relação + as duas
    // de "Excluída." (notas e relações). A régua do crítico é ≥ 5 — a página
    // entrega 10.
    expect(total).toBeGreaterThanOrEqual(5);
    expect(total).toBe(10);
    expect(vazias).toBe(total); // nenhuma nasce com texto
    expect(html).toContain('aria-atomic="true"');
  });

  it("PRONTO QUANDO: id desconhecido aciona notFound() (404 de verdade, não tela em branco)", async () => {
    await expect(
      PaginaTarefa({ params: Promise.resolve({ id: "task-que-nao-existe" }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") as unknown as string });
  });
});
