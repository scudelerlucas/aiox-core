import { describe, expect, it } from "vitest";

import {
  ANUNCIO_DE_CONFIRMACAO,
  ANUNCIO_DE_SUCESSO,
  anuncioComDesfazerPerdido,
  MENSAGEM_DESFAZER_PERDIDO,
  MENSAGEM_INVALIDO,
  mensagemDoCampo,
  transicaoDeConfirmacao,
} from "@/components/task/escrita";
import { dataCurtaNoFusoDoOperador, dataOriginalValidaOuErro } from "@/lib/fuso";

/**
 * OS-LIFEBOARD · P6 — rodada 7 do crítico hostil.
 *
 * ALTO #2: "o erro velho do servidor engole a recusa nova", nos 4
 * formulários (`notas-painel.tsx:314`, `subtarefas-painel.tsx:135`,
 * `relacoes-painel.tsx:565`, `atomos-form.tsx:263` — todos
 * `<CampoErro mensagem={estado.erro ?? aviso} />`). `estado.erro` só morria
 * quando a ação SEGUINTE resolvia, e `aoDigitar` limpava `aviso`, não
 * `estado.erro`.
 *
 * A sequência MEDIDA pelo crítico, reproduzida abaixo passo a passo contra a
 * função pura que agora decide o que aparece.
 */

const ERRO_10K = "A nota não pode passar de 10000 caracteres.";
const RECUSA_VAZIA = MENSAGEM_INVALIDO.nota_criar ?? "";

describe("mensagemDoCampo — a recusa nova vence o erro velho (ALTO #2)", () => {
  it("PRONTO QUANDO: a sequência exata do crítico, na nota", () => {
    // 1. nota de 10.001 caracteres → o servidor recusa, e a tela diz isso.
    let visivel = mensagemDoCampo({
      aviso: undefined,
      erroDoServidor: ERRO_10K,
      descartado: false,
    });
    expect(visivel).toBe(ERRO_10K);

    // 2. esvaziar o campo — mexer no campo DESCARTA o erro do servidor.
    visivel = mensagemDoCampo({ aviso: undefined, erroDoServidor: ERRO_10K, descartado: true });
    expect(visivel).toBeUndefined();

    // 3. clicar com o campo vazio → a recusa LOCAL, não a frase dos 10.000.
    //    (era aqui que a tela continuava dizendo "não pode passar de 10000".)
    visivel = mensagemDoCampo({
      aviso: RECUSA_VAZIA,
      erroDoServidor: ERRO_10K,
      descartado: true,
    });
    expect(visivel).toBe(RECUSA_VAZIA);
    expect(visivel).not.toBe(ERRO_10K);

    // 4. reescrever com 23 caracteres → nenhuma frase na tela.
    //    (era aqui que a frase dos 10.000 CONTINUAVA.)
    visivel = mensagemDoCampo({ aviso: undefined, erroDoServidor: ERRO_10K, descartado: true });
    expect(visivel).toBeUndefined();
  });

  it("PRONTO QUANDO: a recusa local vence o erro do servidor mesmo SEM descarte", () => {
    // A lei 1 é independente da lei 2: mesmo que o erro do servidor ainda
    // esteja "vivo", a recusa de agora é sobre o que o operador acabou de
    // fazer — e é ela que aparece.
    expect(
      mensagemDoCampo({ aviso: RECUSA_VAZIA, erroDoServidor: ERRO_10K, descartado: false }),
    ).toBe(RECUSA_VAZIA);
  });

  it("PRONTO QUANDO: um erro NOVO do servidor aparece mesmo depois de um descarte", () => {
    // O descarte é da identidade do estado ANTIGO — o hook (`useCampoDeErro`)
    // guarda o objeto, não um booleano. Aqui, o novo erro com `descartado:
    // false` prova que a tela volta a falar.
    expect(
      mensagemDoCampo({ aviso: undefined, erroDoServidor: "Tarefa não identificada.", descartado: false }),
    ).toBe("Tarefa não identificada.");
  });

  it("sem nada a dizer, o campo não diz nada (string vazia não vira frase)", () => {
    expect(mensagemDoCampo({ descartado: false })).toBeUndefined();
    expect(mensagemDoCampo({ aviso: "", erroDoServidor: "", descartado: false })).toBeUndefined();
  });

  it("os 4 formulários de criação têm a frase de recusa que o botão agora descreve", () => {
    for (const op of ["nota_criar", "subtarefa_criar", "relacao_criar", "atomos_salvar"] as const) {
      expect(MENSAGEM_INVALIDO[op], op).toBeDefined();
      expect((MENSAGEM_INVALIDO[op] ?? "").endsWith("."), op).toBe(true);
    }
  });
});

