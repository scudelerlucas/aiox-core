import { describe, expect, it } from "vitest";

import {
  handlesDaConexao,
  posicaoDoGlifo,
  zIndexDaAresta,
  Z_INDEX_DOS_NOS,
} from "@/lib/geometria-da-aresta";
import { layoutDoGrafo, type NoDoLayout, type Ponto } from "@/lib/layout-do-grafo";

/**
 * OS-LIFEBOARD · P4f — achados MÉDIO #4 e #5 do crítico hostil ROUND 4.
 *
 * #4 (rodada 6): o glifo era desenhado no HANDLE do ReactFlow enquanto o traço
 * vinha de `data.pontos` — duas geometrias para o mesmo ponto, 34 de 45 glifos
 * fora do fim do próprio caminho. Agora a única fonte é a polilinha, e o
 * primeiro teste abaixo cai se alguém voltar a usar o handle.
 *
 * #5: `handlesDaConexao` estava REIMPLEMENTADA no teste — duas cópias da
 * mesma regra, livres para divergir. Agora o teste importa a de produção, que
 * é a mesma que roteia a aresta em `layout-do-grafo.ts`.
 */

/** Três casos de rank/linha, com o layout REAL. */
function cenario(): {
  nodes: Map<string, NoDoLayout>;
  adiante: NoDoLayout;
  atras: NoDoLayout;
  irmao: NoDoLayout;
} {
  const { nodes } = layoutDoGrafo({
    ids: ["r0", "r0b", "r1", "r2"],
    edges: [
      { origem: "r0", destino: "r1" },
      { origem: "r1", destino: "r2" },
    ],
    maxColunas: 6,
  });
  return {
    nodes,
    adiante: nodes.get("r1")!,
    atras: nodes.get("r0")!,
    irmao: nodes.get("r0b")!,
  };
}

describe("posicaoDoGlifo — o glifo no FIM do caminho (achado ALTO #4, rodada 6)", () => {
  /**
   * A prova de mutação: nesta rota o HANDLE do ReactFlow (centro da borda do
   * cartão de destino) e o FIM DO PATH são pontos diferentes — é o leque de
   * `layout-do-grafo.ts` que os separa. Desenhar no handle (o que o código
   * fazia) erra por 24px; a régua é o fim do path.
   */
  const rota: Ponto[] = [
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 124, y: 60 },
    { x: 124, y: 120 },
  ];

  it("ancora no ÚLTIMO vértice da polilinha — nunca no handle do cartão", () => {
    const { x, y } = posicaoDoGlifo(rota);
    expect({ x, y }).toEqual({ x: 124, y: 120 });
    const centroDoCartao = { x: 100, y: 120 };
    expect(Math.hypot(x - centroDoCartao.x, y - centroDoCartao.y)).toBeGreaterThan(1);
  });

  it("a direção vem do penúltimo→último segmento (a seta aponta para onde a linha vai)", () => {
    expect(posicaoDoGlifo(rota).anguloGraus).toBe(90);
    expect(posicaoDoGlifo([{ x: 0, y: 0 }, { x: 50, y: 0 }]).anguloGraus).toBe(0);
    expect(posicaoDoGlifo([{ x: 0, y: 100 }, { x: 0, y: 0 }]).anguloGraus).toBe(-90);
  });

  it("duas arestas que chegam no MESMO cartão por pés diferentes não empilham o glifo", () => {
    // O empilhamento medido pelo crítico (seta + círculo + losango no pixel
    // (420, 469)) vinha de todas usarem o mesmo handle. Com o fim do path, pé
    // diferente = ponto diferente.
    const a = posicaoDoGlifo([{ x: 0, y: 0 }, { x: 93, y: 120 }]);
    const b = posicaoDoGlifo([{ x: 0, y: 0 }, { x: 107, y: 120 }]);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1);
  });

  it("rota degenerada não quebra nem inventa ângulo", () => {
    expect(posicaoDoGlifo([{ x: 7, y: 9 }])).toEqual({ x: 7, y: 9, anguloGraus: 0 });
    expect(posicaoDoGlifo([])).toEqual({ x: 0, y: 0, anguloGraus: 0 });
  });
});

describe("zIndexDaAresta — obsolescência pintada ACIMA dos nós (a outra metade)", () => {
  it("obsolescência > o nível dos nós", () => {
    expect(zIndexDaAresta("obsolescencia")).toBeGreaterThan(Z_INDEX_DOS_NOS);
  });

  it("as outras camadas ficam no nível dos nós", () => {
    for (const camada of ["sucessao", "correlacao", "sinergia"] as const) {
      expect(zIndexDaAresta(camada)).toBe(Z_INDEX_DOS_NOS);
    }
  });
});

describe("handlesDaConexao — a regra de produção, importada (achado MÉDIO #5)", () => {
  it("destino ABAIXO: sai por baixo, entra por cima", () => {
    const { nodes } = cenario();
    expect(handlesDaConexao(nodes, "r0", "r1")).toEqual({
      sourceHandle: "source-bottom",
      targetHandle: "target-top",
    });
  });

  it("MESMA linha: sai por cima e entra por cima — os dois lados abrem para o corredor acima da fileira", () => {
    const { nodes } = cenario();
    expect(handlesDaConexao(nodes, "r0", "r0b")).toEqual({
      sourceHandle: "source-top",
      targetHandle: "target-top",
    });
  });

  it("destino ACIMA: sai por cima, entra por baixo", () => {
    const { nodes } = cenario();
    expect(handlesDaConexao(nodes, "r2", "r0")).toEqual({
      sourceHandle: "source-top",
      targetHandle: "target-bottom",
    });
  });

  it("quem manda é a LINHA, não o rank: dois nós do mesmo rank em linhas diferentes viram adiante/atrás", () => {
    // 8 raízes com 3 colunas: mesmo rank 0, linhas 0, 1 e 2.
    const { nodes } = layoutDoGrafo({
      ids: ["a", "b", "c", "d", "e", "f", "g", "h"],
      edges: [],
      maxColunas: 3,
    });
    const primeiro = [...nodes.values()].find((n) => n.linha === 0)!;
    const segundo = [...nodes.values()].find((n) => n.linha === 1)!;
    expect(primeiro.rank).toBe(segundo.rank);
    expect(handlesDaConexao(nodes, primeiro.id, segundo.id)).toEqual({
      sourceHandle: "source-bottom",
      targetHandle: "target-top",
    });
  });
});
