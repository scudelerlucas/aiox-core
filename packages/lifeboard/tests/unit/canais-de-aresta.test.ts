import { describe, expect, it } from "vitest";

import { layoutDoGrafo, type ArestaDoLayout, type ArestaParaRotear } from "@/lib/layout-do-grafo";
import { arestasDo11, arvore200, cadeia200, FIXTURE_11, grafo40 } from "./cenarios-do-grafo";

/**
 * OS-LIFEBOARD · P4f — a medição do achado ALTO #3 (decisão D5), a do CRÍTICO.
 *
 * O que ele mediu na rodada 4: todas as arestas que cruzavam o mesmo vão
 * usavam a MESMA cota (`midY = rank·228 + 186`). Resultado: uma correlação
 * 100% escondida sob uma obsolescência (mesmo par de nós, mesma rota, ponto a
 * ponto) e uma sucessão a 0,48px de uma correlação — duas linhas que o olho lê
 * como uma.
 *
 * A régua, literal: **para todo par de arestas, o comprimento de segmento
 * COLINEAR SOBREPOSTO (mesmo y ± 1px com x sobreposto, ou mesmo x ± 1px com y
 * sobreposto) é 0 px.** Não "é pequeno", não "melhorou": zero. Encostar ponta
 * com ponta é permitido (comprimento 0); correr junto, não.
 */

const TOLERANCIA_MESMA_LINHA = 1;

interface Segmento {
  aresta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function segmentosDe(edges: readonly ArestaDoLayout[]): Segmento[] {
  const saida: Segmento[] = [];
  for (const e of edges) {
    for (let i = 0; i < e.pontos.length - 1; i++) {
      const a = e.pontos[i]!;
      const b = e.pontos[i + 1]!;
      saida.push({ aresta: e.id, x0: a.x, y0: a.y, x1: b.x, y1: b.y });
    }
  }
  return saida;
}

function sobreposicao(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1)));
}

interface Colisao {
  a: string;
  b: string;
  px: number;
}

/** Todo par de arestas × todo par de segmentos: quanto correm COLADOS. */
function colisoesColineares(edges: readonly ArestaDoLayout[]): Colisao[] {
  const segs = segmentosDe(edges);
  const colisoes: Colisao[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    const sHorizontal = Math.abs(s.y1 - s.y0) < 1e-9;
    const sVertical = Math.abs(s.x1 - s.x0) < 1e-9;
    for (let j = i + 1; j < segs.length; j++) {
      const t = segs[j]!;
      if (t.aresta === s.aresta) continue;
      const tHorizontal = Math.abs(t.y1 - t.y0) < 1e-9;
      const tVertical = Math.abs(t.x1 - t.x0) < 1e-9;
      let px = 0;
      if (sHorizontal && tHorizontal && Math.abs(s.y0 - t.y0) <= TOLERANCIA_MESMA_LINHA) {
        px = sobreposicao(s.x0, s.x1, t.x0, t.x1);
      } else if (sVertical && tVertical && Math.abs(s.x0 - t.x0) <= TOLERANCIA_MESMA_LINHA) {
        px = sobreposicao(s.y0, s.y1, t.y0, t.y1);
      }
      if (px > 0) colisoes.push({ a: s.aresta, b: t.aresta, px: Math.round(px * 100) / 100 });
    }
  }
  return colisoes;
}

function rotear(params: {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: ArestaParaRotear[];
  criticoIds?: string[];
  maxColunas: number;
}): ArestaDoLayout[] {
  return layoutDoGrafo(params).edges;
}

const ARESTAS_11: ArestaParaRotear[] = [
  ...arestasDo11(),
  // O caso EXATO do achado: duas arestas de camadas diferentes sobre o MESMO
  // par de nós. Na rodada 4 as duas recebiam a mesma rota — a de baixo sumia.
  { id: "correlacao:setup-build", origem: "task-setup", destino: "task-build" },
  { id: "obsolescencia:setup-build", origem: "task-setup", destino: "task-build" },
];

describe("canais — 0 px de segmento colinear sobreposto entre duas arestas", () => {
  it("fixture de 11 tarefas (6 colunas), com duas camadas sobre o MESMO par", () => {
    const edges = rotear({
      ids: FIXTURE_11.ids,
      edges: FIXTURE_11.edges,
      todasArestas: ARESTAS_11,
      criticoIds: FIXTURE_11.criticoIds,
      maxColunas: 6,
    });
    expect(colisoesColineares(edges)).toEqual([]);
  });

  it("fixture de 11 tarefas a 3 colunas (390px de pane)", () => {
    const edges = rotear({
      ids: FIXTURE_11.ids,
      edges: FIXTURE_11.edges,
      todasArestas: ARESTAS_11,
      criticoIds: FIXTURE_11.criticoIds,
      maxColunas: 3,
    });
    expect(colisoesColineares(edges)).toEqual([]);
  });

  it("40 tarefas, 6 e 3 colunas", () => {
    for (const maxColunas of [6, 3]) {
      const edges = rotear({ ...grafo40(), maxColunas });
      expect(colisoesColineares(edges)).toEqual([]);
    }
  });

  it("200 tarefas em CADEIA", () => {
    expect(colisoesColineares(rotear({ ...cadeia200(), maxColunas: 6 }))).toEqual([]);
  });

  it("200 tarefas em ÁRVORE", () => {
    expect(colisoesColineares(rotear({ ...arvore200(), maxColunas: 6 }))).toEqual([]);
  });

  it("a própria medição pega uma colisão quando ela existe (falsificador da régua)", () => {
    // Duas arestas desenhadas na MESMA cota — o desenho da rodada 4 em
    // miniatura. Se `colisoesColineares` devolvesse [] aqui, os testes acima
    // não provariam nada.
    const comColisao: ArestaDoLayout[] = [
      { id: "a", origem: "x", destino: "y", pontos: [{ x: 0, y: 10 }, { x: 100, y: 10 }] },
      { id: "b", origem: "x", destino: "y", pontos: [{ x: 40, y: 10.4 }, { x: 140, y: 10.4 }] },
    ];
    expect(colisoesColineares(comColisao)).toEqual([{ a: "a", b: "b", px: 60 }]);
  });

  it("duas arestas que só ENCOSTAM ponta com ponta não contam (sobreposição 0)", () => {
    const encostadas: ArestaDoLayout[] = [
      { id: "a", origem: "x", destino: "y", pontos: [{ x: 0, y: 10 }, { x: 50, y: 10 }] },
      { id: "b", origem: "y", destino: "z", pontos: [{ x: 50, y: 10 }, { x: 90, y: 10 }] },
    ];
    expect(colisoesColineares(encostadas)).toEqual([]);
  });
});
