import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  componenteFilho,
  disparar,
  expandir,
  nos,
  oQueATelaDiz,
  porTag,
  propsDe,
  texto,
  todasAsTags,
} from "./arvore-react";
import {
  janelaFalsa,
  montar,
  novaInstancia,
  reactFalso,
  soltarInstancia,
  type Instancia,
  type TimerFalso,
} from "./hooks-falsos";

/**
 * OS-LIFEBOARD · P6 — OS HANDLERS, RODADOS (rodada 11).
 *
 * O crítico da rodada 10 aplicou 13 mutações e a suíte de 1350 testes ficou
 * verde em todas. Seis delas moram no CORPO de um handler de componente, onde
 * nem `renderToStaticMarkup` (que só vê HTML) nem a varredura léxica (que só
 * vê texto) alcançam. Este arquivo alcança: os componentes são chamados como
 * funções, com hooks falsos, e os handlers são DISPARADOS — a escrita sai
 * pela porta de verdade e chega à Server Action espiã.
 *
 * Cada bloco diz, por escrito, qual mutação ele pega e o que iria para
 * produção sem ele.
 */

vi.mock("react", () => reactFalso);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const acao = vi.fn();
vi.mock("@/app/tarefa/actions", () => ({
  escreverTarefaAction: (...args: unknown[]): unknown => acao(...args),
}));

const { DuracaoForm } = await import("@/components/task/duracao-form");
const { MaeForm } = await import("@/components/task/mae-form");
const { AtomosForm } = await import("@/components/task/atomos-form");
const { NotasPainel } = await import("@/components/task/notas-painel");
const { RelacoesPainel } = await import("@/components/task/relacoes-painel");
const { SubtarefasPainel } = await import("@/components/task/subtarefas-painel");
const { MENSAGEM_INVALIDO } = await import("@/components/task/escrita");
const { chaveRascunhoAutorNota, chaveRascunhoNota } = await import(
  "@/components/task/rascunho-nota"
);

interface PedidoEspiado {
  op: string;
  campos: Record<string, string>;
}

function pedidos(): PedidoEspiado[] {
  return acao.mock.calls.map((c) => c[1] as PedidoEspiado);
}

/**
 * [rodada 13] Uma gravação que NÃO responde até alguém mandar — é o único
 * jeito de medir o que acontece com o que o operador digita ENQUANTO a
 * escrita está em voo (ALTO #4).
 */
function gravacaoEmVoo(): { responder: () => void } {
  const liberadores: ((v: unknown) => void)[] = [];
  acao.mockImplementation(
    () =>
      new Promise((r) => {
        liberadores.push(r);
      }),
  );
  return {
    responder: () => {
      for (const r of liberadores) r({ ok: true });
    },
  };
}

