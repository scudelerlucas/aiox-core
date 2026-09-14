/**
 * OS-LIFEBOARD · P4g — Enquadramento do grafo, em função PURA (decisões D1/D2
 * do crítico hostil ROUND 6).
 *
 * O que quebrou na rodada 6: o enquadramento era `fitView({ minZoom: 0,85 })`,
 * e no ReactFlow `minZoom` é PISO, não teto — quando a cadeia crítica precisava
 * de MENOS que 0,85 a lib aproximava ALÉM do enquadramento e as pontas saíam da
 * tela. Medido pelo crítico: `task-setup` a −13px do topo e `task-deploy` a
 * 813px num pane de 800; 1 de 3 cartões críticos visíveis em 390, 768, 1280 e
 * 1440.
 *
 * Aqui não há lib nenhuma: `enquadramentoPara` devolve `{x, y, zoom}` para
 * `setViewport`, com `zoom` CLAMPADO entre o piso do canvas e um TETO — e diz,
 * no mesmo objeto, se a caixa coube inteira (`cabeInteiro`). Quando não coube,
 * quem chama é obrigado a mostrar o chip que conta quantos ficaram fora.
 *
 * `cartoesForaDaTela` é a segunda metade do mesmo achado (ALTO #2): o teste que
 * o chip usava era de INTERSEÇÃO — meio cartão contava como visível, e o chip
 * sumia com 10 cartões cortados, um deles a META. Aqui o teste é de CONTENÇÃO:
 * o cartão só conta como "na tela" quando os QUATRO cantos cabem, com a mesma
 * tolerância de 0,5px que a medição do navegador usa.
 */

import { ZOOM_DO_MODO_MAPA, ZOOM_MINIMO } from "@/components/graph/tipografia-do-cartao";

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Pane {
  largura: number;
  altura: number;
}

export interface OpcoesDeEnquadramento {
  /** Folga em px de TELA de cada lado do pane. */
  padding: number;
  /** TETO do zoom (nunca aproximar mais que isto). */
  zoomMax: number;
  /** Piso do zoom — o mesmo do canvas. */
  zoomMin?: number;
}

export interface Enquadramento {
  x: number;
  y: number;
  zoom: number;
  /**
   * `true` quando a caixa inteira cabe no pane no zoom devolvido. `false` só
   * acontece quando o zoom ideal ficaria ABAIXO do piso do canvas — e aí o
   * chip que conta os que ficaram fora é obrigatório.
   */
  cabeInteiro: boolean;
}

/** Tolerância (px de tela) da contenção — a mesma da medição no navegador. */
export const TOLERANCIA_DE_CONTENCAO_PX = 0.5;

/**
 * Viewport que enquadra `bbox` no `pane`: zoom = o maior que faz a caixa caber
 * nas duas dimensões (com `padding` de cada lado), limitado a `[zoomMin,
 * zoomMax]`; centro da caixa no centro do pane.
 */
export function enquadramentoPara(
  bbox: Caixa,
  pane: Pane,
  opcoes: OpcoesDeEnquadramento,
): Enquadramento {
  const zoomMin = opcoes.zoomMin ?? ZOOM_MINIMO;
  const larguraUtil = Math.max(1, pane.largura - 2 * opcoes.padding);
  const alturaUtil = Math.max(1, pane.altura - 2 * opcoes.padding);
  const largura = Math.max(bbox.largura, 1e-6);
  const altura = Math.max(bbox.altura, 1e-6);
  const ideal = Math.min(larguraUtil / largura, alturaUtil / altura);
  const zoom = Math.min(Math.max(ideal, zoomMin), opcoes.zoomMax);
  const centroX = bbox.x + bbox.largura / 2;
  const centroY = bbox.y + bbox.altura / 2;
  return {
    x: pane.largura / 2 - centroX * zoom,
    y: pane.altura / 2 - centroY * zoom,
    zoom,
    // "Coube" é medido contra o PANE, não contra o pane menos a folga: o
    // `padding` é conforto, não régua. Sem isto o botão anunciava "Ver o
    // máximo possível" num caso em que os 11 cartões cabiam inteiros na tela
    // — só encostados na borda (medido a 390px: 11/11 contidos com
    // `cabeInteiro` false). A mesma régua do chip (`cartoesForaDaTela`).
    cabeInteiro:
      bbox.largura * zoom <= pane.largura + TOLERANCIA_DE_CONTENCAO_PX &&
      bbox.altura * zoom <= pane.altura + TOLERANCIA_DE_CONTENCAO_PX,
  };
}

