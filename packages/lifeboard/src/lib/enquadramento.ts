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

// ─────────────────────────────────────────────────────────────────────────────
// P4h (achado ALTO #2 do crítico hostil ROUND 7): no PISO do zoom, CENTRAR
// mostra MENOS do que já estava na tela.
//
// O que ele mediu, com o MESMO zoom antes e depois (0,500) — só o pan mudou:
// 40@390 caiu de 27/40 (4/4 críticos) para 24/40 (3/4); 200@1280 de 26 para
// 20 e de 2 para 1 crítico; 200@1440 de 26 para 20. O chip era honesto ("24 de
// 40 na tela"); o BOTÃO não.
//
// A causa é de uma linha: `enquadramentoPara` põe o CENTRO da caixa no centro
// do pane. Quando a caixa é MAIOR que o pane isso corta as DUAS pontas —
// encostar numa borda deixaria mais cartões INTEIROS. Centrar só é ótimo
// quando cabe (e aí o pan nem importa).
//
// Decisão fixa da rodada 8: no piso de zoom o enquadramento **maximiza
// cartões inteiros visíveis**, com desempate pelo caminho crítico, e nunca
// entrega menos do que o estado que ele substitui (o pan atual entra como
// candidato).
// ─────────────────────────────────────────────────────────────────────────────

/** Quantos cartões cabem INTEIROS, e quantos deles são do caminho crítico. */
export interface PlacarDeCartoes {
  inteiros: number;
  criticos: number;
}

export function placarDeCartoes(
  cartoes: readonly CartaoNaTela[],
  viewport: Viewport,
  pane: Pane,
  criticoIds: ReadonlySet<string> = new Set(),
  tolerancia: number = TOLERANCIA_DE_CONTENCAO_PX,
): PlacarDeCartoes {
  const fora = new Set(cartoesForaDaTela(cartoes, viewport, pane, tolerancia));
  let inteiros = 0;
  let criticos = 0;
  for (const c of cartoes) {
    if (fora.has(c.id)) continue;
    inteiros += 1;
    if (criticoIds.has(c.id)) criticos += 1;
  }
  return { inteiros, criticos };
}

/** Qual placar vale mais, dado o que o operador pediu. */
export type PrioridadeDoPan = "inteiros" | "criticos";

function melhorQue(a: PlacarDeCartoes, b: PlacarDeCartoes, prioridade: PrioridadeDoPan): boolean {
  if (prioridade === "criticos") {
    if (a.criticos !== b.criticos) return a.criticos > b.criticos;
    return a.inteiros > b.inteiros;
  }
  if (a.inteiros !== b.inteiros) return a.inteiros > b.inteiros;
  return a.criticos > b.criticos;
}

/**
 * Candidatos de deslocamento num eixo: os pontos em que ALGUMA ponta de cartão
 * encosta numa borda do pane. O conjunto de cartões contidos é constante por
 * pedaço em `x` (e em `y`), e todo pedaço termina exatamente num desses
 * pontos — então o ótimo está sempre aqui dentro. Varrer o contínuo não
 * acharia nada melhor.
 */
function candidatosDoEixo(
  inicios: readonly number[],
  tamanhos: readonly number[],
  zoom: number,
  medidaDoPane: number,
): number[] {
  const vistos = new Set<number>();
  const saida: number[] = [];
  const guardar = (v: number): void => {
    const chave = Math.round(v * 1000) / 1000;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    saida.push(chave);
  };
  for (let i = 0; i < inicios.length; i++) {
    guardar(-inicios[i]! * zoom);
    guardar(medidaDoPane - (inicios[i]! + tamanhos[i]!) * zoom);
  }
  return saida;
}

/** Bitset simples (Uint32Array) — a interseção de dois eixos é um `and`. */
function mascaraDoEixo(
  candidato: number,
  inicios: readonly number[],
  tamanhos: readonly number[],
  zoom: number,
  medidaDoPane: number,
  tolerancia: number,
  palavras: number,
): Uint32Array {
  const m = new Uint32Array(palavras);
  for (let i = 0; i < inicios.length; i++) {
    const a = inicios[i]! * zoom + candidato;
    const b = a + tamanhos[i]! * zoom;
    if (a >= -tolerancia && b <= medidaDoPane + tolerancia) {
      m[i >>> 5]! |= 1 << (i & 31);
    }
  }
  return m;
}

