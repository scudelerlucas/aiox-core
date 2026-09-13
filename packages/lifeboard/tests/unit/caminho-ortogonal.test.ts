import { describe, expect, it } from "vitest";

import { geometriaDoTraco } from "@/components/graph/v3-edge";
import { layoutDoGrafo, type ArestaParaRotear, type NoDoLayout, type Ponto } from "@/lib/layout-do-grafo";
import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

import { arestasDo11, arvore200, cadeia200, FIXTURE_11, grafo40 } from "./cenarios-do-grafo";

/**
 * OS-LIFEBOARD · P4f — a rota REAL × o retângulo dos cartões.
 *
 * A régua é geométrica: interseção SEGMENTO × RETÂNGULO contra TODOS os
 * cartões, e não "nenhum vértice dentro de um cartão" (a régua frouxa de duas
 * rodadas atrás, que aprovou um path atravessando o cartão do meio de ponta a
 * ponta). Roda no fixture da casa, no cenário de 40 tarefas (o mesmo da
 * medição no navegador) e em 200 tarefas sintéticas, em CADEIA e em ÁRVORE.
 *
 * Desde a rodada 5 a rota não é mais escolhida pelo renderer: ela sai inteira
 * de `layoutDoGrafo` (canais + faixas, decisão D5). Este arquivo consome o
 * mesmo `pontos` que o `<V3Edge>` desenha — não há segunda geometria para
 * divergir.
 */

const NODE_W = 200;
const NODE_H = ALTURA_DO_CARTAO;
/** Cartão é FECHADO na borda (a borda é o handle) — o interior começa 0,01px dentro. */
const EPS = 0.01;

interface Retangulo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function retanguloDo(n: NoDoLayout): Retangulo {
  return { x0: n.x, y0: n.y, x1: n.x + NODE_W, y1: n.y + NODE_H };
}

/**
 * Comprimento do pedaço de `p→q` que cai DENTRO de `r` (clipping de
 * Liang–Barsky). O retângulo é encolhido `EPS` de cada lado: um segmento que
 * corre exatamente sobre a borda (o pé da aresta, que nasce nela) não conta
 * como invasão; só o interior conta. 0 = não invade.
 */
function comprimentoDentro(p: Ponto, q: Ponto, r: Retangulo): number {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (denominador: number, numerador: number): boolean => {
    if (Math.abs(denominador) < 1e-12) return numerador >= 0;
    const t = numerador / denominador;
    if (denominador < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  if (!clip(-dx, p.x - (r.x0 + EPS))) return 0;
  if (!clip(dx, r.x1 - EPS - p.x)) return 0;
  if (!clip(-dy, p.y - (r.y0 + EPS))) return 0;
  if (!clip(dy, r.y1 - EPS - p.y)) return 0;
  if (t1 <= t0) return 0;
  return Math.hypot(dx, dy) * (t1 - t0);
}

function segmentosZero(pontos: readonly Ponto[]): number {
  let n = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i]!;
    const b = pontos[i + 1]!;
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) n++;
  }
  return n;
}

interface Invasao {
  aresta: string;
  cartao: string;
  px: number;
}

/** Roda o pipeline REAL e devolve toda invasão de segmento em cartão. */
function invasoes(params: {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: ArestaParaRotear[];
  criticoIds?: string[];
  maxColunas?: number;
}): { lista: Invasao[]; arestasMedidas: number } {
  const { nodes, edges } = layoutDoGrafo(params);
  const lista: Invasao[] = [];
  let arestasMedidas = 0;
  for (const aresta of edges) {
    arestasMedidas++;
    expect(segmentosZero(aresta.pontos)).toBe(0);
    for (const [id, n] of nodes) {
      const r = retanguloDo(n);
      for (let i = 0; i < aresta.pontos.length - 1; i++) {
        const dentro = comprimentoDentro(aresta.pontos[i]!, aresta.pontos[i + 1]!, r);
        if (dentro > 0) lista.push({ aresta: aresta.id, cartao: id, px: Math.round(dentro) });
      }
    }
  }
  return { lista, arestasMedidas };
}

describe("rota do layout × cartão (segmento, não vértice)", () => {
  it("fixture de 11 tarefas, 6 colunas: 0 px de segmento dentro de QUALQUER cartão", () => {
    const { lista, arestasMedidas } = invasoes({
      ids: FIXTURE_11.ids,
      edges: FIXTURE_11.edges,
      todasArestas: arestasDo11(),
      criticoIds: FIXTURE_11.criticoIds,
      maxColunas: 6,
    });
    expect(arestasMedidas).toBe(7);
    expect(lista).toEqual([]);
  });

  it("fixture de 11 tarefas a 3 colunas (390px de pane): 0 px", () => {
    const { lista } = invasoes({
      ids: FIXTURE_11.ids,
      edges: FIXTURE_11.edges,
      todasArestas: arestasDo11(),
      criticoIds: FIXTURE_11.criticoIds,
      maxColunas: 3,
    });
    expect(lista).toEqual([]);
  });

  it("40 tarefas (o cenário da medição), 6 e 3 colunas: 0 px", () => {
    for (const maxColunas of [6, 3]) {
      const { lista, arestasMedidas } = invasoes({ ...grafo40(), maxColunas });
      expect(arestasMedidas).toBeGreaterThan(40);
      expect(lista).toEqual([]);
    }
  });

  it("200 tarefas em CADEIA (saltos à frente, saltos para trás e a volta inteira): 0 px", () => {
    const { lista, arestasMedidas } = invasoes({ ...cadeia200(), maxColunas: 6 });
    expect(arestasMedidas).toBe(cadeia200().todasArestas.length);
    expect(lista).toEqual([]);
  });

  it("200 tarefas em ÁRVORE (irmãos, primos, avô→neto e neto→avô): 0 px", () => {
    const { lista, arestasMedidas } = invasoes({ ...arvore200(), maxColunas: 6 });
    expect(arestasMedidas).toBe(arvore200().todasArestas.length);
    expect(lista).toEqual([]);
  });
});

describe("geometriaDoTraco — o que o renderer ainda decide", () => {
  it("o rótulo ancora no ponto médio do segmento MAIS LONGO — nunca no 'toco' curto de um desvio", () => {
    const pontos: Ponto[] = [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 300, y: 40 },
      { x: 300, y: 60 },
    ];
    const { midX, midY } = geometriaDoTraco(pontos);
    expect(midX).toBeCloseTo(150, 5);
    expect(midY).toBeCloseTo(40, 5);
  });

  it("o `d` é o polígono da rota, ponto a ponto — sem curva e sem geometria inventada", () => {
    const { path } = geometriaDoTraco([
      { x: 1, y: 2 },
      { x: 1, y: 5 },
      { x: 9, y: 5 },
    ]);
    expect(path).toBe("M1,2 L1,5 L9,5");
  });

  it("aresta predominantemente vertical desloca o traço triplo em X (senão as 3 linhas viram 1)", () => {
    expect(
      geometriaDoTraco([
        { x: 0, y: 0 },
        { x: 0, y: 300 },
      ]).eixoDeslocamento,
    ).toBe("x");
    expect(
      geometriaDoTraco([
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ]).eixoDeslocamento,
    ).toBe("y");
  });
});
