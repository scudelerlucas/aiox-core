import { describe, expect, it } from "vitest";

import { alvoAposExclusaoDeNota, focar, focarComAlternativa } from "@/components/task/foco";

/**
 * OS-LIFEBOARD · P6 — achado MÉDIO #2 (rodada 5): o foco caía no `<body>` em
 * 5 de 5 operações, e a exclusão de nota é o caso em que não basta parar de
 * usar `disabled`: o botão apertado SOME junto com a linha. Alguém tem de
 * decidir para onde o foco vai ANTES disso — e essa decisão é esta função.
 *
 * Regra do operador: a nota SEGUINTE; quando a excluída era a última, a
 * textarea da nota nova (o lugar de onde o trabalho continua).
 *
 * Reverter para ver falhar: em `src/components/task/foco.ts`, trocar o corpo
 * de `alvoAposExclusaoDeNota` por `return { tipo: "textarea" }` — os dois
 * primeiros testes quebram.
 */
describe("alvoAposExclusaoDeNota (achado MÉDIO #2, rodada 5)", () => {
  it("PRONTO QUANDO: excluir a 1ª de 3 manda o foco para a 2ª (índice 1)", () => {
    expect(alvoAposExclusaoDeNota(0, 3)).toEqual({ tipo: "nota", indice: 1 });
  });

  it("excluir a do meio manda para a seguinte", () => {
    expect(alvoAposExclusaoDeNota(1, 3)).toEqual({ tipo: "nota", indice: 2 });
  });

  it("PRONTO QUANDO: excluir a ÚLTIMA manda o foco para a textarea da nota nova", () => {
    expect(alvoAposExclusaoDeNota(2, 3)).toEqual({ tipo: "textarea" });
  });

  it("excluir a única nota da lista manda para a textarea (não há seguinte)", () => {
    expect(alvoAposExclusaoDeNota(0, 1)).toEqual({ tipo: "textarea" });
  });

  it("índice fora da lista nunca devolve um alvo inexistente — cai na textarea", () => {
    expect(alvoAposExclusaoDeNota(7, 3)).toEqual({ tipo: "textarea" });
    expect(alvoAposExclusaoDeNota(-1, 0)).toEqual({ tipo: "textarea" });
  });
});

describe("focar — nunca estoura com um nó que já saiu da árvore", () => {
  it("PRONTO QUANDO: null/undefined não lançam (o nó pode ter sumido entre o clique e o refresh)", () => {
    expect(() => focar(null)).not.toThrow();
    expect(() => focar(undefined)).not.toThrow();
  });

  it("chama `focus()` do alvo quando ele existe", () => {
    let chamou = 0;
    focar({ focus: () => (chamou += 1) });
    expect(chamou).toBe(1);
  });
});

/**
 * [MÉDIO #2, rodada 5] O alvo lógico do foco depois de "Desfazer" é o botão
 * "Adicionar relação" — que, nesse exato instante, está `disabled` (nenhum
 * destino escolhido; é a regressão da rodada 4 que não pode voltar). Elemento
 * `disabled` não recebe foco: `.focus()` nele é um no-op, o foco fica no
 * "Desfazer" e o "Desfazer" some no instante seguinte → `<body>`. Medido
 * assim, no navegador, antes desta função existir.
 *
 * Reverter para ver falhar: em `relacoes-painel.tsx`, trocar
 * `focarComAlternativa(botaoAdicionarRef.current, selectDestinoRef.current)`
 * por `focar(botaoAdicionarRef.current)` — a medição no navegador volta a
 * `BODY` (e o 2º teste deste bloco quebra).
 */
describe("focarComAlternativa (achado MÉDIO #2, rodada 5)", () => {
  function elementoFalso(nome: string, focavel: boolean, doc: { activeElement: unknown }) {
    const el = {
      nome,
      focus: () => {
        if (focavel) doc.activeElement = el;
      },
    };
    return el;
  }

  it("PRONTO QUANDO: o alvo aceita foco → é ele que fica focado (a alternativa nem é tentada)", () => {
    const doc = { activeElement: null as unknown };
    const alvo = elementoFalso("botão Adicionar relação", true, doc);
    const alternativa = elementoFalso("select Destino", true, doc);
    focarComAlternativa(
      alvo as unknown as HTMLElement,
      alternativa as unknown as HTMLElement,
      doc as { activeElement: Element | null },
    );
    expect((doc.activeElement as { nome: string }).nome).toBe("botão Adicionar relação");
  });

  it("PRONTO QUANDO: o alvo está `disabled` (o foco não muda) → a alternativa recebe o foco, nunca o body", () => {
    const doc = { activeElement: { nome: "botão Desfazer (que vai sumir)" } as unknown };
    const alvo = elementoFalso("botão Adicionar relação", false, doc); // disabled
    const alternativa = elementoFalso("select Destino", true, doc);
    focarComAlternativa(
      alvo as unknown as HTMLElement,
      alternativa as unknown as HTMLElement,
      doc as { activeElement: Element | null },
    );
    expect((doc.activeElement as { nome: string }).nome).toBe("select Destino");
  });

  it("alvo inexistente também cai na alternativa", () => {
    const doc = { activeElement: null as unknown };
    const alternativa = elementoFalso("select Destino", true, doc);
    focarComAlternativa(null, alternativa as unknown as HTMLElement, doc as { activeElement: Element | null });
    expect((doc.activeElement as { nome: string }).nome).toBe("select Destino");
  });
});