function contarBits(x: number): number {
  let v = x - ((x >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  v = (v + (v >>> 4)) & 0x0f0f0f0f;
  return (v * 0x01010101) >>> 24;
}

/**
 * O pan `(x, y)` que deixa o MAIOR número de cartões inteiros na tela, no zoom
 * dado. Desempate: mais nós do caminho crítico (ou o contrário, quando o alvo
 * é o próprio caminho crítico). `panAtual`, quando vem, entra como candidato —
 * é o que garante que o botão nunca PIORE o que já estava na tela.
 */
export function panQueMaximizaCartoesInteiros(params: {
  cartoes: readonly CartaoNaTela[];
  zoom: number;
  pane: Pane;
  criticoIds?: ReadonlySet<string>;
  prioridade?: PrioridadeDoPan;
  panAtual?: { x: number; y: number };
  tolerancia?: number;
}): { x: number; y: number; placar: PlacarDeCartoes } {
  const { cartoes, zoom, pane } = params;
  const criticoIds = params.criticoIds ?? new Set<string>();
  const prioridade = params.prioridade ?? "inteiros";
  const tolerancia = params.tolerancia ?? TOLERANCIA_DE_CONTENCAO_PX;
  const n = cartoes.length;
  if (n === 0) return { x: 0, y: 0, placar: { inteiros: 0, criticos: 0 } };

  const palavras = Math.ceil(n / 32);
  const xs = cartoes.map((c) => c.x);
  const ws = cartoes.map((c) => c.largura);
  const ys = cartoes.map((c) => c.y);
  const hs = cartoes.map((c) => c.altura);
  const critMask = new Uint32Array(palavras);
  for (let i = 0; i < n; i++) {
    if (criticoIds.has(cartoes[i]!.id)) critMask[i >>> 5]! |= 1 << (i & 31);
  }

  const candX = candidatosDoEixo(xs, ws, zoom, pane.largura);
  const candY = candidatosDoEixo(ys, hs, zoom, pane.altura);
  if (params.panAtual) {
    candX.push(params.panAtual.x);
    candY.push(params.panAtual.y);
  }

  const masksX = candX.map((c) => mascaraDoEixo(c, xs, ws, zoom, pane.largura, tolerancia, palavras));
  const masksY = candY.map((c) => mascaraDoEixo(c, ys, hs, zoom, pane.altura, tolerancia, palavras));

  let melhorX = candX[0] ?? 0;
  let melhorY = candY[0] ?? 0;
  let melhorPlacar: PlacarDeCartoes = { inteiros: -1, criticos: -1 };
  for (let i = 0; i < candX.length; i++) {
    const mx = masksX[i]!;
    for (let j = 0; j < candY.length; j++) {
      const my = masksY[j]!;
      let inteiros = 0;
      let criticos = 0;
      for (let p = 0; p < palavras; p++) {
        const bits = mx[p]! & my[p]!;
        if (bits === 0) continue;
        inteiros += contarBits(bits);
        criticos += contarBits(bits & critMask[p]!);
      }
      const placar = { inteiros, criticos };
      if (melhorQue(placar, melhorPlacar, prioridade)) {
        melhorPlacar = placar;
        melhorX = candX[i]!;
        melhorY = candY[j]!;
      }
    }
  }
  return { x: melhorX, y: melhorY, placar: melhorPlacar };
}

/**
 * O enquadramento que o BOTÃO aplica: `enquadramentoComModo` decide zoom e
 * modo (o ponto fixo altura→caixa→zoom→modo), e quando a caixa NÃO cabe
 * inteira o pan deixa de centrar e passa a MAXIMIZAR cartões inteiros.
 *
 * Quando cabe inteiro, centrar é o ótimo (todos os cartões estão na tela em
 * qualquer pan válido) e nada muda — os testes de D1/D2 da rodada 6 continuam
 * valendo letra por letra.
 */
export function enquadramentoDoAlvo(params: {
  cartoesParaAltura: (altura: number) => CartaoNaTela[];
  pane: Pane;
  opcoes: OpcoesDeEnquadramento;
  alturaCartao: number;
  alturaMapa: number;
  criticoIds?: ReadonlySet<string>;
  prioridade?: PrioridadeDoPan;
  /** Viewport vivo. Só é usado quando o zoom não muda — aí o pan atual é candidato. */
  viewportAtual?: Viewport;
  zoomDoModoMapa?: number;
}): EnquadramentoComModo {
  const base = enquadramentoComModo({
    caixaParaAltura: (altura) => caixaDosCartoes(params.cartoesParaAltura(altura)),
    pane: params.pane,
    opcoes: params.opcoes,
    alturaCartao: params.alturaCartao,
    alturaMapa: params.alturaMapa,
    zoomDoModoMapa: params.zoomDoModoMapa,
  });
  if (base.cabeInteiro) return base;

  const cartoes = params.cartoesParaAltura(
    base.modo === "mapa" ? params.alturaMapa : params.alturaCartao,
  );
  const mesmoZoom =
    params.viewportAtual !== undefined &&
    Math.abs(params.viewportAtual.zoom - base.zoom) < 1e-6;
  const { x, y } = panQueMaximizaCartoesInteiros({
    cartoes,
    zoom: base.zoom,
    pane: params.pane,
    criticoIds: params.criticoIds,
    prioridade: params.prioridade,
    panAtual: mesmoZoom ? { x: params.viewportAtual!.x, y: params.viewportAtual!.y } : undefined,
  });
  return { ...base, x, y };
}
