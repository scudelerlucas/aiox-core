import { describe, expect, it } from "vitest";

import { caminhoOrtogonal } from "@/components/graph/v3-edge";
import { layoutDoGrafo, type NoDoLayout } from "@/lib/layout-do-grafo";
import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

/**
 * OS-LIFEBOARD · P4e — achado ALTO #3 + BAIXO #7 do crítico hostil ROUND 4.
 *
 * A rodada 3 checava só os VÉRTICES do `d` ("nenhum ponto dentro de um
 * retângulo"), e por isso aprovou um path que atravessava o cartão do meio de
 * ponta a ponta: os dois vértices do segmento ficavam de fora, o SEGMENTO
 * inteiro passava por dentro (medido no caso `r2→r0`: `M100,392 L100,154 …`,
 * 222px dentro de `r1`). Aqui a régua passa a ser geométrica de verdade —
 * interseção SEGMENTO × RETÂNGULO — contra TODOS os cartões alheios, nos 3
 * casos de rank (adiante / para trás / mesmo rank) e em 200 tarefas sintéticas
 * em CADEIA e em ÁRVORE.
 *
 * Achado BAIXO #7 da mesma rodada: este arquivo tinha `const NODE_H = 112`
 * hardcoded — o mesmo defeito que `ALTURA_DO_CARTAO` existe para matar. Agora
 * importa o token; se o cartão mudar de altura, este teste muda junto (ou
 * quebra, que é o ponto).
 */

const NODE_W = 200;
const NODE_H = ALTURA_DO_CARTAO;
/** Cartão é FECHADO na borda (a borda é o handle) — o interior começa 0,01px dentro. */
const EPS = 0.01;

interface Ponto {
  x: number;
  y: number;
}
interface Retangulo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Espelha `handlesDaConexao` (`dependency-graph.tsx`) — mesma regra de rank relativo. */
function pontosDaConexao(
  origem: NoDoLayout,
  destino: NoDoLayout,
): { sourceX: number; sourceY: number; targetX: number; targetY: number } {
  const sourceX = origem.x + NODE_W / 2;
  const targetX = destino.x + NODE_W / 2;
  if (destino.rank > origem.rank) {
    return { sourceX, sourceY: origem.y + NODE_H, targetX, targetY: destino.y };
  }
  if (destino.rank === origem.rank) {
    return { sourceX, sourceY: origem.y, targetX, targetY: destino.y };
  }
  return { sourceX, sourceY: origem.y, targetX, targetY: destino.y + NODE_H };
}

/** Parseia `d="M x,y L x,y L x,y …"` de volta em pontos, para inspeção no teste. */
function parsearPath(d: string): Ponto[] {
  return d
    .trim()
    .split(/(?=[ML])/)
    .filter(Boolean)
    .map((token) => {
      const [x, y] = token.slice(1).split(",").map(Number);
      return { x: x!, y: y! };
    });
}

function segmentosZero(pontos: Ponto[]): number {
  let n = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i]!;
    const b = pontos[i + 1]!;
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) n++;
  }
  return n;
}

function retanguloDo(n: NoDoLayout): Retangulo {
  return { x0: n.x, y0: n.y, x1: n.x + NODE_W, y1: n.y + NODE_H };
}

/**
 * Comprimento do pedaço de `p→q` que cai DENTRO de `r` (clipping de
 * Liang–Barsky). O retângulo é encolhido `EPS` de cada lado: um segmento que
 * corre exatamente sobre a borda (o handle, ou o corredor rente à fileira) não
 * conta como invasão; só o interior conta. 0 = não invade.
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

/** Distância mínima de um segmento `p→q` ao retângulo `r` (0 se encosta/invade). */
function distanciaAoRetangulo(p: Ponto, q: Ponto, r: Retangulo): number {
  const amostras = 200;
  let minimo = Infinity;
  for (let i = 0; i <= amostras; i++) {
    const t = i / amostras;
    const x = p.x + (q.x - p.x) * t;
    const y = p.y + (q.y - p.y) * t;
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dy = Math.max(r.y0 - y, 0, y - r.y1);
    minimo = Math.min(minimo, Math.hypot(dx, dy));
  }
  return minimo;
}

interface Invasao {
  aresta: string;
  cartao: string;
  px: number;
}

/**
 * Roda o pipeline REAL (layout → escolha de handle por rank → `caminhoOrtogonal`)
 * sobre um grafo e devolve toda invasão de segmento em cartão alheio.
 */
