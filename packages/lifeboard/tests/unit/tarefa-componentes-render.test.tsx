import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { codigo as codigoDoArquivo } from "./tarefa-varredura-derivada";

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
 *  - NENHUM controle usa o atributo `disabled` — nem durante a gravação
 *    (rodada 5, MÉDIO #2) nem por validade (rodada 6, ALTO #1: o botão que
 *    vira `disabled` no instante do sucesso, quando o campo esvazia, é
 *    desfocado pelo navegador e o foco cai no `<body>` — era assim que as 3
 *    CRIAÇÕES falhavam). O estado é dito por `aria-busy`/`aria-disabled`, e a
 *    recusa mora no handler (`decidirEscrita`), com frase em português.
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

const { MENSAGEM_INVALIDO } = await import("@/components/task/escrita");
const { rotuloDoBotaoDeExcluir } = await import("@/components/task/notas-painel");
const { rotuloDoBotaoDeExcluirRelacao } = await import("@/components/task/relacoes-painel");
const { AtomosForm } = await import("@/components/task/atomos-form");
const { ControleSegmentado } = await import("@/components/task/controle-segmentado");
const { DuracaoForm } = await import("@/components/task/duracao-form");
const { MaeForm } = await import("@/components/task/mae-form");
const { MensagemSucesso } = await import("@/components/task/mensagem-sucesso");
const { MetaForm } = await import("@/components/task/meta-form");
const { NotasPainel } = await import("@/components/task/notas-painel");
const { RelacoesPainel } = await import("@/components/task/relacoes-painel");
const { StatusForm } = await import("@/components/task/status-form");
const { SubtarefasPainel } = await import("@/components/task/subtarefas-painel");

/** Candidatas a destino de relação — usadas em vários blocos deste arquivo. */
const OPCOES_DESTINO = [
  { id: "t2", title: "Outra tarefa" },
  { id: "t3", title: "Mais uma" },
];

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
    // [ALTO #1, rodada 6] "Salvar átomos" era o último `disabled` da árvore.
    // [MÉDIO #3, rodada 7] e nem `aria-disabled` por VALIDADE: a árvore de
    // acessibilidade anunciava `[disabled]` ("indisponível") e a tecnologia
    // assistiva recusava um clique que mouse e teclado faziam. O botão fica
    // plenamente habilitado; a exigência é o texto de ajuda, ligado por
    // `aria-describedby`.
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('aria-describedby="dica-atomos"');
    expect(html).toContain('id="dica-atomos"');
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
  const OPCOES = OPCOES_DESTINO;

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
    // [ALTO #1, rodada 6] sem `disabled` — a guarda contra a aresta cega
    // mora em `aoEnviar` (e agora diz o motivo em português).
    // [MÉDIO #3, rodada 7] e sem `aria-disabled` por validade.
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('aria-describedby="dica-nova-relacao"');
    expect(html).toContain(MENSAGEM_INVALIDO.relacao_criar);
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
    // [BAIXO #7, rodada 9] QUATRO: cada metade (painel e formulário) tem a sua
    // região de DESFAZER e a sua região de ANÚNCIOS, separadas — era a fusão
    // das duas que fazia o pedido de confirmação ser lido colado ao "Desfazer".
    expect(r.total).toBe(4);
    expect(r.vazias).toBe(4);
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
    expect(html).not.toContain('disabled=""');
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

/**
 * [MÉDIO #2, rodada 6] `SubtarefasPainel` entrou nesta lista agora: ele era um
 * dos dois formulários de criação sem NENHUMA região viva — adicionar uma
 * subtarefa era mudo para quem não vê a lista crescer.
 */
