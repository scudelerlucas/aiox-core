import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  componenteFilho,
  disparar,
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

/** Deixa as promessas pendentes do despacho resolverem. */
async function assentar(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

/** O contrato do campo numérico: o texto EXATO chega ao componente. */
function digitar(props: Record<string, unknown>, texto: string): void {
  (props.aoMudar as (t: string) => void)(texto);
}

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

// ═══════════════════════════════════════ MUTAÇÃO: rascunho não é limpo ═
describe("NotasPainel — salvar a nota apaga o rascunho", () => {
  /**
   * MUTAÇÃO 4: remover `limparRascunhoNota(taskId)` do sucesso.
   * O que ia para produção: a nota salva VOLTA no rascunho na próxima visita,
   * e o operador salva duplicado.
   */
  it("PRONTO QUANDO: depois do sucesso, o depósito não guarda mais o rascunho", async () => {
    const inst = novaInstancia();
    const props = { taskId: "task-build", notas: [] };
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
    const painel = montar(inst, NotasPainel, { taskId: "task-build", notas: [] });
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
    const props = { taskId: "task-build", notas: [NOTA] };
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
