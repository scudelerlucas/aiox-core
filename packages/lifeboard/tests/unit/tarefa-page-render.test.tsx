import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  goalSetFixture,
  resetarFixtureStore,
  statusSetFixture,
  subtarefaAddFixture,
} from "@/lib/repositories/tasks.fixture-store";

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
    // [MÉDIO A7, rodada 11] era `A = 18`: uma letra sem dono numa página em
    // português. O número continua lá, agora com o nome do que ele mede.
    expect(html).toMatch(/assimetria \(A\) = \d/);
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
    // [BAIXO #7, rodada 9] 7 formulários (nota nova, subtarefa nova, duração,
    // mãe, meta, status, átomos) + as DUAS do painel de notas (desfazer e
    // anúncios) + as DUAS do painel de relações + as DUAS do formulário de
    // relação. As de DESFAZER passaram a ser separadas das de ANÚNCIOS: era a
    // fusão que fazia "Confirme: clique de novo…" ser lido colado ao botão
    // "Desfazer" de uma exclusão anterior. A régua do crítico é ≥ 5.
    expect(total).toBeGreaterThanOrEqual(5);
    expect(total).toBe(13);
    expect(vazias).toBe(total); // nenhuma nasce com texto
    expect(html).toContain('aria-atomic="true"');
  });

  /**
   * ═══════════════════════════════════════════════════ ALTO A5, rodada 11 ═
   * A PÁGINA MOSTRAVA O CRONOGRAMA E ESCONDIA OS ELOS QUE O PRODUZEM.
   *
   * `caminho-critico.ts` soma 3 fontes de precedência; a lista "Relações"
   * mostrava 1. Medido em `/tarefa/task-build`: o caminho crítico
   * `task-setup → task-build → task-deploy` era INVISÍVEL e INEDITÁVEL, na
   * mesma tela que estampa "no caminho crítico".
   *
   * Reverter para ver falhar: em `page.tsx`, apagar `elosDerivados` da
   * contagem e do `<RelacoesPainel>`.
   */
  it("PRONTO QUANDO: a lista de Relações mostra os MESMOS elos que o cronograma usa", async () => {
    const elemento = await PaginaTarefa({ params: Promise.resolve({ id: "task-build" }) });
    const html = renderToStaticMarkup(elemento);

    // 4 arestas editáveis + 2 elos de precedência que vêm dos arrays da
    // tarefa (`task-setup → task-build → task-deploy`). Antes da correção o
    // cabeçalho dizia 4 enquanto o cronograma usava 6 — o número exato que o
    // crítico mediu no navegador.
    expect(html).toContain("Relações (6)");
    expect(html).not.toContain("Relações (4)");
    // As duas pontas do caminho crítico aparecem na lista, com link.
    expect(html).toContain('href="/tarefa/task-setup"');
    expect(html).toContain('href="/tarefa/task-deploy"');
    // E a tela DIZ por que esses dois não têm botão de excluir.
    expect(html).toContain("O cronograma usa esta ordem, mas ela não se edita aqui");
  });

  /**
   * MUTAÇÃO 7: trocar `origem`/`destino` em `saindo`/`entrando`.
   * O que ia para produção: as relações renderizam a tarefa apontando para si
   * mesma, com toda a direção invertida (provado no navegador pelo crítico).
   */
  it("PRONTO QUANDO: a seta de cada relação aponta para o lado certo", async () => {
    const elemento = await PaginaTarefa({ params: Promise.resolve({ id: "task-build" }) });
    const html = renderToStaticMarkup(elemento);

    // task-build → task-archive (obsolescência SAI daqui): seta para fora.
    expect(html).toMatch(/→[\s\S]{0,200}?href="\/tarefa\/task-archive"/);
    expect(html).not.toMatch(/←[\s\S]{0,200}?href="\/tarefa\/task-archive"/);
    // task-docs → task-build (correlação ENTRA aqui): seta para dentro.
    expect(html).toMatch(/←[\s\S]{0,200}?href="\/tarefa\/task-docs"/);
    expect(html).not.toMatch(/→[\s\S]{0,200}?href="\/tarefa\/task-docs"/);
    // E a tarefa nunca aponta para si mesma.
    const linhas = html.split("<li");
    for (const linha of linhas.slice(1)) {
      if (linha.includes('href="/tarefa/task-build"')) {
        expect(linha, "uma relação aponta para a própria tarefa").not.toContain("→");
      }
    }
  });

  /**
   * MUTAÇÃO 8: `filhas` exclui `status === "done"`.
   * O que ia para produção: subtarefas concluídas somem da lista e da
   * contagem — o operador perde de vista o que já fez, e a soma de herança
   * de esforço/custo passa a contar outra coisa.
   */
  it("PRONTO QUANDO: uma subtarefa CONCLUÍDA continua na lista e na contagem", async () => {
    const criada = subtarefaAddFixture("task-build", "Subtarefa já concluída", 1);
    expect("id" in criada && criada.id !== undefined).toBe(true);
    const id = "id" in criada ? (criada.id ?? "") : "";
    expect(statusSetFixture(id, "done")).toEqual({ ok: true });

    const elemento = await PaginaTarefa({ params: Promise.resolve({ id: "task-build" }) });
    const html = renderToStaticMarkup(elemento);
    expect(html).toContain("Subtarefas (2)");
    expect(html).toContain("Subtarefa já concluída");
  });

  /**
   * ═════════════════════════════════════════════════════ MÉDIO #8, rodada 13 ═
   * O CABEÇALHO DIZIA O CONTRÁRIO DO PAINEL A DOIS CENTÍMETROS DELE.
   *
   * `task.isGoal` só quer dizer "está marcada". Quem VALE é a meta vigente —
   * entre várias marcadas, a de menor id, a mesma régua do cronograma. A
   * rodada 12 tirou a reivindicação do botão ("Marcada como meta — mas quem
   * vale é outra") e esqueceu do cabeçalho, que seguia estampando
   * "· meta do ciclo" na mesma tela.
   *
   * MUTAÇÃO: voltar o cabeçalho a `task.isGoal ? "· meta do ciclo" : null`.
   */
  it("PRONTO QUANDO: o cabeçalho de uma tarefa marcada que NÃO vale não se declara a meta", async () => {
    // `task-deploy` é a meta semeada (menor id vence); marcar `task-docs`
    // também não a faz valer.
    goalSetFixture("task-docs", true);
    const html = renderToStaticMarkup(
      await PaginaTarefa({ params: Promise.resolve({ id: "task-docs" }) }),
    );
    expect(html).not.toContain("· meta do cronograma");
    expect(html).toContain("marcada como meta, mas quem vale é outra");
    // E "ciclo" não é termo desta tela — o painel e o título dizem "cronograma".
    expect(html).not.toContain("meta do ciclo");
  });

  it("PRONTO QUANDO: o cabeçalho da tarefa que VALE se declara a meta do cronograma", async () => {
    const html = renderToStaticMarkup(
      await PaginaTarefa({ params: Promise.resolve({ id: "task-deploy" }) }),
    );
    expect(html).toContain("· meta do cronograma");
    expect(html).not.toContain("quem vale é outra");
  });

  it("PRONTO QUANDO: id desconhecido aciona notFound() (404 de verdade, não tela em branco)", async () => {
    await expect(
      PaginaTarefa({ params: Promise.resolve({ id: "task-que-nao-existe" }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") as unknown as string });
  });
});
