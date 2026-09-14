import { describe, expect, it } from "vitest";

import {
  enquadramentoDoAlvo,
  panQueMaximizaCartoesInteiros,
  placarDeCartoes,
  type CartaoNaTela,
} from "@/lib/enquadramento";
import { alturaDoCanvasDoGrafo } from "@/lib/altura-do-canvas";
import { CanvasSimulado } from "./simulador-do-canvas";
import { arvore200, grafo40 } from "./cenarios-do-grafo";

/**
 * OS-LIFEBOARD · P4h — achado ALTO #2 do crítico hostil ROUND 8: **"Ver o
 * máximo possível" mostrava MENOS do que já estava na tela** — e derrubava um
 * nó do caminho crítico.
 *
 * O que ele mediu, com o MESMO zoom antes e depois (0,500): 40@390 caiu de
 * 27/40 (4/4 críticos) para 24/40 (3/4); 200@1280 de 26/200 (2/10 críticos)
 * para 20/200 (1/10); 200@1024 e 200@1440 de 22 e 26 para 20. O chip era
 * honesto; o botão não.
 *
 * A causa: no piso do zoom o enquadramento CENTRAVA a caixa. Com a caixa maior
 * que o painel, centrar corta as DUAS pontas — encostar numa borda deixa mais
 * cartões inteiros. A decisão fixa da rodada 8: no piso de zoom o
 * enquadramento MAXIMIZA cartões inteiros, desempata pelo caminho crítico e
 * nunca entrega menos do que o estado que substitui.
 *
 * O falsificador destes testes é uma linha: fazer `enquadramentoDoAlvo`
 * devolver o enquadramento centrado (isto é, não maximizar o pan).
 */

/**
 * Grade de cartões em px de MUNDO. Os números batem com o produto: cartão de
 * 200×180 (`ALTURA_DO_CARTAO`) e passo de linha maior que a altura — é a forma
 * em que centrar perde uma FILEIRA inteira contra encostar.
 */
function grade(params: {
  colunas: number;
  linhas: number;
  passoX: number;
  passoY: number;
  altura: number;
}): CartaoNaTela[] {
  const cartoes: CartaoNaTela[] = [];
  for (let l = 0; l < params.linhas; l++) {
    for (let c = 0; c < params.colunas; c++) {
      cartoes.push({
        id: `n${l}-${c}`,
        x: c * params.passoX,
        y: l * params.passoY,
        largura: 200,
        altura: params.altura,
      });
    }
  }
  return cartoes;
}

const GRADE = { colunas: 3, passoX: 220, passoY: 200, altura: 180 };
const PANE_SINTETICO = { largura: 700, altura: 400 };

function centrado(cartoes: CartaoNaTela[], zoom: number, pane: { largura: number; altura: number }) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of cartoes) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.largura);
    y1 = Math.max(y1, c.y + c.altura);
  }
  return {
    x: pane.largura / 2 - ((x0 + x1) / 2) * zoom,
    y: pane.altura / 2 - ((y0 + y1) / 2) * zoom,
    zoom,
  };
}