describe("cada formulário traz UMA região viva, já no DOM e vazia (MÉDIO #3)", () => {
  const casos: readonly [string, JSX.Element][] = [
    ["DuracaoForm", <DuracaoForm key="d" taskId="t1" estimativaDias={null} />],
    ["MaeForm", <MaeForm key="m" taskId="t1" parentIdAtual={null} opcoes={[]} />],
    ["MetaForm", <MetaForm key="g" taskId="t1" isGoal={false} />],
    ["StatusForm", <StatusForm key="s" taskId="t1" statusAtual="open" />],
    ["SubtarefasPainel", <SubtarefasPainel key="sub" parentId="t1" filhas={[]} />],
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

  it("PRONTO QUANDO: NotasPainel não tem NENHUM `disabled` — 'Salvar nota' avisa por aria-disabled", () => {
    const html = renderToStaticMarkup(<NotasPainel taskId="t1" notas={[]} />);
    // [ALTO #1, rodada 6] era `disabled={texto.trim().length === 0}`: no
    // instante do sucesso o `aoSucesso` esvazia a textarea, o botão vira
    // `disabled` e o navegador manda o foco para o `<body>` (medido em 5 de 5
    // criações, a 1280 e a 390).
    // [MÉDIO #3, rodada 7] e nem `aria-disabled` por validade.
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('aria-describedby="dica-nova-nota"');
    expect(html).toContain(MENSAGEM_INVALIDO.nota_criar);
    // [BAIXO #7, rodada 9] TRÊS regiões vivas: a do formulário ("Nota salva."),
    // a do DESFAZER do painel ("Excluída. Desfazer") e a de ANÚNCIOS do painel
    // (confirmações, recusas, "Nota restaurada.") — as duas últimas eram uma só.
    expect(regioesStatus(html)).toEqual({ total: 3, vazias: 3 });
    expect(html).toContain("Nova nota");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RODADA 7 — o que o crítico mediu e reprovou.
 */
describe("ALTO #2 — os 10 sítios decidem o campo pela PORTA (rodada 9)", () => {
  it("PRONTO QUANDO: nenhum arquivo da página mostra `estado.erro` cru", () => {
    // Rodada 7: a expressão `estado.erro ?? aviso` nos 4 formulários de
    // criação. Rodada 8: consertou os 4 e deixou 6 gêmeos com `estado.erro`
    // puro. Rodada 9: a porta não expõe `estado` — não há o que mostrar cru.
    // A lista dos sítios é DERIVADA do fonte, em
    // `tarefa-escritas-varredura.test.ts` ("o 11º não nasce cru").
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/subtarefas-painel.tsx",
      "components/task/relacoes-painel.tsx",
      "components/task/atomos-form.tsx",
      "components/task/duracao-form.tsx",
      "components/task/mae-form.tsx",
      "components/task/meta-form.tsx",
      "components/task/status-form.tsx",
    ]) {
      const src = codigoDoArquivo(arquivo);
      expect(src, arquivo).not.toContain("estado.erro");
      expect(src, arquivo).toContain("usarPortaDeEscrita({");
      expect(src, arquivo).toContain(".erroDoCampo");
      // Onde existe campo LIVRE (o operador digita sem enviar), mexer nele
      // descarta o erro velho — a 2ª lei de `mensagemDoCampo`. Nos controles
      // de SELEÇÃO (mãe, meta, status) mexer JÁ é escrever, e a porta descarta
      // sozinha antes de despachar.
      if (/<(input|textarea)\b/.test(src)) {
        expect(src, arquivo).toContain(".aoMudarCampo()");
      }
    }
  });
});

describe("MÉDIO #3 — `aria-disabled` só enquanto grava; a exigência vira texto descrito", () => {
  it("PRONTO QUANDO: os 3 botões de criação nascem SEM aria-disabled, com aria-describedby", () => {
    const telas: [string, string, string][] = [
      [
        renderToStaticMarkup(<NotasPainel taskId="t1" notas={[]} />),
        "dica-nova-nota",
        MENSAGEM_INVALIDO.nota_criar ?? "",
      ],
      [
        renderToStaticMarkup(<SubtarefasPainel parentId="t1" filhas={[]} />),
        "dica-nova-subtarefa",
        MENSAGEM_INVALIDO.subtarefa_criar ?? "",
      ],
      [
        renderToStaticMarkup(
          <RelacoesPainel
            taskId="t1"
            saindo={[]}
            entrando={[]}
            opcoesDestino={OPCOES_DESTINO}
            tituloPorId={new Map()}
          />,
        ),
        "dica-nova-relacao",
        MENSAGEM_INVALIDO.relacao_criar ?? "",
      ],
    ];
    for (const [html, id, frase] of telas) {
      // [Minor do CodeRabbit, rodada 10] o `?? ""` dos três `MENSAGEM_INVALIDO`
      // acima tornava a asserção da frase VAZIA: `toContain("")` passa sempre.
      // Se qualquer entrada virasse `undefined`, este laço parava de conferir
      // a frase e seguia verde. A frase tem de EXISTIR antes de ser procurada.
      expect(frase, `${id}: MENSAGEM_INVALIDO ausente`).not.toBe("");
      expect(html, id).not.toContain('aria-disabled="true"');
      expect(html, id).not.toContain('disabled=""');
      expect(html, id).toContain(`aria-describedby="${id}"`);
      expect(html, id).toContain(`id="${id}"`);
      expect(html, id).toContain(frase);
      // "Plenamente habilitado" também no olho: sem a opacidade de metade,
      // que é como a tela dizia "morto" para quem enxerga.
      expect(html, id).not.toContain("opacity-50");
    }
  });
});

describe("MÉDIO #6 — o botão excluir de cada linha diz QUAL item apaga", () => {
  const NOTAS = [
    {
      id: "n1",
      taskId: "t1",
      texto: "primeira",
      autor: "Claude",
      createdAt: "2026-07-12T15:00:00.000Z",
    },
    {
      id: "n2",
      taskId: "t1",
      texto: "segunda",
      autor: "Lucas",
      createdAt: "2026-09-01T15:00:00.000Z",
    },
  ] as const;

  it("PRONTO QUANDO: os rótulos das duas linhas de NOTA são distintos e nomeiam a nota", () => {
    const html = renderToStaticMarkup(<NotasPainel taskId="t1" notas={NOTAS} />);
    const rotulos = [...html.matchAll(/aria-label="([^"]*excluir[^"]*)"/g)].map((m) => m[1]);
    expect(rotulos).toEqual([
      "excluir a nota 1 de 2, de Claude, de 12/07/2026",
      "excluir a nota 2 de 2, de Lucas, de 01/09/2026",
    ]);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });

  it("PRONTO QUANDO: os rótulos das linhas de RELAÇÃO nomeiam tipo e outra ponta", () => {
    const html = renderToStaticMarkup(
      <RelacoesPainel
        taskId="t1"
        saindo={[
          {
            id: "e1",
            origem: "t1",
            destino: "t2",
            tipo: "predecessor",
            peso: 1,
            nota: null,
            createdAt: "2026-07-12T15:00:00.000Z",
          },
        ]}
        entrando={[
          {
            id: "e2",
            origem: "t3",
            destino: "t1",
            tipo: "sinergia",
            peso: 0.5,
            nota: null,
            createdAt: "2026-07-13T15:00:00.000Z",
          },
        ]}
        opcoesDestino={OPCOES_DESTINO}
        tituloPorId={new Map([["t2", "Publicar"], ["t3", "Desenhar"]])}
      />,
    );
    const rotulos = [...html.matchAll(/aria-label="([^"]*excluir[^"]*)"/g)].map((m) => m[1]);
    expect(rotulos).toEqual([
      "excluir a relação 1 de 2, de predecessor com Publicar",
      "excluir a relação 2 de 2, de sinergia com Desenhar",
    ]);
  });

  it("o rótulo em confirmação continua contendo o texto visível (Label in Name)", () => {
    expect(rotuloDoBotaoDeExcluir(NOTAS[0], 0, 2, true)).toBe(
      "confirmar exclusão da nota 1 de 2, de Claude, de 12/07/2026",
    );
    expect(rotuloDoBotaoDeExcluirRelacao("obsolescencia", "Publicar", 0, 2, true)).toBe(
      "confirmar exclusão da relação 1 de 2, de obsolescência com Publicar",
    );
    // Sem autor e sem data legível, o rótulo ainda existe e ainda é uma frase.
    expect(rotuloDoBotaoDeExcluir({ autor: null, createdAt: "nada" }, 4, 9, false)).toBe(
      "excluir a nota 5 de 9, de sem autor",
    );
    // A POSIÇÃO é o que garante a distinção quando autor e data COINCIDEM —
    // o caso que a medição desta rodada achou no fixture semeado.
    const gemea = { autor: "Claude", createdAt: "2026-07-09T14:00:00.000Z" };
    expect(rotuloDoBotaoDeExcluir(gemea, 0, 2, false)).not.toBe(
      rotuloDoBotaoDeExcluir(gemea, 1, 2, false),
    );
  });
});

describe("MÉDIO #5 — a confirmação não tem mais temporizador", () => {
  it("PRONTO QUANDO: nenhum dos dois painéis arma um setTimeout de 3 s", () => {
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/relacoes-painel.tsx",
    ]) {
      const src = codigoDoArquivo(arquivo);
      expect(src, arquivo).not.toContain("setConfirmando(false), 3000");
      expect(src, arquivo).not.toContain(", 3000)");
      // As duas saídas que substituem o relógio.
      expect(src, arquivo).toContain('e.key === "Escape"');
      expect(src, arquivo).toContain("onBlur={() =>");
      expect(src, arquivo).toContain("transicaoDeConfirmacao(");
    }
  });
});

describe("BAIXO #7 — alvo de toque também na LARGURA", () => {
  it("PRONTO QUANDO: todo botão do segmentado tem min-w de 44 px", () => {
    const html = renderToStaticMarkup(
      <ControleSegmentado
        rotuloGrupo="Esforço"
        opcoes={[
          { valor: 1, rotulo: "1" },
          { valor: 2, rotulo: "2" },
        ]}
        valorAtual={1}
        aoMudar={() => undefined}
      />,
    );
    expect(html.match(/min-w-\[44px\]/g)?.length).toBe(2);
    expect(html.match(/min-h-\[44px\]/g)?.length).toBe(2);
  });
});
