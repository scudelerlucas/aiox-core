import { describe, expect, it } from "vitest";

import {
  estadoDoAssunto,
  rotuloAcessivelDoAssunto,
  textoDoPeriodoDoAssunto,
} from "@/core/timeline/assunto-em-palavras";
import {
  desenhaBarraDeDuracao,
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