function invasoes(params: {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: { origem: string; destino: string }[];
}): { lista: Invasao[]; arestasMedidas: number } {
  const { nodes, edges } = layoutDoGrafo({
    ids: params.ids,
    edges: params.edges,
    todasArestas: params.todasArestas,
  });
  const lista: Invasao[] = [];
  let arestasMedidas = 0;
  for (const aresta of edges) {
    const o = nodes.get(aresta.origem);
    const d = nodes.get(aresta.destino);
    if (!o || !d) continue;
    arestasMedidas++;
    const { sourceX, sourceY, targetX, targetY } = pontosDaConexao(o, d);
    const { path } = caminhoOrtogonal(
      sourceX,
      sourceY,
      targetX,
      targetY,
      aresta.desviar ? aresta.desvioPx : undefined,
      aresta.desvioYInicio,
      aresta.desvioYFim,
    );
    const pontos = parsearPath(path);
    expect(segmentosZero(pontos)).toBe(0);
    for (const [id, n] of nodes) {
      if (id === aresta.origem || id === aresta.destino) continue;
      const r = retanguloDo(n);
      for (let i = 0; i < pontos.length - 1; i++) {
        const dentro = comprimentoDentro(pontos[i]!, pontos[i + 1]!, r);
        if (dentro > 0) {
          lista.push({ aresta: `${aresta.origem}→${aresta.destino}`, cartao: id, px: Math.round(dentro) });
        }
      }
    }
  }
  return { lista, arestasMedidas };
}

