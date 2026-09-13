import { describe, expect, it } from "vitest";

import { caminhoOrtogonal } from "@/components/graph/v3-edge";
import { layoutDoGrafo, type NoDoLayout } from "@/lib/layout-do-grafo";

/**
 * OS-LIFEBOARD · P4d — achado MÉDIO #6 do crítico hostil ROUND 3: "teste
 * unitário do `d` de `caminhoOrtogonal` (número de pontos, nenhum segmento
 * zero, nenhum ponto dentro de retângulo de cartão alheio no fixture)".
 *
 * `caminhoOrtogonal` é uma função PURA (sem React/reactflow) — chamada direto,
 * com as MESMAS coordenadas que `layoutDoGrafo` + a escolha de handle por rank
 * relativo (`handlesDaConexao`, em `dependency-graph.tsx`) produziriam em
 * produção. Replicar a escolha de handle aqui (em vez de importar a função
 * privada do componente) é deliberado: prova que os DOIS lugares (o cálculo
 * de geometria em `layout-do-grafo.ts` e a montagem do path aqui) concordam
 * sobre qual ponto é a saída/entrada real.
 */

const NODE_W = 200;
const NODE_H = 112;

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
function parsearPath(d: string): { x: number; y: number }[] {
  return d
    .trim()
    .split(/(?=[ML])/)
    .filter(Boolean)
    .map((token) => {
      const [x, y] = token.slice(1).split(",").map(Number);
      return { x: x!, y: y! };
    });
}

function segmentosZero(pontos: { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i]!;
    const b = pontos[i + 1]!;
    if (Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01) n++;
  }
  return n;
}

/** `true` se `p` está ESTRITAMENTE dentro do retângulo do nó (nunca na borda — a borda é o handle). */
function dentroDoRetangulo(p: { x: number; y: number }, n: NoDoLayout): boolean {
  return p.x > n.x && p.x < n.x + NODE_W && p.y > n.y && p.y < n.y + NODE_H;
}

describe("caminhoOrtogonal — número de pontos, sem segmento zero, sem invadir cartão alheio", () => {
  it("aresta ADIANTE (forward, ex. setup→build): path de 3 pontos, sem segmento zero", () => {
    const { nodes } = layoutDoGrafo({
      ids: ["setup", "build"],
      edges: [{ origem: "setup", destino: "build" }],
    });
    const o = nodes.get("setup")!;
    const d = nodes.get("build")!;
    const { sourceX, sourceY, targetX, targetY } = pontosDaConexao(o, d);
    const { path, midX, midY } = caminhoOrtogonal(sourceX, sourceY, targetX, targetY, undefined, undefined, undefined);
    const pontos = parsearPath(path);
    expect(pontos.length).toBeGreaterThanOrEqual(2);
    expect(segmentosZero(pontos)).toBe(0);
    // nenhum ponto do path cai dentro do interior de origem/destino.
    for (const p of pontos) {
      expect(dentroDoRetangulo(p, o)).toBe(false);
      expect(dentroDoRetangulo(p, d)).toBe(false);
    }
    expect(Number.isFinite(midX)).toBe(true);
    expect(Number.isFinite(midY)).toBe(true);
  });

  it("aresta PRA TRÁS que pula rank (r2→r0, contornando r1): path com desvio, sem segmento zero, sem invadir NENHUM dos 3 cartões", () => {
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
    const { sourceX, sourceY, targetX, targetY } = pontosDaConexao(r2, r0);
    const { path, midX, midY } = caminhoOrtogonal(
      sourceX,
      sourceY,
      targetX,
      targetY,
      voltando.desvioPx,
      voltando.desvioYInicio,
      voltando.desvioYFim,
    );
    const pontos = parsearPath(path);
    expect(pontos.length).toBeGreaterThanOrEqual(4); // path com desvio tem 5 pontos brutos, ≥4 após dedup
    expect(segmentosZero(pontos)).toBe(0);
    for (const p of pontos) {
      // P4d (achado ALTO #4): a prova concreta — o path NUNCA cai dentro do
      // interior do próprio cartão de origem (r2) nem do de destino (r0),
      // nem do intermediário que ele contorna (r1).
      expect(dentroDoRetangulo(p, r0)).toBe(false);
      expect(dentroDoRetangulo(p, r1)).toBe(false);
      expect(dentroDoRetangulo(p, r2)).toBe(false);
    }
    // Rótulo ancorado num ponto do path (o achado pede "segmento mais longo",
    // não necessariamente um vértice) — nunca NaN/Infinity.
    expect(Number.isFinite(midX)).toBe(true);
    expect(Number.isFinite(midY)).toBe(true);
  });

  it("aresta de MESMO rank (a→z, direta, sem desvio): path raso ao longo do topo da fileira, sem segmento zero, sem invadir 'a' nem 'z'", () => {
    const { nodes, edges } = layoutDoGrafo({
      ids: ["a", "meio", "z"],
      edges: [],
      todasArestas: [{ origem: "a", destino: "z" }],
    });
    const a = nodes.get("a")!;
    const meio = nodes.get("meio")!;
    const z = nodes.get("z")!;
    const aZ = edges.find((e) => e.origem === "a" && e.destino === "z")!;
    expect(aZ.desviar).toBe(false); // confirmado em layout-do-grafo.test.ts
    const { sourceX, sourceY, targetX, targetY } = pontosDaConexao(a, z);
    const { path } = caminhoOrtogonal(sourceX, sourceY, targetX, targetY, undefined, undefined, undefined);
    const pontos = parsearPath(path);
    expect(segmentosZero(pontos)).toBe(0);
    for (const p of pontos) {
      expect(dentroDoRetangulo(p, a)).toBe(false);
      expect(dentroDoRetangulo(p, meio)).toBe(false);
      expect(dentroDoRetangulo(p, z)).toBe(false);
    }
  });

  it("rótulo ancora no ponto médio do segmento MAIS LONGO — nunca no 'toco' curto de um desvio", () => {
    // Path artificial com desvio: segmento inicial curtíssimo (o "toco" que o
    // crítico mediu), atravessamento longo, segmento final curtíssimo.
    const { path, midX, midY } = caminhoOrtogonal(0, 0, 500, 300, 40, 2, 6);
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