/** Deixa as promessas pendentes do despacho resolverem. */
async function assentar(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

/** O contrato do campo numérico: o texto EXATO chega ao componente. */
function digitar(props: Record<string, unknown>, texto: string): void {
  (props.aoMudar as (t: string) => void)(texto);
}

/** [MÉDIO #4, rodada 12] o relógio vem de fora — ver `NotasPainelProps`. */
const AGORA = Date.parse("2026-07-09T12:00:00.000Z");

const HERANCA = {
  esforco: 2,
  custo: 2,
  herdado: false,
  filhasAbertas: 0,
  filhasSemAtomos: 0,
} as const;

let janela: { timers: TimerFalso[]; deposito: Map<string, string>; rodarTimer: (ms: number) => void };

beforeEach(() => {
  soltarInstancia();
  acao.mockReset();
  acao.mockResolvedValue({ ok: true });
  janela = janelaFalsa();
});

// ══════════════════════════════════════════════════ MUTAÇÃO: `mudou: true` ═
describe("DuracaoForm — a guarda de 'nada mudou' compara com o CONFIRMADO", () => {
  /**
   * MUTAÇÃO 3: `mudou: valor.trim() !== confirmado` → `mudou: true`.
   * O que ia para produção: a frase "A duração já está salva assim — nada
   * mudou." deixa de existir e TODA tecla vira ida ao servidor.
   */
  it("PRONTO QUANDO: salvar o mesmo número NÃO chega ao servidor, e a tela fala", () => {
    const inst = novaInstancia();
    const arvore = montar(inst, DuracaoForm, { taskId: "task-docs", estimativaDias: 2 });
    disparar(porTag(arvore, "form"), "onSubmit");
    expect(acao).not.toHaveBeenCalled();
    const depois = montar(inst, DuracaoForm, { taskId: "task-docs", estimativaDias: 2 });
    expect(oQueATelaDiz(depois)).toContain("A duração já está salva assim — nada mudou.");
  });

  /**
   * [BAIXO, rodada 11] "Duração salva." era a frase também quando a duração
   * era REMOVIDA — a mesma frase para os dois desfechos opostos. (`MaeForm`
   * já distinguia: "Tarefa mãe removida.".)
   */
  it("PRONTO QUANDO: esvaziar o campo anuncia REMOÇÃO, não 'salva'", async () => {
    const inst = novaInstancia();
    const props = { taskId: "task-docs", estimativaDias: 2 };
    const arvore = montar(inst, DuracaoForm, props);
    digitar(propsDe(arvore, "CampoNumerico"), "");
    const comCampoVazio = montar(inst, DuracaoForm, props);
    disparar(porTag(comCampoVazio, "form"), "onSubmit");
    await assentar();
    const depois = montar(inst, DuracaoForm, props);
    expect(oQueATelaDiz(depois)).toContain("Duração removida.");
    expect(oQueATelaDiz(depois)).not.toContain("Duração salva.");
  });

  it("PRONTO QUANDO: salvar um número continua anunciando 'Duração salva.'", async () => {
    const inst = novaInstancia();
    const props = { taskId: "task-docs", estimativaDias: 2 };
    const arvore = montar(inst, DuracaoForm, props);
    digitar(propsDe(arvore, "CampoNumerico"), "3");
    const comValor = montar(inst, DuracaoForm, props);
    disparar(porTag(comValor, "form"), "onSubmit");
    await assentar();
    const depois = montar(inst, DuracaoForm, props);
    expect(oQueATelaDiz(depois)).toContain("Duração salva.");
  });

  it("e um número DIFERENTE continua chegando ao servidor", () => {
    const inst = novaInstancia();
    const arvore = montar(inst, DuracaoForm, { taskId: "task-docs", estimativaDias: 2 });
    digitar(propsDe(arvore, "CampoNumerico"), "3");
    const depois = montar(inst, DuracaoForm, { taskId: "task-docs", estimativaDias: 2 });
    disparar(porTag(depois, "form"), "onSubmit");
    expect(pedidos()).toEqual([
      { op: "duracao", campos: { task_id: "task-docs", estimativa_dias: "3" } },
    ]);
  });
});

// ═══════════════════════════════════ CRÍTICO — o texto digitado sempre chega ═
describe("CRÍTICO — o programa recebe o que o operador VÊ, nos três campos", () => {
  /**
   * O defeito medido no Chromium: `<input type="number">` em `badInput`
   * (`2e`) MOSTRA `2e` e reporta `value === ""`. A duração salva era apagada
   * com "Duração salva." na tela.
   */
  it("PRONTO QUANDO: `2e` na duração da tarefa CHEGA ao servidor como `2e` (não como vazio)", () => {
    const inst = novaInstancia();
    const arvore = montar(inst, DuracaoForm, { taskId: "task-docs", estimativaDias: 2 });
    digitar(propsDe(arvore, "CampoNumerico"), "2e");
    const depois = montar(inst, DuracaoForm, { taskId: "task-docs", estimativaDias: 2 });
    disparar(porTag(depois, "form"), "onSubmit");
    expect(pedidos()[0]?.campos.estimativa_dias).toBe("2e");
    // E o que apagaria a duração — `""` — nunca sai daqui.
    expect(pedidos()[0]?.campos.estimativa_dias).not.toBe("");
  });

  it("PRONTO QUANDO: `2e` na duração da SUBTAREFA chega inteiro", () => {
    const inst = novaInstancia();
    const painel = montar(inst, SubtarefasPainel, { parentId: "task-build", filhas: [] });
    const filho = componenteFilho(painel, "FormularioNovaSubtarefa");
    const instFilho = novaInstancia();
    const form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "input"), "onChange", { target: { value: "Uma subtarefa" } });
    digitar(propsDe(form, "CampoNumerico"), "2e");
    const depois = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(depois, "form"), "onSubmit");
    expect(pedidos()[0]?.campos.estimativa_dias).toBe("2e");
  });

  it("PRONTO QUANDO: `0.5e` no desconto da sinergia chega inteiro — nunca vira o default 1", () => {
    const inst = novaInstancia();
    const painel = montar(inst, RelacoesPainel, {
      taskId: "task-standup",
      saindo: [],
      entrando: [],
      elosDerivados: [],
      opcoesDestino: [{ id: "task-docs", title: "Escrever documentação", bloqueadaPara: [] }],
      tituloPorId: new Map([["task-docs", "Escrever documentação"]]),
    });
    const filho = componenteFilho(painel, "FormularioNovaAresta");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "select"), "onChange", { target: { value: "task-docs" } });
    form = montar(instFilho, filho.fn, filho.props);
    // O controle de tipo é um componente; o handler `aoMudar` é o contrato.
    const segmentado = componenteFilho(form, "ControleSegmentado");
    (segmentado.props.aoMudar as (v: string) => void)("sinergia");
    form = montar(instFilho, filho.fn, filho.props);
    digitar(propsDe(form, "CampoNumerico"), "0.5e");
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "form"), "onSubmit");
    expect(pedidos()[0]?.campos.peso).toBe("0.5e");
    expect(pedidos()[0]?.campos.peso).not.toBe("");
  });
});