describe("caminhoOrtogonal — SEGMENTO × cartão alheio (não só vértice)", () => {
  it("aresta ADIANTE (setup→build): path sem segmento zero, nenhum segmento dentro de cartão algum", () => {
    const { lista, arestasMedidas } = invasoes({
      ids: ["setup", "build", "solto"],
      edges: [{ origem: "setup", destino: "build" }],
      todasArestas: [{ origem: "setup", destino: "build" }],
    });
    expect(arestasMedidas).toBe(1);
    expect(lista).toEqual([]);
  });

  it("aresta PARA TRÁS que pula rank (r2→r0, contornando r1): 0 px de segmento dentro de r1 — era 222 px", () => {
    const idsBack = ["r0", "r1", "r2"];
    const edgesForward = [
      { origem: "r0", destino: "r1" },
      { origem: "r1", destino: "r2" },
    ];
    const { nodes, edges } = layoutDoGrafo({
      ids: idsBack,
      edges: edgesForward,
      todasArestas: [...edgesForward, { origem: "r2", destino: "r0" }],
    });
    const r0 = nodes.get("r0")!;
    const r1 = nodes.get("r1")!;
    const r2 = nodes.get("r2")!;
    const voltando = edges.find((e) => e.origem === "r2" && e.destino === "r0")!;
    expect(voltando.desviar).toBe(true);
    const { sourceX, sourceY, targetX, targetY } = pontosDaConexao(r2, r0);
    const { path } = caminhoOrtogonal(
      sourceX,
      sourceY,
      targetX,
      targetY,
      voltando.desvioPx,
      voltando.desvioYInicio,
      voltando.desvioYFim,
    );
    const pontos = parsearPath(path);
    expect(segmentosZero(pontos)).toBe(0);

    // A prova da ORDEM DE PERCURSO (achado ALTO #3): o primeiro cotovelo é o
    // canto PERTO DA ORIGEM — abaixo de r1, nunca do outro lado do vão.
    expect(pontos[1]!.y).toBeGreaterThan(r1.y + NODE_H);
    expect(pontos[1]!.y).toBeLessThan(sourceY);

    for (const n of [r0, r1, r2]) {
      const r = retanguloDo(n);
      for (let i = 0; i < pontos.length - 1; i++) {
        expect(comprimentoDentro(pontos[i]!, pontos[i + 1]!, r)).toBe(0);
      }
    }
  });

  it("aresta de MESMO rank (a→z, por cima de 'meio'): corredor acima da fileira, ≥ 8 px de qualquer cartão alheio", () => {
    const { nodes, edges } = layoutDoGrafo({
      ids: ["a", "meio", "z"],
      edges: [],
      todasArestas: [{ origem: "a", destino: "z" }],
    });
    const a = nodes.get("a")!;
    const meio = nodes.get("meio")!;
    const z = nodes.get("z")!;
    const aZ = edges.find((e) => e.origem === "a" && e.destino === "z")!;
    const { sourceX, sourceY, targetX, targetY } = pontosDaConexao(a, z);
    const { path } = caminhoOrtogonal(
      sourceX,
      sourceY,
      targetX,
      targetY,
      aZ.desviar ? aZ.desvioPx : undefined,
      aZ.desvioYInicio,
      aZ.desvioYFim,
    );
    const pontos = parsearPath(path);
    expect(segmentosZero(pontos)).toBe(0);
    // Dois cotovelos: sobe, atravessa, desce (4 pontos).
    expect(pontos.length).toBe(4);
    // O corredor corre ACIMA do topo da fileira — nunca rente a ele (era 2,5px).
    const yCorredor = pontos[1]!.y;
    expect(a.y - yCorredor).toBeGreaterThanOrEqual(24);

    const rMeio = retanguloDo(meio);
    let menorDistancia = Infinity;
    for (let i = 0; i < pontos.length - 1; i++) {
      expect(comprimentoDentro(pontos[i]!, pontos[i + 1]!, rMeio)).toBe(0);
      menorDistancia = Math.min(menorDistancia, distanciaAoRetangulo(pontos[i]!, pontos[i + 1]!, rMeio));
    }
    expect(menorDistancia).toBeGreaterThanOrEqual(8);
  });

  it("200 tarefas em CADEIA (com saltos à frente, saltos para trás e o caminho de volta): 0 cruzamentos segmento × cartão", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `c${String(i).padStart(3, "0")}`);
    const edges = ids.slice(0, -1).map((id, i) => ({ origem: id, destino: ids[i + 1]! }));
    const extras: { origem: string; destino: string }[] = [];
    for (let i = 0; i + 4 < ids.length; i += 7) {
      extras.push({ origem: ids[i]!, destino: ids[i + 4]! }); // salto à frente
      extras.push({ origem: ids[i + 4]!, destino: ids[i]! }); // volta pelo mesmo vão
    }
    extras.push({ origem: ids[199]!, destino: ids[0]! }); // a volta mais longa possível
    const { lista, arestasMedidas } = invasoes({ ids, edges, todasArestas: [...edges, ...extras] });
    expect(arestasMedidas).toBe(edges.length + extras.length);
    expect(lista).toEqual([]);
  });

  it("200 tarefas em ÁRVORE (irmãos de mesmo rank, primos, avô→neto e neto→avô): 0 cruzamentos segmento × cartão", () => {
    const ids: string[] = [];
    const edges: { origem: string; destino: string }[] = [];
    const RAMO = 3;
    ids.push("n000");
    for (let i = 1; ids.length < 200; i++) {
      const pai = ids[Math.floor((i - 1) / RAMO)]!;
      const id = `n${String(i).padStart(3, "0")}`;
      ids.push(id);
      edges.push({ origem: pai, destino: id });
    }
    const extras: { origem: string; destino: string }[] = [];
    for (let i = 4; i + 1 < ids.length; i += 5) {
      extras.push({ origem: ids[i]!, destino: ids[i + 1]! }); // irmão/primo — mesmo rank ou vizinho
      extras.push({ origem: ids[i + 1]!, destino: ids[i]! }); // e a volta
    }
    for (let i = 40; i + 0 < ids.length; i += 11) {
      extras.push({ origem: ids[0]!, destino: ids[i]! }); // raiz → neto distante
      extras.push({ origem: ids[i]!, destino: ids[0]! }); // neto distante → raiz
    }
    const { lista, arestasMedidas } = invasoes({ ids, edges, todasArestas: [...edges, ...extras] });
    expect(arestasMedidas).toBe(edges.length + extras.length);
    expect(lista).toEqual([]);
  });

  it("rótulo ancora no ponto médio do segmento MAIS LONGO — nunca no 'toco' curto de um desvio", () => {
    const { midX, midY, path } = caminhoOrtogonal(0, 0, 500, 300, 40, 2, 6);
    const pontos = parsearPath(path);
    let maiorA = pontos[0]!;
    let maiorB = pontos[1]!;
    let maior = -1;
    for (let i = 0; i < pontos.length - 1; i++) {
      const p1 = pontos[i]!;
      const p2 = pontos[i + 1]!;
      const c = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (c > maior) {
        maior = c;
        maiorA = p1;
        maiorB = p2;
      }
    }
    expect(midX).toBeCloseTo((maiorA.x + maiorB.x) / 2, 5);
    expect(midY).toBeCloseTo((maiorA.y + maiorB.y) / 2, 5);
  });
});
