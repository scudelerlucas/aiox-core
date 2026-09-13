import { Position } from "reactflow";
import { describe, expect, it } from "vitest";

import {
  handlesDaConexao,
  posicaoDoGlifo,
  zIndexDaAresta,
  Z_INDEX_DOS_NOS,
} from "@/lib/geometria-da-aresta";
import { layoutDoGrafo, type NoDoLayout } from "@/lib/layout-do-grafo";
import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

/**
 * OS-LIFEBOARD · P4f — achados MÉDIO #4 e #5 do crítico hostil ROUND 4.
 *
 * #4: a posição do ❌ de obsolescência (pela direção de CHEGADA) e o `zIndex`
 * que põe essa aresta acima dos nós eram dois `? :` inline dentro de
 * componentes. O crítico reverteu as DUAS metades e os 570 testes seguiram
 * verdes — prova de que nenhum deles media a coisa. Aqui as duas viraram
 * função pura, e cada metade tem um teste que cai quando ela é revertida (a
 * prova de mutação está no relatório da rodada).
 *
 * #5: `handlesDaConexao` estava REIMPLEMENTADA no teste — duas cópias da
 * mesma regra, livres para divergir. Agora o teste importa a de produção, que
 * é a mesma que roteia a aresta em `layout-do-grafo.ts`.
 */

const NODE_W = 200;
const NODE_H = ALTURA_DO_CARTAO;
const RECUO = 16;

/** Três casos de rank/linha, com o layout REAL. */
function cenario(): {
  nodes: Map<string, NoDoLayout>;
  adiante: NoDoLayout;
  meio: NoDoLayout;
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
    meio: nodes.get("r1")!,
    atras: nodes.get("r0")!,
    irmao: nodes.get("r0b")!,
  };
}

describe("posicaoDoGlifo — o ❌ SEMPRE fora do cartão de destino (achado MÉDIO #4)", () => {
  const casos: { nome: string; alvo: () => NoDoLayout; entrada: Position }[] = [
    { nome: "destino ADIANTE (entra pelo topo)", alvo: () => cenario().adiante, entrada: Position.Top },
    { nome: "destino PARA TRÁS (entra por baixo)", alvo: () => cenario().atras, entrada: Position.Bottom },
    { nome: "destino no MESMO rank (entra pelo topo)", alvo: () => cenario().irmao, entrada: Position.Top },
  ];

  for (const caso of casos) {
    it(`${caso.nome}: o glifo cai fora do retângulo do cartão`, () => {
      const n = caso.alvo();
      const targetX = n.x + NODE_W / 2;
      const targetY = caso.entrada === Position.Bottom ? n.y + NODE_H : n.y;
      const { x, y } = posicaoDoGlifo(targetX, targetY, caso.entrada, RECUO);
      expect(x).toBe(targetX);
      const dentroDoCartao = x > n.x && x < n.x + NODE_W && y > n.y && y < n.y + NODE_H;
      expect(dentroDoCartao).toBe(false);
    });
  }

  it("com Position.Bottom o glifo fica EXATAMENTE em targetY + recuo (a metade que o crítico reverteu)", () => {
    expect(posicaoDoGlifo(100, 500, Position.Bottom, RECUO)).toEqual({ x: 100, y: 500 + RECUO });
  });

  it("com Position.Top o glifo fica EXATAMENTE em targetY − recuo", () => {
    expect(posicaoDoGlifo(100, 500, Position.Top, RECUO)).toEqual({ x: 100, y: 500 - RECUO });
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