// ═══════════════════════════════════════ MUTAÇÃO: `aoFalha` do <select> mãe ═
describe("MaeForm — uma recusa do servidor devolve o <select> ao que está no banco", () => {
  /**
   * MUTAÇÃO 5: remover o `aoFalha` que reverte o `<select>`.
   * O que ia para produção: depois de uma recusa o select segue mostrando a
   * mãe rejeitada — a tela mentindo sobre o banco.
   */
  it("PRONTO QUANDO: recusada a troca, o <select> volta à mãe confirmada", async () => {
    acao.mockResolvedValue({ erro: "Isso criaria um ciclo de hierarquia." });
    const inst = novaInstancia();
    const props = {
      taskId: "task-build",
      parentIdAtual: "task-setup",
      opcoes: [
        { id: "task-setup", title: "Configurar ambiente" },
        { id: "task-docs", title: "Escrever documentação" },
      ],
      descendentesOcultas: 0,
    };
    const arvore = montar(inst, MaeForm, props);
    disparar(porTag(arvore, "select"), "onChange", { target: { value: "task-docs" } });
    await assentar();
    const depois = montar(inst, MaeForm, props);
    expect(porTag(depois, "select").props.value).toBe("task-setup");
    expect(oQueATelaDiz(depois)).toContain("Isso criaria um ciclo de hierarquia.");
  });
});

// ═════════════════════════════════════ MUTAÇÃO: `valido: todosEscolhidos` ═
describe("AtomosForm — trio incompleto não chega ao servidor", () => {
  /**
   * MUTAÇÃO 6: remover `valido: todosEscolhidos`.
   * O que ia para produção: um trio incompleto manda `"null"` (a string!) ao
   * servidor nos três campos.
   */
  it("PRONTO QUANDO: com os três vazios, 'Salvar átomos' recusa e explica", () => {
    const inst = novaInstancia();
    const props = {
      taskId: "task-docs",
      assimetriaAtual: null,
      score: null,
      motivo: "sem_atomos" as const,
      heranca: HERANCA,
    };
    const arvore = montar(inst, AtomosForm, props);
    const salvar = todasAsTags(arvore, "button").find(
      (b) => texto(b.props.children) === "Salvar átomos",
    );
    disparar(salvar ?? { type: "", props: {} }, "onClick");
    expect(acao).not.toHaveBeenCalled();
    const depois = montar(inst, AtomosForm, props);
    expect(oQueATelaDiz(depois)).toContain(MENSAGEM_INVALIDO.atomos_salvar);
    // E a string "null" — o que a mutação mandaria — nunca sai daqui.
    expect(JSON.stringify(pedidos())).not.toContain("null");
  });
});

// ═══════════════════════════════════════════════════════ ALTO #4, rodada 13 ═
describe("O que o operador digita DURANTE a gravação sobrevive à resposta", () => {
  /**
   * MUTAÇÃO 4 da rodada 13: esvaziar o campo no sucesso sem conferir se ele
   * mudou (`setTexto("")` direto, como era até aqui).
   *
   * O que ia — e foi — para produção: com 2,5 s de latência, escrever
   * "primeira nota", clicar "Salvar nota" e continuar escrevendo 300 ms depois
   * fazia a resposta apagar "segunda nota que eu estava escrevendo" e zerar o
   * rascunho do `sessionStorage` junto. O rascunho nasceu na rodada 5 para
   * "escrever meia nota e não perder": ele protegia contra navegar e não
   * protegia contra salvar.
   */
  it("PRONTO QUANDO: a nota digitada em voo NÃO é apagada pela resposta", async () => {
    const emVoo = gravacaoEmVoo();
    const inst = novaInstancia();
    const props = { taskId: "task-review", notas: [], agora: AGORA };
    const painel = montar(inst, NotasPainel, props);
    const filho = componenteFilho(painel, "FormularioNovaNota");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "textarea"), "onChange", { target: { value: "primeira nota" } });
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "form"), "onSubmit");
    // …e o operador continua escrevendo enquanto a gravação está em voo.
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "textarea"), "onChange", {
      target: { value: "segunda nota que eu estava escrevendo" },
    });
    form = montar(instFilho, filho.fn, filho.props);
    emVoo.responder();
    await assentar();
    const depois = montar(instFilho, filho.fn, filho.props);
    expect(porTag(depois, "textarea").props.value).toBe("segunda nota que eu estava escrevendo");
    // E o rascunho do que ele ainda está escrevendo continua no depósito.
    expect(janela.deposito.get(chaveRascunhoNota("task-review"))).toBe(
      "segunda nota que eu estava escrevendo",
    );
  });

  it("PRONTO QUANDO: a nota intacta CONTINUA sendo esvaziada no sucesso", async () => {
    acao.mockResolvedValue({ ok: true });
    const inst = novaInstancia();
    const props = { taskId: "task-review", notas: [], agora: AGORA };
    const painel = montar(inst, NotasPainel, props);
    const filho = componenteFilho(painel, "FormularioNovaNota");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "textarea"), "onChange", { target: { value: "uma nota" } });
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "form"), "onSubmit");
    await assentar();
    const depois = montar(instFilho, filho.fn, filho.props);
    expect(porTag(depois, "textarea").props.value).toBe("");
  });

  /** O gêmeo sem rede nenhuma: subtarefa não tem rascunho para socorrer. */
  it("PRONTO QUANDO: título e duração da subtarefa digitados em voo sobrevivem", async () => {
    const emVoo = gravacaoEmVoo();
    const inst = novaInstancia();
    const painel = montar(inst, SubtarefasPainel, { parentId: "task-docs", filhas: [] });
    const filho = componenteFilho(painel, "FormularioNovaSubtarefa");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "input"), "onChange", { target: { value: "primeira sub" } });
    form = montar(instFilho, filho.fn, filho.props);
    digitar(propsDe(form, "CampoNumerico"), "2");
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "form"), "onSubmit");
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "input"), "onChange", {
      target: { value: "segunda sub que eu estava escrevendo" },
    });
    form = montar(instFilho, filho.fn, filho.props);
    digitar(propsDe(form, "CampoNumerico"), "7");
    form = montar(instFilho, filho.fn, filho.props);
    emVoo.responder();
    await assentar();
    const depois = montar(instFilho, filho.fn, filho.props);
    expect(porTag(depois, "input").props.value).toBe("segunda sub que eu estava escrevendo");
    expect(propsDe(depois, "CampoNumerico").valor).toBe("7");
  });
});

