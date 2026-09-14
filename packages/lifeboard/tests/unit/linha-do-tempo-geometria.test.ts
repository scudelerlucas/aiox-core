import { describe, expect, it } from "vitest";

import {
  clampScroll,
  fatorDeOverflow,
  formatarFator,
  posicaoDoBadge,
} from "@/core/timeline/geometria-painel";
import {
  depoisDoFimDesenhado,
  diasDesenhados,
  fimDesenhadoIso,
  larguraAproximada,
  PADDING_CHIP_PX,
  PADDING_ROTULO_PX,
  PX_POR_CHAR,
  TETO_DIAS_ESCALA,
  gerarEscalaEixo,
} from "@/core/timeline/eixo-rotulos";

/**
 * OS-LIFEBOARD · P5 — rodada 6 do crítico hostil. Cada `describe` abaixo é a
 * régua de UM achado, escrita como MUTAÇÃO: se alguém desfizer a correção (o
 * destino não clampado, a comparação com `maxIso`, o padding do chip fora da
 * constante, o badge sem limite), o teste fica vermelho.
 */

describe("clampScroll — o valor que o navegador realmente assume (achado ALTO A1)", () => {
  it("destino MAIOR que o máximo vira o máximo (era daqui que vinham os 329,6px de desalinho)", () => {
    // 390 → 1024: o conteúdo continua com 3000px, mas o painel passou a
    // mostrar 1024 — o máximo caiu de 2610 para 1976 e o destino antigo
    // (2305,6) virou impossível. O navegador guarda 1976; quem sincronizava
    // o cabeçalho com o destino ficava 329,6px adiantado.
    expect(clampScroll(2305.6, 3000, 1024)).toBe(1976);
    expect(2305.6 - clampScroll(2305.6, 3000, 1024)).toBeCloseTo(329.6, 1);
  });

  it("destino NEGATIVO vira 0", () => {
    expect(clampScroll(-500, 3000, 1024)).toBe(0);
  });

  it("conteúdo que cabe inteiro só admite 0", () => {
    expect(clampScroll(900, 800, 1024)).toBe(0);
  });

  it("destino já dentro da faixa passa intacto; valor podre (NaN) vira 0", () => {
    expect(clampScroll(1200, 3000, 1024)).toBe(1200);
    expect(clampScroll(Number.NaN, 3000, 1024)).toBe(0);
  });
});

describe("fatorDeOverflow — quantas telas de rolagem (achado MÉDIO A4)", () => {
  it("o caso medido pelo crítico: 4410px de janela num painel de 390px = 11,3×", () => {
    expect(formatarFator(fatorDeOverflow(4410, 390))).toBe("11,3");
  });

  it("conteúdo que cabe = 1× (nunca menos), painel ainda não medido = 1×", () => {
    expect(fatorDeOverflow(300, 1024)).toBe(1);
    expect(fatorDeOverflow(4410, 0)).toBe(1);
  });
});

describe("posicaoDoBadge — o badge nunca estica o eixo (achado BAIXO A6)", () => {
  it("badge que começaria depois do fim do eixo é preso ao último lugar que cabe", () => {
    // "sem data" ao fim de uma barra que termina no último pixel: antes o
    // `scrollWidth` do painel crescia 44px além de `totalWidth`.
    expect(posicaoDoBadge(2520, 44, 2520)).toBe(2476);
    expect(posicaoDoBadge(2476, 44, 2520) + 44).toBeLessThanOrEqual(2520);
  });

  it("badge que cabe não é movido; x negativo vira 0; badge maior que o eixo vai para 0", () => {
    expect(posicaoDoBadge(100, 44, 2520)).toBe(100);
    expect(posicaoDoBadge(-20, 44, 2520)).toBe(0);
    expect(posicaoDoBadge(10, 900, 400)).toBe(0);
  });
});

describe("fim desenhado × maxIso — o corte mudo do teto (achado ALTO A3)", () => {
  const minIso = "2026-06-29";
  // 479 dias de janela pedida: o teto desenha só 420.
  const maxIso = "2027-10-21";

  it("o teto corta: dias desenhados = TETO, e o fim desenhado é ANTES de maxIso", () => {
    expect(diasDesenhados(minIso, maxIso)).toBe(TETO_DIAS_ESCALA);
    const fim = fimDesenhadoIso(minIso, maxIso);
    expect(fim).toBe("2027-08-23");
    expect(Date.parse(fim)).toBeLessThan(Date.parse(maxIso));
  });

  it("MUTAÇÃO: uma data ENTRE o fim desenhado e maxIso está fora da janela (comparar com maxIso diz que não)", () => {
    const fim = fimDesenhadoIso(minIso, maxIso);
    const entreOsDois = "2027-09-30"; // depois de 2027-08-23, antes de 2027-10-21
    expect(depoisDoFimDesenhado(entreOsDois, fim)).toBe(true);
    // A régua antiga (contra `maxIso`) devolvia `false` para exatamente esta
    // data — os 50 dias que a barra escondia com a ponta arredondada.
    expect(Date.parse(entreOsDois) > Date.parse(maxIso)).toBe(false);
  });

  it("sem teto (janela curta), fim desenhado == maxIso e nada fica fora", () => {
    const fim = fimDesenhadoIso("2026-09-01", "2026-10-01");
    expect(fim).toBe("2026-10-01");
    expect(depoisDoFimDesenhado("2026-09-30", fim)).toBe(false);
  });

  it("a escala do eixo usa o MESMO número de dias (uma fonte só)", () => {
    const escala = gerarEscalaEixo({ minIso, maxIso, pxPorDia: 6, hojeIso: "2026-09-13" });
    const ultimo = Math.max(...escala.rotulos.map((r) => r.x));
    expect(ultimo).toBeLessThanOrEqual(diasDesenhados(minIso, maxIso) * 6);
  });
});

describe("larguraAproximada — superestima de verdade agora (achado BAIXO A5)", () => {
  /** Limite superior REAL medido pelo crítico no navegador: 7,84px/caractere + 12px de padding. */
  const realMedido = (texto: string): number => 7.84 * texto.length + 12;

  it("o caso que quebrou: 'ago/2026' estimava 70 e media 74,72", () => {
    expect(realMedido("ago/2026")).toBeCloseTo(74.72, 2);
    expect(larguraAproximada("ago/2026")).toBeGreaterThanOrEqual(realMedido("ago/2026"));
  });

  it("o padding do chip e o da estimativa são a MESMA constante", () => {
    expect(PADDING_CHIP_PX).toBe(PADDING_ROTULO_PX);
    expect(PX_POR_CHAR).toBeGreaterThanOrEqual(7.84);
  });

  it("todo rótulo de um horizonte de 400 dias, nas 5 densidades, é superestimado", () => {
    const textos = new Set<string>();
    for (const pxPorDia of [6, 16, 24, 46, 64]) {
      const escala = gerarEscalaEixo({
        minIso: "2026-09-01",
        maxIso: "2027-10-06",
        pxPorDia,
        hojeIso: "2026-09-13",
      });
      for (const r of [...escala.rotulos, ...escala.rotulosSuperiores]) textos.add(r.label);
    }
    expect(textos.size).toBeGreaterThan(5);
    for (const texto of textos) {
      expect(larguraAproximada(texto)).toBeGreaterThanOrEqual(realMedido(texto));
    }
  });
});
