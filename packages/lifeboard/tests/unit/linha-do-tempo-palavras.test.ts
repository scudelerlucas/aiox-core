import { describe, expect, it } from "vitest";

import {
  estadoDoAssunto,
  rotuloAcessivelDoAssunto,
  textoDoPeriodoDoAssunto,
} from "@/core/timeline/assunto-em-palavras";
import {
  ancoraDaJanela,
  clausulaForaDaJanela,
  fraseForaDaJanela,
  glifoDoLado,
  textoVisivelForaDaJanela,
} from "@/core/timeline/fora-da-janela-em-palavras";
import {
  desenhaBarraDeDuracao,
  formatarDias,
  motivoForaDaGrade,
  type PeriodoDeTarefa,
} from "@/core/timeline/periodo-da-tarefa";

/**
 * OS-LIFEBOARD · P5 — rodada 11. As duas leis novas, medidas isoladas.
 *
 * MÉDIO 3: quem desenha barra e quem sai da grade.
 * MÉDIO 4: o que um assunto diz em palavras (o único canal que chega a quem
 * não vê a barra — as 28 barras do canvas são `aria-hidden`).
 */

function tarefa(p: Partial<PeriodoDeTarefa> = {}): PeriodoDeTarefa {
  return {
    inicio: "2026-09-21",
    fim: "2026-09-24",
    semDuracao: false,
    inicioEstimado: false,
    estimativaDias: 3,
    foraDoCpm: false,
    semBarra: false,
    pontoConcluidoEm: null,
    ...p,
  };
}

const br = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

describe("MÉDIO 3 · barra só com início E duração", () => {
  it("com as duas datas: desenha, e não há motivo de estar fora", () => {
    expect(desenhaBarraDeDuracao(tarefa())).toBe(true);
    expect(motivoForaDaGrade(tarefa())).toBeNull();
  });

  it("sem duração: não desenha, e o motivo é dito", () => {
    const r = tarefa({ semDuracao: true, estimativaDias: null });
    expect(desenhaBarraDeDuracao(r)).toBe(false);
    expect(motivoForaDaGrade(r)).toBe("sem duração");
  });

  it("sem início: não desenha, e o motivo é dito", () => {
    const r = tarefa({ inicioEstimado: true });
    expect(desenhaBarraDeDuracao(r)).toBe(false);
    expect(motivoForaDaGrade(r)).toBe("sem início");
  });

  it("sem os dois: não desenha, e o motivo nomeia os dois", () => {
    const r = tarefa({ semDuracao: true, inicioEstimado: true, estimativaDias: null });
    expect(desenhaBarraDeDuracao(r)).toBe(false);
    expect(motivoForaDaGrade(r)).toBe("sem início nem duração");
  });

  it("concluída sem barra: nem barra nem motivo — o desenho dela é o PONTO, com data real", () => {
    const r = tarefa({ semBarra: true, pontoConcluidoEm: "2026-07-08" });
    expect(desenhaBarraDeDuracao(r)).toBe(false);
    expect(motivoForaDaGrade(r)).toBeNull();
  });

  it("uma tarefa que desenha barra NUNCA tem motivo de estar fora, e vice-versa", () => {
    for (const semDuracao of [false, true]) {
      for (const inicioEstimado of [false, true]) {
        for (const semBarra of [false, true]) {
          const r = tarefa({ semDuracao, inicioEstimado, semBarra });
          if (desenhaBarraDeDuracao(r)) expect(motivoForaDaGrade(r)).toBeNull();
          if (motivoForaDaGrade(r) !== null) expect(desenhaBarraDeDuracao(r)).toBe(false);
        }
      }
    }
  });
});

describe("MÉDIO 4 · o assunto diz estado e período em palavras", () => {
  const base = {
    titulo: "Custo por sessão no painel",
    repo: "org/repo",
    inicio: "2026-09-15",
    fim: "2026-09-21",
    aberto: true,
    estado: "aberto",
    dataInvalida: false,
    datasInconsistentes: false,
    marco: false,
  };

  it("aberto: 'em aberto' no lugar de uma data de fim que não existe", () => {
    expect(estadoDoAssunto(base)).toBe("aberto");
    expect(textoDoPeriodoDoAssunto(base, br)).toBe("15/09/2026 → em aberto");
  });

  it("mergeado e fechado têm nomes diferentes, e nenhum deles é uma cor", () => {
    expect(estadoDoAssunto({ ...base, estado: "mergeado" })).toBe("mergeado");
    expect(estadoDoAssunto({ ...base, estado: "fechado" })).toBe("fechado sem merge");
  });

  it("os três estados de dado podre têm frase própria — nunca uma data inventada", () => {
    expect(textoDoPeriodoDoAssunto({ ...base, dataInvalida: true }, br)).toBe("data inválida");
    expect(textoDoPeriodoDoAssunto({ ...base, datasInconsistentes: true }, br)).toBe(
      "datas inconsistentes",
    );
    expect(textoDoPeriodoDoAssunto({ ...base, marco: true, aberto: false }, br)).toBe(
      "15/09/2026 (mesmo dia)",
    );
  });

  it("o rótulo acessível separa mergeado, aberto, data podre e datas invertidas", () => {
    const frases = new Set(
      [
        { ...base },
        { ...base, estado: "mergeado", aberto: false, fim: "2026-09-18" },
        { ...base, estado: "fechado", aberto: false, fim: "2026-09-18" },
        { ...base, dataInvalida: true },
        { ...base, datasInconsistentes: true },
      ].map((r) => rotuloAcessivelDoAssunto(r, br)),
    );
    // Cinco estados de dado, cinco frases DIFERENTES — era o defeito: as
    // cinco chegavam idênticas a um leitor de tela.
    expect(frases.size).toBe(5);
    for (const f of frases) expect(f.startsWith(`${base.titulo} — assunto em org/repo; `)).toBe(true);
  });
});