// ═══════════════════════════════════════════════════════ BAIXO #11, rodada 13 ═
describe("DuracaoForm — a caixa passa a mostrar o que ficou gravado", () => {
  it("PRONTO QUANDO: salvar `007` deixa `7` na caixa, e o clique seguinte não fala 'nada mudou'", async () => {
    acao.mockResolvedValue({ ok: true });
    const inst = novaInstancia();
    const props = { taskId: "task-docs", estimativaDias: 2 };
    let arvore = montar(inst, DuracaoForm, props);
    digitar(propsDe(arvore, "CampoNumerico"), "007");
    arvore = montar(inst, DuracaoForm, props);
    disparar(porTag(arvore, "form"), "onSubmit");
    await assentar();
    const depois = montar(inst, DuracaoForm, props);
    expect(propsDe(depois, "CampoNumerico").valor).toBe("7");
    // E o confirmado passou a ser `7`: salvar de novo é que é "nada mudou".
    disparar(porTag(depois, "form"), "onSubmit");
    expect(pedidos()).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════ ALTO #5 e MÉDIO #9, rodada 13 ═
describe("O texto que o operador escreveu cabe na tela e mantém as quebras", () => {
  /**
   * MUTAÇÃO 5 da rodada 13: tirar a quebra de palavra do bloco de texto.
   * O que ia — e foi — para produção: medido a 390 px no Chromium, um e-mail
   * dentro de uma nota levava `documentElement.scrollWidth` a 435 contra 390
   * de `clientWidth`, e o que saía da tela era o botão "excluir" DAQUELA nota,
   * a única forma de apagá-la. Um SHA de 40 caracteres dava 459; um token de
   * 64, 632; um título de subtarefa de 200 caracteres, 1801.
   *
   * Um item de flex nasce com `min-width: auto` e se recusa a ficar menor que
   * a palavra mais longa que contém: o remédio são as DUAS classes, `min-w-0`
   * (tira o piso) e `break-words` (deixa a palavra quebrar). A medição em
   * pixel está no relatório; aqui fica a trava barata que roda em 50 ms.
   */
  it("PRONTO QUANDO: o texto da nota quebra palavra, não estica a tela", () => {
    const nota = {
      id: "n1",
      taskId: "task-review",
      texto: "lucas.scudeler@pandoratreinamentos.com.br",
      autor: "Claude",
      createdAt: "2026-07-09T10:00:00.000Z",
    };
    const arvore = expandir(
      montar(novaInstancia(), NotasPainel, { taskId: "task-review", notas: [nota], agora: AGORA }),
    );
    const bloco = todasAsTags(arvore, "p").find((n) => n.props.children === nota.texto);
    const classes = String(bloco?.props.className ?? "");
    expect(classes, "o texto da nota precisa de min-w-0").toContain("min-w-0");
    expect(classes, "o texto da nota precisa de break-words").toContain("break-words");
    // [MÉDIO #9] e as quebras de linha que o operador digitou são preservadas:
    // o banco guarda "linha um\nlinha dois\n\n- item a\n- item b" e a tela
    // devolvia tudo numa frase corrida (1 linha de 23 px, medida no Chromium).
    expect(classes, "as quebras de linha da nota precisam aparecer").toContain(
      "whitespace-pre-line",
    );
  });

  it("PRONTO QUANDO: o título da subtarefa quebra palavra", () => {
    const filha = {
      id: "task-x",
      title: "T".repeat(200),
      status: "open" as const,
      estimativaDias: null,
      isGoal: false,
      parentId: "task-docs",
      predecessorIds: [],
      successorIds: [],
      assimetria: null,
      sourceId: "s1",
      updatedAt: "2026-07-09T10:00:00.000Z",
    };
    const arvore = expandir(
      montar(novaInstancia(), SubtarefasPainel, {
        parentId: "task-docs",
        filhas: [filha] as never,
      }),
    );
    const link = nos(arvore).find((n) => n.props.children === filha.title);
    const classes = String(link?.props.className ?? "");
    expect(classes, "o título da subtarefa precisa de min-w-0").toContain("min-w-0");
    expect(classes, "o título da subtarefa precisa de break-words").toContain("break-words");
  });
});

// ═══════════════════════════════════════════════════════ MÉDIO #7, rodada 13 ═
describe("O <select> 'Destino' não pode mentir sobre o que vai enviar", () => {
  /**
   * O que ia — e foi — para produção: a candidata escolhida deixava de estar
   * disponível por causa de OUTRA escrita (o `router.refresh()` traz a lista
   * nova), o `<select>` voltava a exibir "Escolha a tarefa…" porque o valor
   * não casa com opção nenhuma, e `destino` continuava preenchido: a dica
   * sumia, o botão ficava ativo e a escrita saía contra um alvo invisível.
   * A troca de TIPO já zerava o campo; a troca vinda do servidor, não.
   */
  it("PRONTO QUANDO: candidata bloqueada pelo servidor zera a escolha, a dica volta e nada é enviado", () => {
    const inst = novaInstancia();
    const base = {
      taskId: "task-standup",
      saindo: [],
      entrando: [],
      elosDerivados: [],
      tituloPorId: new Map([["task-docs", "Escrever documentação"]]),
    };
    const painel = montar(inst, RelacoesPainel, {
      ...base,
      opcoesDestino: [{ id: "task-docs", title: "Escrever documentação", bloqueadaPara: [] }],
    });
    const filho = componenteFilho(painel, "FormularioNovaAresta");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "select"), "onChange", { target: { value: "task-docs" } });
    form = montar(instFilho, filho.fn, filho.props);
    expect(porTag(form, "select").props.value).toBe("task-docs");

    // Outra escrita aconteceu: o servidor passa a bloquear esta candidata.
    const painelDepois = montar(inst, RelacoesPainel, {
      ...base,
      opcoesDestino: [
        { id: "task-docs", title: "Escrever documentação", bloqueadaPara: ["predecessor"] },
      ],
    });
    const filhoDepois = componenteFilho(painelDepois, "FormularioNovaAresta");
    const comListaNova = montar(instFilho, filhoDepois.fn, filhoDepois.props);
    expect(porTag(comListaNova, "select").props.value).toBe("");
    expect(oQueATelaDiz(comListaNova)).toContain(MENSAGEM_INVALIDO.relacao_criar);
    disparar(porTag(comListaNova, "form"), "onSubmit");
    expect(acao).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════ BAIXO #12, rodada 13 ═
describe("A relação criada pela tela pode ter nota", () => {
  it("PRONTO QUANDO: o texto escrito no campo de nota viaja no pedido", () => {
    const inst = novaInstancia();
    const painel = montar(inst, RelacoesPainel, {
      taskId: "task-standup",
      saindo: [],
      entrando: [],
      elosDerivados: [],
      opcoesDestino: [{ id: "task-docs", title: "Escrever documentação", bloqueadaPara: [] }],
      tituloPorId: new Map([["task-docs", "Escrever documentação"]]),
    });
    const filho = componenteFilho(painel, "FormularioNovaAresta");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "select"), "onChange", { target: { value: "task-docs" } });
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "textarea"), "onChange", {
      target: { value: "Andam juntos, sem ordem." },
    });
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "form"), "onSubmit");
    expect(pedidos()[0]?.campos.nota).toBe("Andam juntos, sem ordem.");
  });
});

