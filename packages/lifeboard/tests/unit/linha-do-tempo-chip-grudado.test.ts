import { describe, expect, it } from "vitest";

import {
  colunasSemMes,
  faixaSuperiorDaTela,
  gerarEscalaEixo,
  larguraAproximada,
  posicaoDoChipGrudado,
  rotulosNaJanela,
  rotulosSuperioresNaJanela,
  rotuloDoPeriodoSuperior,
} from "@/core/timeline/eixo-rotulos";

/**
 * OS-LIFEBOARD · P5 — rodada 9, achado MÉDIO A2: "a faixa de cima pula o mês,
 * e o chip nomeia outro mês".
 *
 * A causa, medida pelo crítico: a faixa de cima era filtrada com
 * `margemEsquerda = larguraMesGrudado` — ou seja, TODO rótulo de mês que
 * caísse atrás do chip grudado era APAGADO. Em 320 de 730 posições de scroll
 * (43,8%) havia um mês começando dentro da janela sem nenhum rótulo em cima;
 * no caso canônico (1280px, zoom Mês, janela de 400 d, `scrollLeft` 3333) a
 * régua lia `dez/2026 … 04/01 11/01 18/01 25/01 … fev/2027`: janeiro de 2027
 * INTEIRO sem cabeçalho, com o chip ainda dizendo "dez/2026".
 *
 * A decisão: o mês que entra EMPURRA o chip, como faz a referência. Aqui a
 * asserção é o número, não a intenção — a varredura das 730 posições roda de
 * verdade, com as funções de produção, e o mutante (devolver a margem do
 * chip) tem de ficar vermelho.
 */

const MIN = "2026-06-01";
const MAX = "2027-07-06"; // 400 dias
const PX_POR_DIA = 16; // zoom "Mês"
const LARGURA = 1280;
const TOTAL = 400 * PX_POR_DIA;
const MAX_SCROLL = TOTAL - LARGURA;
const POSICOES = 730;

const escala = gerarEscalaEixo({
  minIso: MIN,
  maxIso: MAX,
  pxPorDia: PX_POR_DIA,
  hojeIso: "2026-09-13",
});

function scrollDaPosicao(i: number): number {
  return Math.round((i * MAX_SCROLL) / (POSICOES - 1));
}

/** O que a VIEW desenha numa posição de scroll — o caminho real do componente. */
function telaEm(scrollLeft: number, comMargemDoChip = false) {
  const chipLabel = rotuloDoPeriodoSuperior(MIN, scrollLeft / PX_POR_DIA, escala.periodoSuperior);
  const larguraChip = larguraAproximada(chipLabel);
  const janela = { scrollLeft, larguraVisivel: LARGURA };
  const superiores = comMargemDoChip
    ? // A MUTAÇÃO: a rodada 8 literal, que apagava quem caísse atrás do chip.
      // (O `margemEsquerda` saiu do contrato de `JanelaVisivel` — aqui ele é
      // re-escrito à mão, para a régua provar que ela veria o defeito voltar.)
      escala.rotulosSuperiores.filter(
        (r) =>
          r.x >= scrollLeft + larguraChip &&
          r.x + larguraAproximada(r.label) <= scrollLeft + LARGURA,
      )
    : faixaSuperiorDaTela({
        rotulosSuperiores: escala.rotulosSuperiores,
        minIso: MIN,
        pxPorDia: PX_POR_DIA,
        periodo: escala.periodoSuperior,
        janela,
      }).rotulos;
  const colunas = rotulosNaJanela(escala.rotulos, janela);
  const chip = faixaSuperiorDaTela({
    rotulosSuperiores: escala.rotulosSuperiores,
    minIso: MIN,
    pxPorDia: PX_POR_DIA,
    periodo: escala.periodoSuperior,
    janela,
  }).chip;
  return { chipLabel, larguraChip, chip, superiores, colunas, janela };
}

describe("A2 · toda coluna visível tem o seu mês na faixa de cima", () => {
  it("a faixa de cima é de MESES nesta escala (senão a varredura mede outra coisa)", () => {
    expect(escala.periodoSuperior).toBe("mes");
    expect(escala.rotulosSuperiores.length).toBeGreaterThan(10);
  });

  it("730 posições de scroll: ZERO colunas órfãs", () => {
    const orfas: { scrollLeft: number; colunas: number[] }[] = [];
    for (let i = 0; i < POSICOES; i += 1) {
      const scrollLeft = scrollDaPosicao(i);
      const t = telaEm(scrollLeft);
      const c = colunasSemMes({
        rotulosSuperiores: escala.rotulosSuperiores,
        superioresDesenhados: t.superiores,
        colunasDesenhadas: t.colunas,
        janela: t.janela,
      });
      if (c.length) orfas.push({ scrollLeft, colunas: c });
    }
    expect(orfas).toEqual([]);
  });

  it("MUTAÇÃO (a rodada 8 literal: a margem do chip apaga quem está atrás dele)", () => {
    let posicoesOrfas = 0;
    for (let i = 0; i < POSICOES; i += 1) {
      const scrollLeft = scrollDaPosicao(i);
      const t = telaEm(scrollLeft, true);
      const c = colunasSemMes({
        rotulosSuperiores: escala.rotulosSuperiores,
        superioresDesenhados: t.superiores,
        colunasDesenhadas: t.colunas,
        janela: t.janela,
      });
      if (c.length) posicoesOrfas += 1;
    }
    // Medido nesta régua, dando ao chip o crédito de nomear o período da borda
    // (a leitura mais generosa possível para a rodada 8): 114 de 730 posições
    // com coluna visível cujo mês não está em lugar nenhum — contra 0 agora.
    expect(posicoesOrfas).toBe(114);
  });

  it("nenhum mês é escondido ATRÁS do chip em nenhuma das 730 posições", () => {
    const escondidos: string[] = [];
    for (let i = 0; i < POSICOES; i += 1) {
      const scrollLeft = scrollDaPosicao(i);
      const t = telaEm(scrollLeft);
      for (const r of escala.rotulosSuperiores) {
        if (r.x <= scrollLeft) continue;
        // "Atrás do chip" = começaria dentro da faixa que o chip ocuparia em repouso.
        if (r.x >= scrollLeft + t.larguraChip) continue;
        if (!t.superiores.some((s) => s.x === r.x)) escondidos.push(`${scrollLeft}:${r.label}`);
      }
    }
    expect(escondidos).toEqual([]);
  });
});