export interface CartaoNaTela {
  id: string;
  /** Canto superior esquerdo em px de MUNDO. */
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Ids dos cartões que NÃO cabem inteiros no pane. Contenção, nunca interseção:
 * um cartão cortado ao meio conta como fora (achado ALTO #2).
 */
export function cartoesForaDaTela(
  cartoes: readonly CartaoNaTela[],
  viewport: Viewport,
  pane: Pane,
  tolerancia: number = TOLERANCIA_DE_CONTENCAO_PX,
): string[] {
  const fora: string[] = [];
  for (const c of cartoes) {
    const x0 = c.x * viewport.zoom + viewport.x;
    const y0 = c.y * viewport.zoom + viewport.y;
    const x1 = x0 + c.largura * viewport.zoom;
    const y1 = y0 + c.altura * viewport.zoom;
    const inteiro =
      x0 >= -tolerancia &&
      y0 >= -tolerancia &&
      x1 <= pane.largura + tolerancia &&
      y1 <= pane.altura + tolerancia;
    if (!inteiro) fora.push(c.id);
  }
  return fora;
}

/** Caixa que envolve todos os cartões (px de mundo). Lista vazia = caixa zero. */
export function caixaDosCartoes(cartoes: readonly CartaoNaTela[]): Caixa {
  if (cartoes.length === 0) return { x: 0, y: 0, largura: 0, altura: 0 };
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
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
}

export type ModoDoCartao = "cartao" | "mapa";

export interface EnquadramentoComModo extends Enquadramento {
  /** Modo em que o layout vai ficar DEPOIS deste enquadramento. */
  modo: ModoDoCartao;
}

/**
 * O enquadramento e o MODO do cartão são um ponto fixo, não duas contas
 * independentes: a altura do cartão muda com o modo (180 × 44 — achado MÉDIO
 * #6), a altura muda a caixa, a caixa muda o zoom, e o zoom decide o modo.
 * Enquadrar com a caixa do modo ERRADO é o que fazia "Ver tudo" bater no piso
 * de zoom com 40 tarefas.
 *
 * Resolve em três passos, sem laço: tenta cartão; se o zoom cair abaixo do
 * corte, tenta mapa; se o mapa devolvesse zoom ACIMA do corte (a fatia
 * ambígua, onde os dois modos se contradizem), fica no MAPA logo abaixo do
 * corte — o modo que cabe, nunca o que oscila.
 */
export function enquadramentoComModo(params: {
  caixaParaAltura: (altura: number) => Caixa;
  pane: Pane;
  opcoes: OpcoesDeEnquadramento;
  alturaCartao: number;
  alturaMapa: number;
  zoomDoModoMapa?: number;
}): EnquadramentoComModo {
  const corte = params.zoomDoModoMapa ?? ZOOM_DO_MODO_MAPA;
  const cartao = enquadramentoPara(params.caixaParaAltura(params.alturaCartao), params.pane, params.opcoes);
  if (cartao.zoom >= corte) return { ...cartao, modo: "cartao" };

  const caixaMapa = params.caixaParaAltura(params.alturaMapa);
  const mapa = enquadramentoPara(caixaMapa, params.pane, params.opcoes);
  if (mapa.zoom < corte) return { ...mapa, modo: "mapa" };

  // Fatia ambígua: no layout de mapa caberia acima do corte (voltando a
  // cartão), mas no de cartão não cabe. Fica no mapa, no maior zoom que ainda
  // É mapa — estável, e cabe com folga.
  const abaixoDoCorte = enquadramentoPara(caixaMapa, params.pane, {
    ...params.opcoes,
    zoomMax: Math.max(params.opcoes.zoomMin ?? ZOOM_MINIMO, corte - 0.001),
  });
  return { ...abaixoDoCorte, modo: "mapa" };
}