// ═══════════════════════════════════════ MUTAÇÃO: rascunho não é limpo ═
describe("NotasPainel — salvar a nota apaga o rascunho", () => {
  /**
   * MUTAÇÃO 4: remover `limparRascunhoNota(taskId)` do sucesso.
   * O que ia para produção: a nota salva VOLTA no rascunho na próxima visita,
   * e o operador salva duplicado.
   */
  it("PRONTO QUANDO: depois do sucesso, o depósito não guarda mais o rascunho", async () => {
    const inst = novaInstancia();
    const props = { taskId: "task-build", notas: [], agora: AGORA };
    const painel = montar(inst, NotasPainel, props);
    const filho = componenteFilho(painel, "FormularioNovaNota");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "textarea"), "onChange", { target: { value: "meia nota" } });
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "input"), "onChange", { target: { value: "Lucas" } });
    form = montar(instFilho, filho.fn, filho.props);
    // O rascunho existe ANTES de salvar (é o que faz ele voltar no F5).
    expect(janela.deposito.get(chaveRascunhoNota("task-build"))).toBe("meia nota");
    expect(janela.deposito.get(chaveRascunhoAutorNota("task-build"))).toBe("Lucas");

    disparar(porTag(form, "form"), "onSubmit");
    await assentar();
    expect(pedidos()[0]?.op).toBe("nota_criar");
    expect(janela.deposito.has(chaveRascunhoNota("task-build"))).toBe(false);
    expect(janela.deposito.has(chaveRascunhoAutorNota("task-build"))).toBe(false);
  });

  /** [BAIXO, rodada 11] o autor também volta no F5 — antes só o texto voltava. */
  it("PRONTO QUANDO: ao remontar a página, texto E autor voltam do rascunho", () => {
    janela.deposito.set(chaveRascunhoNota("task-build"), "meia nota");
    janela.deposito.set(chaveRascunhoAutorNota("task-build"), "Lucas");
    const inst = novaInstancia();
    const painel = montar(inst, NotasPainel, { taskId: "task-build", notas: [], agora: AGORA });
    const filho = componenteFilho(painel, "FormularioNovaNota");
    const instFilho = novaInstancia();
    montar(instFilho, filho.fn, filho.props);
    const depois = montar(instFilho, filho.fn, filho.props);
    expect(porTag(depois, "textarea").props.value).toBe("meia nota");
    expect(porTag(depois, "input").props.value).toBe("Lucas");
  });
});