describe("transicaoDeConfirmacao — as DUAS transições falam (MÉDIO #5)", () => {
  it("PRONTO QUANDO: entrar em confirmação anuncia", () => {
    const t = transicaoDeConfirmacao("nota_excluir", null, "note-1");
    expect(t.confirmandoId).toBe("note-1");
    expect(t.anuncio).toBe(ANUNCIO_DE_CONFIRMACAO.nota_excluir.entrou);
  });

  it("PRONTO QUANDO: sair da confirmação (Escape, foco fora, exclusão feita) anuncia", () => {
    const t = transicaoDeConfirmacao("nota_excluir", "note-1", null);
    expect(t.confirmandoId).toBeNull();
    expect(t.anuncio).toBe(ANUNCIO_DE_CONFIRMACAO.nota_excluir.saiu);
  });

  it("PRONTO QUANDO: outra linha confirmando tira a anterior — e as duas falam", () => {
    const t = transicaoDeConfirmacao("relacao_excluir", "edge-1", "edge-2");
    expect(t.confirmandoId).toBe("edge-2");
    // UMA frase, não duas — dois `mostrar()` no mesmo manipulador viram um
    // render só e a primeira nunca chegaria ao DOM (medido no navegador).
    expect(t.anuncio).toBe(
      `${ANUNCIO_DE_CONFIRMACAO.relacao_excluir.saiu} ${ANUNCIO_DE_CONFIRMACAO.relacao_excluir.entrou}`,
    );
  });

  it("repetir o mesmo pedido não é transição: não anuncia, não re-arma", () => {
    // O defeito medido: "um 2º Enter depois da janela apenas re-arma, em
    // silêncio". Não há janela para expirar, e o mesmo id é inerte.
    expect(transicaoDeConfirmacao("nota_excluir", "note-1", "note-1").anuncio).toBeNull();
    expect(transicaoDeConfirmacao("nota_excluir", null, null).anuncio).toBeNull();
  });

  it("as quatro frases são português inteiro, e dizem O QUE continua", () => {
    for (const op of ["nota_excluir", "relacao_excluir"] as const) {
      expect(ANUNCIO_DE_CONFIRMACAO[op].entrou).toContain("Confirme");
      expect(ANUNCIO_DE_CONFIRMACAO[op].saiu).toContain("cancelada");
      expect(ANUNCIO_DE_CONFIRMACAO[op].saiu).toContain("continua");
    }
  });
});

describe("desfazer substituído fala (BAIXO #8)", () => {
  it("PRONTO QUANDO: a frase entra JUNTO com o sucesso, numa string só", () => {
    expect(MENSAGEM_DESFAZER_PERDIDO).toBe("A exclusão anterior não pode mais ser desfeita.");
    // Com desfazer pendente atropelado: as duas coisas numa frase.
    expect(anuncioComDesfazerPerdido("nota_excluir", true)).toBe(
      `${MENSAGEM_DESFAZER_PERDIDO} ${ANUNCIO_DE_SUCESSO.nota_excluir}`,
    );
    // Sem nada a atropelar: o anúncio de sempre, sem ruído.
    expect(anuncioComDesfazerPerdido("nota_excluir", false)).toBe(ANUNCIO_DE_SUCESSO.nota_excluir);
    expect(anuncioComDesfazerPerdido("relacao_criar", true)).toContain(MENSAGEM_DESFAZER_PERDIDO);
  });
});

describe("a data original do desfazer (MÉDIO #4)", () => {
  it("PRONTO QUANDO: uma data de 67 dias atrás atravessa intacta", () => {
    const agora = Date.parse("2026-09-14T12:00:00.000Z");
    const ha67dias = new Date(agora - 67 * 24 * 3600 * 1000).toISOString();
    const r = dataOriginalValidaOuErro(ha67dias, agora);
    expect("iso" in r && r.iso).toBe(ha67dias);
  });

  it("data inválida e data no futuro são recusadas em português", () => {
    const agora = Date.parse("2026-09-14T12:00:00.000Z");
    expect(dataOriginalValidaOuErro("ontem de manhã", agora)).toEqual({
      erro: "A data original não é uma data válida.",
    });
    expect(dataOriginalValidaOuErro("2030-01-01T00:00:00.000Z", agora)).toEqual({
      erro: "A data original não pode estar no futuro.",
    });
  });

  it("a data curta do rótulo é dd/mm/aaaa no fuso do operador", () => {
    // 12/07/2026 às 02:00 UTC ainda é 11/07 em São Paulo (UTC-3) — o fuso
    // importa justamente aqui, onde a data VIRA o nome de um botão.
    expect(dataCurtaNoFusoDoOperador("2026-07-12T15:00:00.000Z")).toBe("12/07/2026");
    expect(dataCurtaNoFusoDoOperador("2026-07-12T02:00:00.000Z")).toBe("11/07/2026");
    expect(dataCurtaNoFusoDoOperador("não é data")).toBeNull();
  });
});
