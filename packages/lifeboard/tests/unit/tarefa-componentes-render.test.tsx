import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · P6 — achado MÉDIO #4 (rodada 5): 8 dos 9 componentes desta
 * página não tinham NENHUM teste. Este arquivo cobre o estado INICIAL de cada
 * um — o único que um render estático alcança — e é justamente onde moram as
 * regressões caras desta série de rodadas:
 *
 *  - átomos nascem SEM seleção e com "Salvar átomos" desabilitado (rodada 4:
 *    o form pré-marcava 2/1/1 e um clique cego gravava prioridade quase
 *    máxima em toda tarefa sem átomos);
 *  - relação nasce com destino VAZIO e botão desabilitado (rodada 4: um
 *    clique cego criava aresta contra a 1ª tarefa da lista);
 *  - toda região `role="status"` já está no DOM, VAZIA (rodada 5, MÉDIO #3);
 *  - nenhum controle usa `disabled` durante a gravação (rodada 5, MÉDIO #2 —
 *    era o que jogava o foco no `<body>`), e sim `aria-busy`/`aria-disabled`.
 *
 * Ambiente: `renderToStaticMarkup`, sem DOM (o repo não tem jsdom nem
 * `@testing-library`, e `npm install` está proibido — mesma nota de
 * `controle-segmentado.test.tsx`). As transições que exigem DOM (clique →
 * sucesso → Desfazer → falha do desfazer → foco) são medidas no navegador
 * real, com Playwright, contra o build de produção.
 *
 * As Server Actions são mockadas em bloco: o objetivo aqui é o COMPONENTE,
 * não a cadeia de import do servidor.
 */
vi.mock("@/app/tarefa/actions", () => ({
  arestaAddAction: vi.fn(),
  arestaDelAction: vi.fn(),
  atomosSetAction: vi.fn(),
  estimativaSetAction: vi.fn(),
  goalSetAction: vi.fn(),
  notaAddAction: vi.fn(),
  notaDelAction: vi.fn(),
  parentSetAction: vi.fn(),
  statusSetAction: vi.fn(),
  subtarefaAddAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { AtomosForm } = await import("@/components/task/atomos-form");
const { ControleSegmentado } = await import("@/components/task/controle-segmentado");
const { DuracaoForm } = await import("@/components/task/duracao-form");
const { MaeForm } = await import("@/components/task/mae-form");
const { MensagemSucesso } = await import("@/components/task/mensagem-sucesso");
const { MetaForm } = await import("@/components/task/meta-form");
const { NotasPainel } = await import("@/components/task/notas-painel");
const { RelacoesPainel } = await import("@/components/task/relacoes-painel");
const { StatusForm } = await import("@/components/task/status-form");

const HERANCA = {
  esforco: 2,
  custo: 2,
  herdado: false,
  filhasAbertas: 0,
  filhasSemAtomos: 0,
} as const;

/** Quantas regiões vivas o HTML tem, e quantas delas estão VAZIAS. */
function regioesStatus(html: string): { total: number; vazias: number } {
  const total = html.match(/role="status"/g)?.length ?? 0;
  const vazias = html.match(/role="status"[^>]*><\/p>/g)?.length ?? 0;
  return { total, vazias };
}

describe("AtomosForm — nasce sem seleção (regressão da rodada 4)", () => {
  it("PRONTO QUANDO: os 3 grupos nascem sem nenhuma opção marcada e o botão sai desabilitado", () => {
    const html = renderToStaticMarkup(
      <AtomosForm
        taskId="t1"
        assimetriaAtual={null}
        score={null}
        motivo="sem_atomos"
        heranca={HERANCA}
      />,
    );
    // 3 grupos (opcionalidade 3 opções + esforço 4 + custo 4 = 11 botões de rádio)
    expect(html.match(/role="radio"/g)?.length).toBe(11);
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain("Escolha os três para calcular o score.");
    // O botão "Salvar átomos" é o único `disabled` da árvore — e por VALIDADE,
    // não por gravação em curso.
    expect(html.match(/disabled=""/g)?.length).toBe(1);
    // "Limpar átomos" só existe quando há átomos salvos.
    expect(html).not.toContain("Limpar átomos");
  });

  it("com os três átomos já salvos: nada desabilitado e 'Limpar átomos' disponível", () => {
    const html = renderToStaticMarkup(
      <AtomosForm
        taskId="t1"
        assimetriaAtual={{ opcionalidade: 2, esforco: 3, custo: 3 }}
        score={null}
        motivo={null}
        heranca={HERANCA}
      />,
    );
    expect(html.match(/aria-checked="true"/g)?.length).toBe(3);
    expect(html).toContain("Limpar átomos");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("Escolha os três para calcular o score.");
  });

  it("PRONTO QUANDO: motivo 'nao_calculavel' diz que a CONTA falhou — não que faltam átomos (BAIXO #7)", () => {
    const html = renderToStaticMarkup(
      <AtomosForm
        taskId="t1"
        assimetriaAtual={{ opcionalidade: 2, esforco: 3, custo: 3 }}
        score={null}
        motivo="nao_calculavel"
        heranca={HERANCA}
      />,
    );
    expect(html).toContain("Não foi possível calcular o score agora.");
    expect(html).not.toContain("Sem átomos declarados");
  });

  it("motivo 'sem_atomos' mantém a frase antiga (quem não declarou precisa declarar)", () => {
    const html = renderToStaticMarkup(
      <AtomosForm
        taskId="t1"
        assimetriaAtual={null}
        score={null}
        motivo="sem_atomos"
        heranca={HERANCA}
      />,
    );
    expect(html).toContain("Sem átomos declarados");
    expect(html).not.toContain("Não foi possível calcular o score agora.");
  });
});

describe("RelacoesPainel — destino vazio e botão desabilitado (regressão da rodada 4)", () => {
  const OPCOES = [
    { id: "t2", title: "Outra tarefa" },
    { id: "t3", title: "Mais uma" },
  ];

  it("PRONTO QUANDO: o select nasce em '' (a opção 'Escolha a tarefa…') e 'Adicionar relação' nasce desabilitado", () => {
    const html = renderToStaticMarkup(
      <RelacoesPainel
        taskId="t1"
        saindo={[]}
        entrando={[]}
        opcoesDestino={OPCOES}
        tituloPorId={new Map()}
      />,
    );
    expect(html).toContain("Escolha a tarefa…");
    // A opção SELECIONADA é a vazia — nenhuma tarefa real nasce escolhida.
    expect(html).toContain('<option value="" selected="">Escolha a tarefa…</option>');
    expect(html.match(/selected=""/g)?.length).toBe(1);
    expect(html.match(/disabled=""/g)?.length).toBe(1); // só "Adicionar relação"
    expect(html).toContain("Adicionar relação");
    // Sem relação criada ainda: nenhum "Desfazer" na tela.
    expect(html).not.toContain("Desfazer");
  });

  it("PRONTO QUANDO: as duas regiões vivas do painel nascem no DOM e VAZIAS (MÉDIO #3)", () => {
    const html = renderToStaticMarkup(
      <RelacoesPainel
        taskId="t1"
        saindo={[]}
        entrando={[]}
        opcoesDestino={OPCOES}
        tituloPorId={new Map()}
      />,
    );
    const r = regioesStatus(html);
    expect(r.total).toBe(2); // a do painel ("Excluída.") e a do formulário ("Relação criada.")
    expect(r.vazias).toBe(2);
    expect(html).toContain('aria-atomic="true"');
  });

  it("a linha da relação traz o botão excluir sem `disabled` (o foco não pode cair no body)", () => {
    const aresta = {
      id: "e1",
      origem: "t1",
      destino: "t2",
      tipo: "correlacao" as const,
      peso: 1,
      nota: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const html = renderToStaticMarkup(
      <RelacoesPainel
        taskId="t1"
        saindo={[aresta]}
        entrando={[]}
        opcoesDestino={OPCOES}
        tituloPorId={new Map([["t2", "Outra tarefa"]])}
      />,
    );
    expect(html).toContain("excluir");
    expect(html.match(/disabled=""/g)?.length).toBe(1); // segue sendo só "Adicionar relação"
  });
});

describe("MensagemSucesso — região viva PERSISTENTE (achado MÉDIO #3, rodada 5)", () => {
  it("PRONTO QUANDO: sem mensagem, o <p role=status> JÁ EXISTE e está vazio", () => {
    const html = renderToStaticMarkup(<MensagemSucesso mensagem={null} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(regioesStatus(html)).toEqual({ total: 1, vazias: 1 });
    // Sem margem quando vazia — não empurra o layout.
    expect(html).toContain("m-0");
  });

  it("com mensagem, a MESMA região carrega o texto (troca de conteúdo, não de existência)", () => {
    const html = renderToStaticMarkup(<MensagemSucesso mensagem="Duração salva." />);
    expect(regioesStatus(html)).toEqual({ total: 1, vazias: 0 });
    expect(html).toContain("Duração salva.");
    expect(html).toContain("mt-1.5");
  });
});

describe("cada formulário traz UMA região viva, já no DOM e vazia (MÉDIO #3)", () => {
  const casos: readonly [string, JSX.Element][] = [
    ["DuracaoForm", <DuracaoForm key="d" taskId="t1" estimativaDias={null} />],
    ["MaeForm", <MaeForm key="m" taskId="t1" parentIdAtual={null} opcoes={[]} />],
    ["MetaForm", <MetaForm key="g" taskId="t1" isGoal={false} />],
    ["StatusForm", <StatusForm key="s" taskId="t1" statusAtual="open" />],
    [
      "AtomosForm",
      <AtomosForm
        key="a"
        taskId="t1"
        assimetriaAtual={null}
        score={null}
        motivo="sem_atomos"
        heranca={HERANCA}
      />,
    ],
  ];

  for (const [nome, elemento] of casos) {
    it(`PRONTO QUANDO: ${nome} nasce com 1 região viva vazia`, () => {
      expect(regioesStatus(renderToStaticMarkup(elemento))).toEqual({ total: 1, vazias: 1 });
    });
  }
});

describe("nenhum controle usa `disabled` para dizer 'gravando' (achado MÉDIO #2, rodada 5)", () => {
  it("PRONTO QUANDO: ControleSegmentado desabilitado usa aria-busy/aria-disabled, NUNCA o atributo disabled", () => {
    const html = renderToStaticMarkup(
      <ControleSegmentado
        rotuloGrupo="Status da tarefa"
        opcoes={[
          { valor: "open", rotulo: "aberta" },
          { valor: "done", rotulo: "concluída" },
        ]}
        valorAtual="open"
        aoMudar={() => undefined}
        desabilitado
      />,
    );
    // É ESTE atributo que o navegador usa para tirar o foco do elemento.
    expect(html).not.toContain("disabled=\"\"");
    expect(html.match(/aria-disabled="true"/g)?.length).toBe(2);
    expect(html.match(/aria-busy="true"/g)?.length).toBe(2);
    expect(html).toContain("opacity-50"); // continua parecendo indisponível
  });

  it("sem `desabilitado`, nem aria-busy nem aria-disabled aparecem", () => {
    const html = renderToStaticMarkup(
      <ControleSegmentado
        rotuloGrupo="Status da tarefa"
        opcoes={[{ valor: "open", rotulo: "aberta" }]}
        valorAtual="open"
        aoMudar={() => undefined}
      />,
    );
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("aria-disabled");
  });

  it("MaeForm: o <select> nunca nasce `disabled` (era ele que mandava o foco ao body)", () => {
    const html = renderToStaticMarkup(
      <MaeForm taskId="t1" parentIdAtual={null} opcoes={[{ id: "t2", title: "Outra" }]} />,
    );
    expect(html).not.toContain('disabled=""');
  });

  it("NotasPainel: 'Salvar nota' nasce desabilitado por VALIDADE (nota vazia), e a região viva já existe", () => {
    const html = renderToStaticMarkup(<NotasPainel taskId="t1" notas={[]} />);
    expect(html.match(/disabled=""/g)?.length).toBe(1);
    expect(regioesStatus(html)).toEqual({ total: 1, vazias: 1 });
    expect(html).toContain("Nova nota");
  });
});