// ═══════════════════════════════ MUTAÇÃO: a janela de desfazer nunca fecha ═
describe("NotasPainel — a janela de 'Desfazer' fecha sozinha em 10 s", () => {
  /**
   * MUTAÇÃO 10: o timer da janela de desfazer nunca fecha.
   * O que ia para produção: "Desfazer" fica na tela para sempre e ressuscita
   * a nota dez minutos depois, fora de qualquer contexto.
   */
  const NOTA = {
    id: "note-build-1",
    taskId: "task-build",
    texto: "Desempate confirmado.",
    autor: "Lucas",
    createdAt: "2026-07-09T11:00:00.000Z",
  };

  async function excluirComSucesso(): Promise<{ inst: Instancia; props: unknown }> {
    const inst = novaInstancia();
    const props = { taskId: "task-build", notas: [NOTA], agora: AGORA };
    let painel = montar(inst, NotasPainel, props);
    const linha = componenteFilho(painel, "NotaLinha");
    const instLinha = novaInstancia();
    let li = montar(instLinha, linha.fn, linha.props);
    // 1º clique pede confirmação; o painel guarda quem está confirmando.
    disparar(porTag(li, "button"), "onClick");
    painel = montar(inst, NotasPainel, props);
    const linha2 = componenteFilho(painel, "NotaLinha");
    li = montar(instLinha, linha2.fn, linha2.props);
    // 2º clique apaga.
    disparar(porTag(li, "button"), "onClick");
    await assentar();
    return { inst, props };
  }

  it("PRONTO QUANDO: o 'Desfazer' aparece, e some quando o relógio de 10 s vira", async () => {
    const { inst, props } = await excluirComSucesso();
    const comDesfazer = montar(inst, NotasPainel, props as never);
    expect(texto(comDesfazer)).toContain("Desfazer");
    // O relógio existe, e é de 10 s.
    expect(janela.timers.some((t) => t.ms === 10_000 && !t.cancelado)).toBe(true);
    janela.rodarTimer(10_000);
    const depois = montar(inst, NotasPainel, props as never);
    expect(texto(depois)).not.toContain("Desfazer");
  });
});

