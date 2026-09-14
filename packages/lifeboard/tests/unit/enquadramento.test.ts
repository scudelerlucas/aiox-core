import { describe, expect, it } from "vitest";

import {
  caixaDosCartoes,
  cartoesForaDaTela,
  enquadramentoComModo,
  enquadramentoPara,
  TOLERANCIA_DE_CONTENCAO_PX,
  type Caixa,
  type CartaoNaTela,
} from "@/lib/enquadramento";
import { ZOOM_DO_MODO_MAPA, ZOOM_MINIMO } from "@/components/graph/tipografia-do-cartao";

/**
 * OS-LIFEBOARD · P4g — decisões D1 e D2 do crítico hostil ROUND 6.
 *
 * **D1.** "Caminho crítico" mostrava 1 dos 3 cartões críticos porque o
 * enquadramento era `fitView({ minZoom: 0,85 })` e no ReactFlow `minZoom` é
 * PISO, não teto: quando a cadeia pedia MENOS que 0,85 a lib aproximava além
 * do enquadramento e as pontas saíam (`task-setup` a −13px do topo,
 * `task-deploy` a 813px num pane de 800). Aqui o zoom é CLAMPADO e a função
 * diz se a caixa coube.
 *
 * **D2.** "Ver tudo" declarava sucesso com 10 cartões cortados (um deles a
 * META) porque o teste do chip era de INTERSEÇÃO. Aqui é de CONTENÇÃO, com a
 * mesma tolerância de 0,5px da medição no navegador.
 *
 * Os dois primeiros testes de cada bloco são os falsificadores: um piso usado
 * como teto (D1) e uma interseção usada como contenção (D2) os derrubam.
 */

const PANE = { largura: 800, altura: 600 };

function cantos(bbox: Caixa, e: { x: number; y: number; zoom: number }): { x: number; y: number }[] {
  return [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.largura, y: bbox.y },
    { x: bbox.x, y: bbox.y + bbox.altura },
    { x: bbox.x + bbox.largura, y: bbox.y + bbox.altura },
  ].map((p) => ({ x: p.x * e.zoom + e.x, y: p.y * e.zoom + e.y }));
}

