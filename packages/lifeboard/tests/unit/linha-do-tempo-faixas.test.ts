import { describe, expect, it } from "vitest";

import {
  avisoDeItensFora,
  cabeInteiroNaJanela,
  distanciaMinima,
  faixaDoEixo,
  gerarEscalaEixo,
  larguraAproximada,
  rotulosNaJanela,
  rotuloDoPeriodoSuperior,
  tetoMordeu,
  TETO_DIAS_ESCALA,
} from "@/core/timeline/eixo-rotulos";
import { avisoDeOverflow } from "@/core/timeline/geometria-painel";

/**
 * OS-LIFEBOARD · P5 — rodada 7. As três decisões do eixo, cada uma contra o
 * número que o crítico hostil mediu na rodada 6:
 *
 * D3 — a borda DIREITA cortava rótulos pela metade em 28 de 60 combos
 *      ("nov/2026" com 1px visível, "28/09/2026" com 4px, "jan/2027" com 6);
 *      com o scroll no máximo o cortado era SEMPRE o último rótulo do eixo,
 *      isto é, a data em que a meta termina. A guarda existia só à esquerda.
 * D4 — régua de 2 níveis e mês fixado só existiam acima de 24px/dia: a 390px,
 *      janela de 60 d, "auto" (6px/dia), a tela tinha faixa ÚNICA, 2 rótulos
 *      visíveis, 0 faixa de mês e 0 mês grudado; a 400 d, 1 rótulo em 218px.
 * D6 — "Mês/Trimestre mostra o histórico" era conselho ERRADO quando quem
 *      corta é o teto de 420 dias (seguir o conselho PIORAVA: 5 → 6 itens fora
 *      e o fim recuando de 29/10/2027 para 09/01/2027).
 */