// ═════════════════════════════════════════ MUTAÇÃO: `peso` mandado sempre ═
describe("RelacoesPainel — o desconto só viaja quando a relação é de sinergia", () => {
  /**
   * MUTAÇÃO 11: mandar `peso` sempre, não só na sinergia.
   * O que ia para produção: TODA relação nova nasce com peso 0,5 em vez de 1
   * — e 1 é o neutro da conta do HIERARQ.
   */
  it("PRONTO QUANDO: um `predecessor` novo não leva `peso` no pedido", () => {
    const inst = novaInstancia();
    const painel = montar(inst, RelacoesPainel, {
      taskId: "task-standup",
      saindo: [],
      entrando: [],
      elosDerivados: [],
      opcoesDestino: [{ id: "task-docs", title: "Escrever documentação", bloqueadaPara: [] }],
      tituloPorId: new Map([["task-docs", "Escrever documentação"]]),
    });
    const filho = componenteFilho(painel, "FormularioNovaAresta");
    const instFilho = novaInstancia();
    let form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "select"), "onChange", { target: { value: "task-docs" } });
    form = montar(instFilho, filho.fn, filho.props);
    disparar(porTag(form, "form"), "onSubmit");
    expect(pedidos()[0]?.op).toBe("relacao_criar");
    expect(Object.keys(pedidos()[0]?.campos ?? {}).sort()).toEqual([
      "destino",
      "origem",
      "tipo",
    ]);
    expect(pedidos()[0]?.campos.tipo).toBe("predecessor");
  });

  /** [MÉDIO A6] e o `<select>` não oferece o que o servidor recusaria. */
  it("PRONTO QUANDO: candidata bloqueada para `predecessor` sai da lista, com o porquê na tela", () => {
    const inst = novaInstancia();
    const painel = montar(inst, RelacoesPainel, {
      taskId: "task-deploy",
      saindo: [],
      entrando: [],
      elosDerivados: [],
      opcoesDestino: [
        { id: "task-build", title: "Implementar motor HIERARQ", bloqueadaPara: ["predecessor"] },
        { id: "task-docs", title: "Escrever documentação", bloqueadaPara: [] },
      ],
      tituloPorId: new Map(),
    });
    const filho = componenteFilho(painel, "FormularioNovaAresta");
    const form = montar(novaInstancia(), filho.fn, filho.props);
    const valores = todasAsTags(form, "option").map((o) => o.props.value);
    expect(valores).toEqual(["", "task-docs"]);
    expect(texto(form)).toContain("1 tarefa está fora desta lista");
  });
});

// ══════════════════════════════════ CRÍTICO, rodada 12: o desfazer da RELAÇÃO ═
describe("RelacoesPainel — 'Desfazer' devolve a relação INTEIRA, nota incluída", () => {
  const ARESTA = {
    id: "edge-docs-correlaciona-build",
    origem: "task-docs",
    destino: "task-build",
    tipo: "correlacao" as const,
    peso: 1,
    nota: "Documentação e motor andam juntos, sem ordem.",
    createdAt: "2026-07-09T10:01:00.000Z",
  };

  function props() {
    return {
      taskId: "task-docs",
      saindo: [ARESTA],
      entrando: [],
      elosDerivados: [],
      opcoesDestino: [{ id: "task-build", title: "Implementar motor", bloqueadaPara: [] }],
      tituloPorId: new Map([["task-build", "Implementar motor"]]),
    };
  }

  /** Exclui de verdade (dois cliques) e devolve o painel com a janela aberta. */
  async function excluir(): Promise<{ inst: Instancia; p: ReturnType<typeof props> }> {
    const inst = novaInstancia();
    const p = props();
    let painel = montar(inst, RelacoesPainel, p);
    const linha = componenteFilho(painel, "LinhaAresta");
    const instLinha = novaInstancia();
    let li = montar(instLinha, linha.fn, linha.props);
    disparar(porTag(li, "button"), "onClick"); // 1º clique: pede confirmação
    painel = montar(inst, RelacoesPainel, p);
    const linha2 = componenteFilho(painel, "LinhaAresta");
    li = montar(instLinha, linha2.fn, linha2.props);
    disparar(porTag(li, "button"), "onClick"); // 2º clique: apaga
    await assentar();
    return { inst, p };
  }

  /**
   * MUTAÇÃO (obrigatória, rodada 12): tirar `nota` da janela de desfazer.
   *
   * O que ia — e foi — para produção: `arestaAdd` lê `nota` de `campos`;
   * ausente, `textoOuNulo` devolve `null`, e a relação renasce SEM a nota.
   * Medido no Chromium em `/tarefa/task-docs`: a aresta voltou com
   * `"nota": null`, e a tela disse "Relação restaurada.".
   */
  it("PRONTO QUANDO: o pedido do desfazer carrega a NOTA original", async () => {
    const { inst, p } = await excluir();
    acao.mockClear();
    const comDesfazer = montar(inst, RelacoesPainel, p);
    const botao = todasAsTags(comDesfazer, "button").find(
      (b) => texto(b.props.children) === "Desfazer",
    );
    disparar(botao ?? { type: "", props: {} }, "onClick");
    await assentar();
    const pedido = pedidos()[0];
    expect(pedido?.op).toBe("relacao_desfazer_exclusao");
    expect(pedido?.campos.nota).toBe(ARESTA.nota);
  });

  /** Os outros campos continuam indo — nenhum deles foi trocado pela nota. */
  it("PRONTO QUANDO: tipo, peso e data original continuam viajando", async () => {
    const { inst, p } = await excluir();
    acao.mockClear();
    const comDesfazer = montar(inst, RelacoesPainel, p);
    const botao = todasAsTags(comDesfazer, "button").find(
      (b) => texto(b.props.children) === "Desfazer",
    );
    disparar(botao ?? { type: "", props: {} }, "onClick");
    await assentar();
    expect(pedidos()[0]?.campos).toMatchObject({
      origem: "task-docs",
      destino: "task-build",
      tipo: "correlacao",
      peso: "1",
      criado_em: ARESTA.createdAt,
    });
  });

  /**
   * O agravante do achado: a nota existia no modelo e não era desenhada em
   * lugar nenhum — então a perda era invisível ao operador.
   */
  it("PRONTO QUANDO: a nota da relação aparece na linha da lista", () => {
    const painel = montar(novaInstancia(), RelacoesPainel, props());
    expect(texto(expandir(painel))).toContain(ARESTA.nota);
  });
});