describe("enquadramentoPara — o zoom é clampado, e a caixa cabe (D1)", () => {
  it("caixa MAIOR que o pane: zoom < 1 e os QUATRO cantos dentro do retângulo do pane", () => {
    const bbox: Caixa = { x: 0, y: 0, largura: 1200, altura: 900 };
    const e = enquadramentoPara(bbox, PANE, { padding: 24, zoomMax: 1.2 });
    expect(e.zoom).toBeLessThan(1);
    expect(e.cabeInteiro).toBe(true);
    for (const c of cantos(bbox, e)) {
      expect(c.x).toBeGreaterThanOrEqual(-0.001);
      expect(c.y).toBeGreaterThanOrEqual(-0.001);
      expect(c.x).toBeLessThanOrEqual(PANE.largura + 0.001);
      expect(c.y).toBeLessThanOrEqual(PANE.altura + 0.001);
    }
  });

  it("a CADEIA CURTA (o caso que saía da tela): nenhum canto fora, e o zoom não estoura o teto", () => {
    // Os 3 cartões críticos do fixture, empilhados: 200 de largura, 972 de
    // altura. Com `minZoom: 0,85` a lib aproximava para 0,85 e a cadeia
    // (972 × 0,85 = 826px) não cabia num pane de 600 — foi a medição do
    // crítico (`task-deploy` no y 813 de um pane de 800).
    const bbox: Caixa = { x: 0, y: 0, largura: 200, altura: 972 };
    const e = enquadramentoPara(bbox, PANE, { padding: 24, zoomMax: 1.2 });
    expect(e.zoom).toBeLessThan(ZOOM_DO_MODO_MAPA);
    expect(e.cabeInteiro).toBe(true);
    for (const c of cantos(bbox, e)) {
      expect(c.y).toBeGreaterThanOrEqual(-0.001);
      expect(c.y).toBeLessThanOrEqual(PANE.altura + 0.001);
    }
  });

  it("caixa que nem no piso do zoom cabe: `cabeInteiro` false — o chip passa a ser obrigatório", () => {
    const bbox: Caixa = { x: 0, y: 0, largura: 4000, altura: 40000 };
    const e = enquadramentoPara(bbox, PANE, { padding: 24, zoomMax: 1 });
    expect(e.zoom).toBe(ZOOM_MINIMO);
    expect(e.cabeInteiro).toBe(false);
  });

  it("`cabeInteiro` é medido contra o PANE, não contra o pane menos a folga", () => {
    // Caixa que não cabe com o padding, mas cabe na tela encostada na borda:
    // o botão não pode anunciar "Ver o máximo possível" aqui (medido a 390px:
    // 11 de 11 cartões contidos com `cabeInteiro` false antes desta correção).
    const bbox: Caixa = { x: 0, y: 0, largura: 780, altura: 560 };
    const e = enquadramentoPara(bbox, PANE, { padding: 24, zoomMax: 1 });
    expect(e.zoom).toBeLessThan(1);
    expect(bbox.largura * e.zoom).toBeLessThanOrEqual(PANE.largura);
    expect(e.cabeInteiro).toBe(true);
  });

  it("caixa MENOR que o pane: o teto segura a ampliação (nunca vira lupa)", () => {
    const e = enquadramentoPara({ x: 0, y: 0, largura: 100, altura: 80 }, PANE, {
      padding: 24,
      zoomMax: 1.2,
    });
    expect(e.zoom).toBe(1.2);
    expect(e.cabeInteiro).toBe(true);
  });

  it("o centro da caixa cai no centro do pane", () => {
    const bbox: Caixa = { x: 500, y: -200, largura: 400, altura: 300 };
    const e = enquadramentoPara(bbox, PANE, { padding: 24, zoomMax: 1 });
    const centro = { x: (bbox.x + bbox.largura / 2) * e.zoom + e.x, y: (bbox.y + bbox.altura / 2) * e.zoom + e.y };
    expect(centro.x).toBeCloseTo(PANE.largura / 2, 6);
    expect(centro.y).toBeCloseTo(PANE.altura / 2, 6);
  });
});

describe("cartoesForaDaTela — CONTENÇÃO, nunca interseção (D2)", () => {
  const viewport = { x: 0, y: 0, zoom: 1 };
  const pane = { largura: 400, altura: 300 };

  it("cartão cortado pela metade conta como FORA (o falsificador da interseção)", () => {
    // Metade dentro, metade fora: o teste antigo (`x + w > 0 && x < largura`)
    // dava "visível" e o chip sumia com 10 cartões assim.
    const meio: CartaoNaTela = { id: "meio", x: 350, y: 10, largura: 100, altura: 50 };
    expect(cartoesForaDaTela([meio], viewport, pane)).toEqual(["meio"]);
  });

  it("cartão inteiro dentro não conta; encostado na borda (dentro da tolerância) também não", () => {
    const dentro: CartaoNaTela = { id: "dentro", x: 10, y: 10, largura: 100, altura: 50 };
    const encostado: CartaoNaTela = { id: "encostado", x: 300, y: 250, largura: 100, altura: 50 };
    expect(cartoesForaDaTela([dentro, encostado], viewport, pane)).toEqual([]);
  });

  it("um décimo de pixel além da tolerância já conta como fora", () => {
    const quase: CartaoNaTela = {
      id: "quase",
      x: 300 + TOLERANCIA_DE_CONTENCAO_PX + 0.1,
      y: 10,
      largura: 100,
      altura: 50,
    };
    expect(cartoesForaDaTela([quase], viewport, pane)).toEqual(["quase"]);
  });

  it("o zoom entra na conta: o mesmo cartão cabe a 0,5 e não cabe a 1", () => {
    const grande: CartaoNaTela = { id: "g", x: 0, y: 0, largura: 600, altura: 200 };
    expect(cartoesForaDaTela([grande], { x: 0, y: 0, zoom: 1 }, pane)).toEqual(["g"]);
    expect(cartoesForaDaTela([grande], { x: 0, y: 0, zoom: 0.5 }, pane)).toEqual([]);
  });

  it("caixaDosCartoes envolve todos — é a entrada do enquadramento", () => {
    const caixa = caixaDosCartoes([
      { id: "a", x: 0, y: 0, largura: 200, altura: 180 },
      { id: "b", x: 256, y: 264, largura: 200, altura: 180 },
    ]);
    expect(caixa).toEqual({ x: 0, y: 0, largura: 456, altura: 444 });
  });
});