const MS_POR_DIA = 86_400_000;
function somaDiasIso(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

// ─── D3: a mesma lei nos dois lados ──────────────────────────────────────────

describe("D3 — ou o rótulo cabe inteiro na janela visível, ou não é desenhado", () => {
  const janela = { scrollLeft: 1000, larguraVisivel: 390 };

  it("o caso medido: 'nov/2026' com 1px dentro da janela NÃO é desenhado", () => {
    // A rodada 6 desenhava tudo cujo `x >= scrollLeft` — inclusive um rótulo
    // que começa 1px antes da borda direita e continua fora da tela.
    const quaseFora = { x: janela.scrollLeft + janela.larguraVisivel - 1, label: "nov/2026" };
    expect(quaseFora.x).toBeGreaterThanOrEqual(janela.scrollLeft); // a régua antiga aprovava
    expect(cabeInteiroNaJanela(quaseFora, janela)).toBe(false);
  });

  it("o rótulo que cabe raspando é desenhado; um pixel além, não", () => {
    const l = "28/09/2026";
    const ultimoQueCabe = janela.scrollLeft + janela.larguraVisivel - larguraAproximada(l);
    expect(cabeInteiroNaJanela({ x: ultimoQueCabe, label: l }, janela)).toBe(true);
    expect(cabeInteiroNaJanela({ x: ultimoQueCabe + 1, label: l }, janela)).toBe(false);
  });

  it("a borda ESQUERDA continua guardada, e o chip grudado empurra o limite", () => {
    expect(cabeInteiroNaJanela({ x: 999, label: "13/09" }, janela)).toBe(false);
    const comChip = { ...janela, margemEsquerda: 80 };
    expect(cabeInteiroNaJanela({ x: 1040, label: "13/09" }, comChip)).toBe(false);
    expect(cabeInteiroNaJanela({ x: 1080, label: "13/09" }, comChip)).toBe(true);
  });

  it("antes da 1ª medição do painel (largura 0) nada é escondido", () => {
    expect(cabeInteiroNaJanela({ x: 9999, label: "jan/2027" }, { scrollLeft: 0, larguraVisivel: 0 })).toBe(
      true,
    );
  });

  /**
   * A varredura dos MESMOS 60 combos do crítico (3 larguras × 4 zooms × 5
   * posições de scroll), agora sobre as funções de produção: 0 rótulos
   * cortados, nas DUAS faixas, contando com o clamp do scroll no máximo (que
   * é onde o último rótulo do eixo era sempre a vítima).
   */
  it("PRONTO QUANDO: 0 rótulos cortados nos 60 combos do crítico (as duas faixas)", () => {
    const LARGURAS = [390, 768, 1280] as const;
    const DENSIDADES = { Auto: 6, Semana: 46, Mês: 16, Trimestre: 6 } as const;
    const FRACOES = [0, 0.25, 0.5, 0.75, 1] as const;
    const minIso = "2026-07-01";
    const maxIso = somaDiasIso(minIso, 120);
    let combos = 0;
    let rotulosConferidos = 0;
    for (const largura of LARGURAS) {
      for (const pxPorDia of Object.values(DENSIDADES)) {
        const escala = gerarEscalaEixo({ minIso, maxIso, pxPorDia, hojeIso: "2026-09-13" });
        const totalWidth = 120 * pxPorDia;
        const maxScroll = Math.max(0, totalWidth - largura);
        for (const f of FRACOES) {
          combos += 1;
          const scrollLeft = maxScroll * f;
          const janelaCombo = { scrollLeft, larguraVisivel: largura };
          const grudado = rotuloDoPeriodoSuperior(
            minIso,
            pxPorDia > 0 ? scrollLeft / pxPorDia : 0,
            escala.periodoSuperior,
          );
          const visiveis = [
            ...rotulosNaJanela(escala.rotulos, janelaCombo),
            ...rotulosNaJanela(escala.rotulosSuperiores, {
              ...janelaCombo,
              margemEsquerda: larguraAproximada(grudado),
            }),
          ];
          for (const r of visiveis) {
            rotulosConferidos += 1;
            expect(r.x).toBeGreaterThanOrEqual(scrollLeft);
            expect(r.x + larguraAproximada(r.label)).toBeLessThanOrEqual(scrollLeft + largura);
          }
        }
      }
    }
    expect(combos).toBe(60);
    expect(rotulosConferidos).toBeGreaterThan(200);
  });
});

// ─── D4: as duas faixas existem em toda densidade ────────────────────────────

describe("D4 — duas faixas em TODA densidade, a de cima com o período maior", () => {
  const HOJE = "2026-09-13";
  /** As quatro janelas que o crítico cobra por extenso. */
  const JANELAS = [60, 120, 400, 900] as const;
  /** A 390px o "auto" bate no piso de 6px/dia — a densidade em que a faixa sumia. */
  const PX_POR_DIA_390_AUTO = 6;

  for (const dias of JANELAS) {
    it(`390px · Auto · janela de ${dias} d: faixa de cima presente + grudado + ≥2 rótulos embaixo`, () => {
      const minIso = "2026-07-01";
      const escala = gerarEscalaEixo({
        minIso,
        maxIso: somaDiasIso(minIso, dias),
        pxPorDia: PX_POR_DIA_390_AUTO,
        hojeIso: HOJE,
      });
      // Nada de faixa única: a de cima existe, com rótulo.
      expect(escala.rotulosSuperiores.length).toBeGreaterThanOrEqual(1);
      // E o chip grudado tem o MESMO formato de período da faixa de cima.
      const grudado = rotuloDoPeriodoSuperior(minIso, 0, escala.periodoSuperior);
      expect(grudado).toBe(escala.rotulosSuperiores[0]?.label ?? grudado);
      // A de baixo carrega o período MENOR (datas) e tem mais de um rótulo
      // dentro dos 390px visíveis — era 2 no total, e 1 a 400 d.
      const visiveisEm390 = rotulosNaJanela(escala.rotulos, {
        scrollLeft: 0,
        larguraVisivel: 390,
      });
      expect(visiveisEm390.length).toBeGreaterThanOrEqual(2);
      expect(escala.rotulos.every((r) => r.tipo !== "mes")).toBe(true);
    });
  }

  it("a faixa de cima respeita o MESMO portão de colisão da de baixo", () => {
    for (const pxPorDia of [2, 6, 16, 24, 46, 64]) {
      for (const dias of [30, 120, 400]) {
        const escala = gerarEscalaEixo({
          minIso: "2026-07-01",
          maxIso: somaDiasIso("2026-07-01", dias),
          pxPorDia,
          hojeIso: HOJE,
        });
        const ordenados = [...escala.rotulosSuperiores].sort((a, b) => a.x - b.x);
        for (let i = 1; i < ordenados.length; i += 1) {
          expect(ordenados[i]!.x - ordenados[i - 1]!.x).toBeGreaterThanOrEqual(
            distanciaMinima(ordenados[i - 1]!, ordenados[i]!),
          );
        }
      }
    }
  });

  it("densidade minúscula: o mês não cabe, a faixa de cima SOBE para trimestre/ano — nunca some", () => {
    // 0,25px/dia: um ano inteiro ocupa 91px; nome de mês precisa de ~88px a
    // cada ~7px de vão. O mês não cabe; a faixa continua existindo.
    const escala = gerarEscalaEixo({
      minIso: "2026-01-01",
      maxIso: "2027-02-01",
      pxPorDia: 0.25,
      hojeIso: "2026-09-13",
    });
    expect(escala.periodoSuperior).not.toBe("mes");
    expect(["trimestre", "ano"]).toContain(escala.periodoSuperior);
    expect(escala.rotulosSuperiores.length).toBeGreaterThanOrEqual(1);
    expect(rotuloDoPeriodoSuperior("2026-01-01", 0, escala.periodoSuperior)).toMatch(/^(T\d\/)?\d{4}$/);
  });

  it("nas cinco densidades reais do app a faixa de cima nunca fica vazia", () => {
    for (const pxPorDia of [6, 16, 24, 46, 64]) {
      const escala = gerarEscalaEixo({
        minIso: "2026-07-01",
        maxIso: somaDiasIso("2026-07-01", 120),
        pxPorDia,
        hojeIso: HOJE,
      });
      expect(escala.rotulosSuperiores.length, `pxPorDia=${pxPorDia}`).toBeGreaterThanOrEqual(1);
      expect(faixaDoEixo(pxPorDia)).toBeTruthy();
    }
  });
});

// ─── D6: o aviso não sugere um zoom que piora ────────────────────────────────

describe("D6 — quando quem corta é o TETO, o aviso diz a verdade", () => {
  it("teto mordendo: nomeia os 420 dias, conta os itens e NÃO sugere zoom", () => {
    const frase = avisoDeItensFora({
      itensFora: 5,
      fimDesenhadoFormatado: "29/10/2027",
      tetoMordeu: true,
      zoom: "auto",
    });
    expect(frase).toContain(`${TETO_DIAS_ESCALA} dias`);
    expect(frase).toContain("29/10/2027");
    expect(frase).toContain("5 itens ficam fora");
    expect(frase).toContain("em qualquer zoom");
    expect(frase).not.toContain("Mês/Trimestre");
  });

  it("recorte do 'auto' (sem teto): o conselho continua, porque aí ele é verdade", () => {
    const frase = avisoDeItensFora({
      itensFora: 2,
      fimDesenhadoFormatado: "30/09/2026",
      tetoMordeu: false,
      zoom: "auto",
    });
    expect(frase).toContain("Mês/Trimestre mostra o histórico");
  });

  it("zoom fixo sem teto: conta e nomeia o fim, sem sugerir nada", () => {
    const frase = avisoDeItensFora({
      itensFora: 1,
      fimDesenhadoFormatado: "30/09/2026",
      tetoMordeu: false,
      zoom: "fixo",
    });
    expect(frase).toBe("1 item começa ou termina fora da janela desenhada (até 30/09/2026)");
  });

  it("nenhum item fora: nenhuma frase (a tela não ganha ruído)", () => {
    expect(
      avisoDeItensFora({ itensFora: 0, fimDesenhadoFormatado: "x", tetoMordeu: true, zoom: "auto" }),
    ).toBeNull();
  });

  it("`tetoMordeu` é medido na janela, não chutado — e o caso de 900 d morde", () => {
    expect(tetoMordeu("2026-07-01", somaDiasIso("2026-07-01", 900))).toBe(true);
    expect(tetoMordeu("2026-07-01", somaDiasIso("2026-07-01", 420))).toBe(true);
    expect(tetoMordeu("2026-07-01", somaDiasIso("2026-07-01", 419))).toBe(false);
  });

  it("MUTAÇÃO: o conselho antigo, colado em toda janela de 'auto', mentia a 900 d", () => {
    // O que a rodada 6 escrevia (sempre o mesmo sufixo em "auto") × o que a
    // função escreve hoje para a MESMA janela cortada pelo teto.
    const hoje = avisoDeItensFora({
      itensFora: 5,
      fimDesenhadoFormatado: "29/10/2027",
      tetoMordeu: tetoMordeu("2026-07-01", somaDiasIso("2026-07-01", 900)),
      zoom: "auto",
    });
    expect(hoje).not.toContain("Mês/Trimestre mostra o histórico");
  });
});

describe("D6 (irmão) — o aviso de overflow não manda trocar para um zoom idêntico", () => {
  it("'auto' no piso de 6px/dia: Trimestre também é 6 — o conselho some", () => {
    const frase = avisoDeOverflow({ telas: "11,6", pxPorDiaAtual: 6, pxPorDiaTrimestre: 6 });
    expect(frase).toContain("11,6 telas de rolagem");
    expect(frase).not.toContain("Trimestre");
    expect(frase).toContain("Use ← →");
  });

  it("densidade maior que a do Trimestre: aí o conselho é verdade e continua", () => {
    expect(avisoDeOverflow({ telas: "3,6", pxPorDiaAtual: 16, pxPorDiaTrimestre: 6 })).toContain(
      "escolha Trimestre",
    );
  });
});