// ═════════════════════════════════════════ MÉDIO #4, rodada 12: a hidratação ═
describe("NotasPainel — o mesmo painel diz a MESMA coisa em dois instantes", () => {
  /**
   * MUTAÇÃO: `formatRelativeTime(nota.createdAt, agora)` → `formatRelativeTime(nota.createdAt)`.
   *
   * O que ia — e foi — para produção: o servidor renderiza com o relógio dele
   * e o navegador hidrata com o dele. Atravessada uma fronteira de
   * arredondamento ("agora mesmo" → "há 1 min"), o React descarta a árvore do
   * servidor e refaz tudo no cliente. Medido no Chromium, com os scripts
   * atrasados em 20 s: `pageerror` *"Hydration failed because the server
   * rendered text didn't match the client"*, com `+ há 1 min` / `- agora
   * mesmo` no nó `<NotaLinha>`.
   *
   * A propriedade, medida direto: com as MESMAS props, a saída não pode
   * depender de QUANDO se renderiza. É o servidor e o cliente, lado a lado.
   */
  it("PRONTO QUANDO: renderizar 90 s depois, com as mesmas props, dá o mesmo texto", () => {
    const criadaEm = "2026-07-09T12:00:00.000Z";
    const doServidor = Date.parse(criadaEm) + 30_000;
    const props = {
      taskId: "task-docs",
      notas: [{ id: "n1", taskId: "task-docs", texto: "nota", autor: "Claude", createdAt: criadaEm }],
      agora: doServidor,
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(doServidor));
      const noServidor = texto(expandir(montar(novaInstancia(), NotasPainel, props)));
      // O navegador só hidrata 90 s depois (rede ruim, scripts atrasados).
      vi.setSystemTime(new Date(doServidor + 90_000));
      const naHidratacao = texto(expandir(montar(novaInstancia(), NotasPainel, props)));
      expect(naHidratacao).toBe(noServidor);
      // E o texto é o que o relógio do SERVIDOR diz — não "há 1 min".
      expect(noServidor).toContain("agora mesmo");
    } finally {
      vi.useRealTimers();
    }
  });
});

// ══════════════════════════════════ o GÊMEO: o desfazer da NOTA, medido igual ═
describe("NotasPainel — 'Desfazer' devolve texto, autor e data da nota", () => {
  /**
   * [rodada 12] O desfazer da nota já carregava os três campos — e não havia
   * teste disparando o botão para PROVAR. A trava lexical que existia
   * (`tarefa-escritas-varredura.test.ts`) casava a expressão exata do fonte,
   * que é justamente a classe de trava que esta rodada derrubou. Agora os
   * dois desfazeres desta página são medidos pelo PEDIDO que sai.
   */
  const NOTA = {
    id: "n1",
    taskId: "task-build",
    texto: "a nota que volta inteira",
    autor: "Claude",
    createdAt: "2026-07-09T11:00:00.000Z",
  };

  it("PRONTO QUANDO: o pedido do desfazer traz texto, autor e criado_em", async () => {
    const inst = novaInstancia();
    const props = { taskId: "task-build", notas: [NOTA], agora: AGORA };
    let painel = montar(inst, NotasPainel, props);
    const linha = componenteFilho(painel, "NotaLinha");
    const instLinha = novaInstancia();
    let li = montar(instLinha, linha.fn, linha.props);
    disparar(porTag(li, "button"), "onClick");
    painel = montar(inst, NotasPainel, props);
    const linha2 = componenteFilho(painel, "NotaLinha");
    li = montar(instLinha, linha2.fn, linha2.props);
    disparar(porTag(li, "button"), "onClick");
    await assentar();
    acao.mockClear();

    const comDesfazer = montar(inst, NotasPainel, props);
    const botao = todasAsTags(comDesfazer, "button").find(
      (b) => texto(b.props.children) === "Desfazer",
    );
    disparar(botao ?? { type: "", props: {} }, "onClick");
    await assentar();
    expect(pedidos()[0]?.op).toBe("nota_desfazer");
    expect(pedidos()[0]?.campos).toMatchObject({
      texto: NOTA.texto,
      autor: NOTA.autor,
      criado_em: NOTA.createdAt,
    });
  });
});