describe("panQueMaximizaCartoesInteiros — encostar, nunca centrar (achado ALTO #2)", () => {
  it("caixa maior que o painel: o pan que maximiza mostra MAIS que o centrado", () => {
    const cartoes = grade({ ...GRADE, linhas: 5 });
    const pane = PANE_SINTETICO;
    const zoom = 0.5;
    const doCentro = placarDeCartoes(cartoes, centrado(cartoes, zoom, pane), pane);
    const melhor = panQueMaximizaCartoesInteiros({ cartoes, zoom, pane });
    expect(doCentro.inteiros).toBe(9); // 3 fileiras — a de cima e a de baixo cortadas
    expect(melhor.placar.inteiros).toBe(12); // 4 fileiras — encostado numa borda
    expect(melhor.placar.inteiros).toBeGreaterThan(doCentro.inteiros);
    // E o placar devolvido é o mesmo que a contagem independente mede.
    expect(
      placarDeCartoes(cartoes, { x: melhor.x, y: melhor.y, zoom }, pane).inteiros,
    ).toBe(melhor.placar.inteiros);
  });

  it("desempate pelo caminho crítico: entre dois pans com o mesmo total, vence o que traz mais críticos", () => {
    // 5 fileiras, 4 cabem: encostar em cima mostra 0..3, encostar embaixo
    // mostra 1..4 — MESMO total. A fileira 4 é a crítica.
    const cartoes = grade({ ...GRADE, linhas: 5 });
    const pane = PANE_SINTETICO;
    const criticos = new Set(["n4-0", "n4-1", "n4-2"]);
    const semCriterio = panQueMaximizaCartoesInteiros({ cartoes, zoom: 0.5, pane });
    const comCriterio = panQueMaximizaCartoesInteiros({
      cartoes,
      zoom: 0.5,
      pane,
      criticoIds: criticos,
    });
    expect(comCriterio.placar.inteiros).toBe(semCriterio.placar.inteiros);
    expect(comCriterio.placar.criticos).toBe(3);
  });

  it("o pan ATUAL entra como candidato — o botão nunca piora o que já estava na tela", () => {
    const cartoes = grade({ ...GRADE, linhas: 5 });
    const pane = PANE_SINTETICO;
    const zoom = 0.5;
    const atual = { x: -10, y: -6, zoom };
    const doAtual = placarDeCartoes(cartoes, atual, pane);
    const melhor = panQueMaximizaCartoesInteiros({
      cartoes,
      zoom,
      pane,
      panAtual: { x: atual.x, y: atual.y },
    });
    expect(melhor.placar.inteiros).toBeGreaterThanOrEqual(doAtual.inteiros);
  });

  it("enquadramentoDoAlvo (o caminho do BOTÃO) devolve o pan maximizado, não o centrado", () => {
    const cartoes = grade({ ...GRADE, linhas: 5 });
    const pane = PANE_SINTETICO;
    const e = enquadramentoDoAlvo({
      cartoesParaAltura: () => cartoes,
      pane,
      // Piso e teto no mesmo valor: o zoom fica preso em 0,5 e a única coisa
      // que o enquadramento ainda escolhe é o PAN — que é o achado.
      opcoes: { padding: 24, zoomMax: 0.5, zoomMin: 0.5 },
      alturaCartao: GRADE.altura,
      alturaMapa: GRADE.altura,
    });
    expect(e.cabeInteiro).toBe(false);
    const doBotao = placarDeCartoes(cartoes, { x: e.x, y: e.y, zoom: e.zoom }, pane);
    const doCentro = placarDeCartoes(cartoes, centrado(cartoes, e.zoom, pane), pane);
    expect(doCentro.inteiros).toBe(9);
    expect(doBotao.inteiros).toBe(12);
  });

  it("quando a caixa CABE inteira, o enquadramento continua centrado (nada da rodada 6 muda)", () => {
    const cartoes: CartaoNaTela[] = [
      { id: "a", x: 0, y: 0, largura: 200, altura: 44 },
      { id: "b", x: 0, y: 200, largura: 200, altura: 44 },
    ];
    const e = enquadramentoDoAlvo({
      cartoesParaAltura: () => cartoes,
      pane: { largura: 800, altura: 600 },
      opcoes: { padding: 24, zoomMax: 1 },
      alturaCartao: 44,
      alturaMapa: 44,
    });
    expect(e.cabeInteiro).toBe(true);
    const centroX = 100;
    expect(e.x).toBeCloseTo(800 / 2 - centroX * e.zoom, 6);
  });
});

describe("o BOTÃO, medido antes e depois nos 5 casos do crítico", () => {
  const casos = [
    { nome: "40@390", cenario: grafo40, largura: 390, janela: 800 },
    { nome: "40@1024", cenario: grafo40, largura: 1024, janela: 800 },
    { nome: "40@1280", cenario: grafo40, largura: 1280, janela: 800 },
    { nome: "40@1440", cenario: grafo40, largura: 1440, janela: 900 },
    {
      nome: "200@1280",
      cenario: () => ({ ...arvore200(), criticoIds: [] as string[] }),
      largura: 1280,
      janela: 800,
    },
  ];

  for (const caso of casos) {
    it(`${caso.nome}: "Ver o máximo possível" nunca entrega menos cartões inteiros do que já havia`, () => {
      const pane = {
        largura: caso.largura,
        altura: alturaDoCanvasDoGrafo({
          larguraDaJanela: caso.largura,
          alturaDaJanela: caso.janela,
        }),
      };
      const canvas = new CanvasSimulado({ cenario: caso.cenario(), pane, alvo: "tudo" }).montar();
      canvas.clicarEnquadrar("tudo");
      const antes = canvas.placar();
      canvas.clicarEnquadrar("tudo");
      const depois = canvas.placar();
      expect(depois.inteiros).toBeGreaterThanOrEqual(antes.inteiros);
      expect(depois.criticos).toBeGreaterThanOrEqual(antes.criticos);
      // E não é só "não piorou": é o MÁXIMO alcançável naquele zoom. Centrar
      // (a rodada 7) fica abaixo deste número sempre que a caixa não cabe.
      const cartoes = canvas.cartoesNaTela();
      const otimo = panQueMaximizaCartoesInteiros({
        cartoes,
        zoom: canvas.zoom,
        pane,
      });
      expect(depois.inteiros).toBe(otimo.placar.inteiros);
    });
  }

  it('40 tarefas: o botão "Ver o máximo possível" não perde nó do caminho crítico que estava na tela', () => {
    const pane = {
      largura: 390,
      altura: alturaDoCanvasDoGrafo({ larguraDaJanela: 390, alturaDaJanela: 800 }),
    };
    const canvas = new CanvasSimulado({ cenario: grafo40(), pane, alvo: "critico" }).montar();
    const comCritico = canvas.placar();
    canvas.clicarEnquadrar("tudo");
    const comTudo = canvas.placar();
    expect(comTudo.inteiros).toBeGreaterThanOrEqual(comCritico.inteiros);
  });
});