describe("A2 · o chip é EMPURRADO, nunca apaga o vizinho", () => {
  it("em repouso o chip fica em 0; encostando, desliza para a esquerda", () => {
    const superiores = [{ x: 0 }, { x: 480 }, { x: 960 }];
    expect(posicaoDoChipGrudado({ rotulosSuperiores: superiores, scrollLeft: 200, larguraChip: 76 }).x).toBe(0);
    // O próximo mês está a 40px da borda: o chip (76px) cede 36px.
    expect(posicaoDoChipGrudado({ rotulosSuperiores: superiores, scrollLeft: 440, larguraChip: 76 }).x).toBe(-36);
    // Encostado na borda: o chip saiu inteiro.
    expect(posicaoDoChipGrudado({ rotulosSuperiores: superiores, scrollLeft: 479, larguraChip: 76 }).x).toBe(-75);
  });

  it("o chip nunca cobre o rótulo que vem a seguir — em nenhuma das 730 posições", () => {
    for (let i = 0; i < POSICOES; i += 1) {
      const scrollLeft = scrollDaPosicao(i);
      const t = telaEm(scrollLeft);
      const proximo = escala.rotulosSuperiores
        .map((r) => r.x)
        .filter((x) => x > scrollLeft)
        .sort((a, b) => a - b)[0];
      if (proximo === undefined) continue;
      const direitaDoChip = t.chip.x + t.larguraChip;
      expect(direitaDoChip).toBeLessThanOrEqual(proximo - scrollLeft + 1e-9);
    }
  });

  it("sem rótulo à direita (fim do eixo) o chip volta para 0; entradas podres não lançam", () => {
    expect(posicaoDoChipGrudado({ rotulosSuperiores: [{ x: 0 }], scrollLeft: 900, larguraChip: 76 }).x).toBe(0);
    expect(
      posicaoDoChipGrudado({
        rotulosSuperiores: [{ x: Number.NaN }, { x: 100 }],
        scrollLeft: Number.NaN,
        larguraChip: Number.NaN,
      }).x,
    ).toBe(0);
  });
});

describe("A2 · a borda DIREITA encurta antes de sumir, e nunca mente sobre o ano", () => {
  it("cabe inteiro → desenha inteiro", () => {
    const r = [{ x: 100, label: "set/2026", forte: true, tipo: "mes" as const }];
    expect(rotulosSuperioresNaJanela(r, { scrollLeft: 0, larguraVisivel: 400 })).toEqual(r);
  });

  it("não cabe inteiro, mas o ano já está declarado na tela → desenha o mês curto", () => {
    const saida = rotulosSuperioresNaJanela(
      [{ x: 350, label: "set/2026", forte: true, tipo: "mes" }],
      { scrollLeft: 0, larguraVisivel: 400, rotuloDaBorda: "ago/2026" },
    );
    expect(saida.map((s) => s.label)).toEqual(["set"]);
  });

  it("encurtar mudaria o ano que o leitor infere → NÃO desenha (nunca um ano errado)", () => {
    const saida = rotulosSuperioresNaJanela(
      [{ x: 350, label: "jan/2027", forte: true, tipo: "mes" }],
      { scrollLeft: 0, larguraVisivel: 400, rotuloDaBorda: "dez/2026" },
    );
    expect(saida).toEqual([]);
  });

  it("nem o curto cabe → não desenha (jamais cortado)", () => {
    const saida = rotulosSuperioresNaJanela(
      [{ x: 385, label: "set/2026", forte: true, tipo: "mes" }],
      { scrollLeft: 0, larguraVisivel: 400, rotuloDaBorda: "ago/2026" },
    );
    expect(saida).toEqual([]);
  });

  it("nenhum rótulo desenhado ultrapassa as DUAS bordas, nas 730 posições", () => {
    for (let i = 0; i < POSICOES; i += 1) {
      const scrollLeft = scrollDaPosicao(i);
      const t = telaEm(scrollLeft);
      for (const r of t.superiores) {
        expect(r.x).toBeGreaterThanOrEqual(scrollLeft);
        expect(r.x + larguraAproximada(r.label)).toBeLessThanOrEqual(scrollLeft + LARGURA);
      }
    }
  });

  it("todo rótulo de mês que carrega ano carrega o ano CERTO, nas 730 posições", () => {
    const inicioMs = Date.UTC(2026, 5, 1);
    for (let i = 0; i < POSICOES; i += 1) {
      const t = telaEm(scrollDaPosicao(i));
      for (const r of [...t.superiores, { x: 0, label: t.chipLabel }]) {
        const ano = /\/(\d{4})$/.exec(r.label)?.[1];
        if (!ano) continue;
        const xReal = r.label === t.chipLabel ? scrollDaPosicao(i) : r.x;
        const anoReal = new Date(inicioMs + (xReal / PX_POR_DIA) * 86400000).getUTCFullYear();
        expect(Number(ano)).toBe(anoReal);
      }
    }
  });
});