/**
 * Rodada 12 (achado BAIXO 1): `formatarDias` tratava todo número ≤ 1 como
 * singular, e imprimia "0 dia" e "-3 dia". Em português o singular é de UM,
 * não de "até um". Não há caminho de dado que chegue aqui com zero ou
 * negativo hoje (o construtor de linhas só entrega estimativa > 0) — é
 * defesa de contrato de uma função exportada, e é por isso que a régua é
 * este teste e não a tela.
 */
describe("BAIXO 1 · formatarDias: singular só para UM dia", () => {
  it.each([
    [1, "1 dia"],
    [0.5, "0,5 dia"],
    [0.25, "0,25 dia"],
  ])("%s → %s (singular: positivo e ≤ 1)", (entrada, esperado) => {
    expect(formatarDias(entrada)).toBe(esperado);
  });

  it.each([
    [0, "0 dias"],
    [-3, "-3 dias"],
    [-0.5, "-0,5 dias"],
    [1.5, "1,5 dias"],
    [3, "3 dias"],
  ])("%s → %s (plural: zero, negativo e > 1)", (entrada, esperado) => {
    expect(formatarDias(entrada)).toBe(esperado);
  });

  it("número não finito não vira texto com número nenhum", () => {
    expect(formatarDias(Number.NaN)).toBe("duração inválida");
    expect(formatarDias(Number.POSITIVE_INFINITY)).toBe("duração inválida");
  });
});

/**
 * Rodada 12 (achado ALTO 3): o item que o canvas se RECUSA a posicionar (cai
 * fora da janela desenhada) recebia um "◀" de 9 px, `aria-hidden="true"`, e a
 * data só no `title` — e o próprio repositório já mediu, na rodada 7, que
 * `title` não existe no toque. Estas são as três frases que fecham os três
 * canais (toque · leitor de tela · hover), cada uma com o seu próprio dever.
 */
describe("ALTO 3 · o item fora da janela nunca é uma linha muda", () => {
  it("a âncora de uma tarefa com barra é o início", () => {
    expect(
      ancoraDaJanela({
        semBarra: false,
        pontoConcluidoEm: null,
        desenhaBarra: true,
        inicio: "2026-08-03",
      }),
    ).toEqual({ iso: "2026-08-03", concluida: false });
  });

  it("a âncora de uma tarefa CONCLUÍDA é o ponto de conclusão — o caso que não dizia data nenhuma", () => {
    expect(
      ancoraDaJanela({
        semBarra: true,
        pontoConcluidoEm: "2026-07-08",
        desenhaBarra: false,
        inicio: "2026-09-21",
      }),
    ).toEqual({ iso: "2026-07-08", concluida: true });
  });

  it("sem desenho posicionado no eixo não há âncora — esse caso tem outro dono (motivoForaDaGrade)", () => {
    expect(
      ancoraDaJanela({
        semBarra: false,
        pontoConcluidoEm: null,
        desenhaBarra: false,
        inicio: "2026-09-21",
      }),
    ).toBeNull();
    /* Concluída sem data válida de conclusão: nada a ancorar, e nada a mentir. */
    expect(
      ancoraDaJanela({
        semBarra: true,
        pontoConcluidoEm: null,
        desenhaBarra: false,
        inicio: "2026-09-21",
      }),
    ).toBeNull();
  });

  it("o texto VISÍVEL leva o glifo, o verbo certo e a data COM ANO", () => {
    expect(textoVisivelForaDaJanela("antes", "2026-08-03", false, br)).toBe("◀ começa 03/08/2026");
    expect(textoVisivelForaDaJanela("depois", "2026-11-30", false, br)).toBe("▶ começa 30/11/2026");
    /* Concluída troca o verbo: a âncora é a data de conclusão, não um começo. */
    expect(textoVisivelForaDaJanela("antes", "2026-07-08", true, br)).toBe(
      "◀ concluída 08/07/2026",
    );
  });

  it("o glifo é o MESMO que o canvas desenha — um símbolo, um sentido", () => {
    expect(glifoDoLado("antes")).toBe("◀");
    expect(glifoDoLado("depois")).toBe("▶");
  });

  it("a cláusula não repete o período; a frase inteira o inclui uma vez", () => {
    expect(clausulaForaDaJanela("antes")).toBe(
      "fora da janela do tempo (antes do início da janela desenhada)",
    );
    expect(clausulaForaDaJanela("depois")).toBe(
      "fora da janela do tempo (depois do fim da janela desenhada)",
    );
    const frase = fraseForaDaJanela("antes", "03/08/2026 → 08/08/2026");
    expect(frase).toBe(
      "03/08/2026 → 08/08/2026 — fora da janela do tempo (antes do início da janela desenhada)",
    );
    /* A data não pode sair daqui duas vezes (era o defeito da 1ª tentativa). */
    expect(frase.match(/03\/08\/2026/g)).toHaveLength(1);
  });
});