describe("enquadramentoComModo — altura, caixa, zoom e modo são UM ponto fixo (MÉDIO #6)", () => {
  /** 7 linhas de cartões: a mesma grade do cenário de 40 tarefas. */
  const caixaParaAltura = (altura: number): Caixa => ({
    x: 0,
    y: 0,
    largura: 1480,
    altura: 6 * (altura + 84) + altura,
  });
  const pane = { largura: 1256, altura: 650 };

  it("40 tarefas a 1280: com a PASTILHA a caixa inteira cabe sem bater no piso de zoom", () => {
    const r = enquadramentoComModo({
      caixaParaAltura,
      pane,
      opcoes: { padding: 24, zoomMax: 1 },
      alturaCartao: 180,
      alturaMapa: 44,
    });
    expect(r.modo).toBe("mapa");
    expect(r.cabeInteiro).toBe(true);
    expect(r.zoom).toBeGreaterThan(ZOOM_MINIMO);
    // A prova de que a altura MUDA o resultado: enquadrar com a caixa do modo
    // cartão (o que o código fazia) daria um zoom abaixo do piso.
    const comCartao = enquadramentoPara(caixaParaAltura(180), pane, { padding: 24, zoomMax: 1 });
    expect(comCartao.cabeInteiro).toBe(false);
  });

  it("grafo pequeno continua em modo CARTÃO (a pastilha não é o default)", () => {
    const r = enquadramentoComModo({
      caixaParaAltura: (altura) => ({ x: 0, y: 0, largura: 456, altura: altura + 84 + altura }),
      pane,
      opcoes: { padding: 24, zoomMax: 1 },
      alturaCartao: 180,
      alturaMapa: 44,
    });
    expect(r.modo).toBe("cartao");
    expect(r.zoom).toBeGreaterThanOrEqual(ZOOM_DO_MODO_MAPA);
  });

  it("na fatia ambígua (cartão não cabe, mapa caberia acima do corte) fica no MAPA, sem oscilar", () => {
    // Caixa escolhida para cair exatamente entre os dois regimes.
    const r = enquadramentoComModo({
      caixaParaAltura: (altura) => ({ x: 0, y: 0, largura: 600, altura: 4 * (altura + 84) }),
      pane: { largura: 900, altura: 700 },
      opcoes: { padding: 24, zoomMax: 1 },
      alturaCartao: 180,
      alturaMapa: 44,
    });
    expect(r.modo).toBe("mapa");
    expect(r.zoom).toBeLessThan(ZOOM_DO_MODO_MAPA);
    expect(r.cabeInteiro).toBe(true);
  });

  it("200 tarefas: nem a pastilha salva — `cabeInteiro` false, e é isso que o chip anuncia", () => {
    const r = enquadramentoComModo({
      caixaParaAltura: (altura) => ({ x: 0, y: 0, largura: 3660, altura: 36 * (altura + 240) + altura }),
      pane,
      opcoes: { padding: 24, zoomMax: 1 },
      alturaCartao: 180,
      alturaMapa: 44,
    });
    expect(r.cabeInteiro).toBe(false);
    expect(r.zoom).toBe(ZOOM_MINIMO);
  });
});
