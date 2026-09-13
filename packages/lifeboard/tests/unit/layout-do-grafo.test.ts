import { describe, expect, it } from "vitest";

import { layoutDoGrafo, type NoDoLayout } from "@/lib/layout-do-grafo";
import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

/**
 * OS-LIFEBOARD · P4f — layout COMPACTO (decisão D2 do crítico hostil ROUND 5).
 *
 * O que mudou em relação à rodada 4: um rank não é mais UMA fileira. Com 40
 * tarefas e 16 raízes, a fileira do rank 0 media 4.096px de mundo — nenhum
 * zoom legível enquadra isso, e era essa a causa raiz do achado ALTO #1 ("abre
 * com 3 e promete 33"). Agora o rank quebra em linhas de no máximo
 * `maxColunas`, com os críticos na 1ª linha e centralizados.
 *
 * A invariante que o roteamento inteiro usa (`canais-de-aresta.test.ts`) e que
 * este arquivo protege: **todo cartão fica numa coluna do grid** — nenhuma
 * centralização "pela metade" —, porque é isso que mantém os corredores
 * verticais entre colunas livres de cartão em TODAS as linhas.
 */

const NODE_W = 200;
const GAP_X = 56;
const GAP_Y = 84;
const PASSO_X = NODE_W + GAP_X;
const PASSO_Y = ALTURA_DO_CARTAO + GAP_Y;

const CADEIA = {
  ids: ["task-setup", "task-build", "task-deploy", "task-standup"],
  edges: [
    { origem: "task-setup", destino: "task-build" },
    { origem: "task-build", destino: "task-deploy" },
  ],
};

function porLinha(nodes: Map<string, NoDoLayout>): Map<number, NoDoLayout[]> {
  const m = new Map<number, NoDoLayout[]>();
  for (const n of nodes.values()) {
    const lista = m.get(n.linha);
    if (lista) lista.push(n);
    else m.set(n.linha, [n]);
  }
  for (const lista of m.values()) lista.sort((a, b) => a.coluna - b.coluna);
  return m;
}

describe("layoutDoGrafo — rank por caminho mais longo", () => {
  it("setup, build e deploy caem em ranks (e linhas) distintos", () => {
    const { nodes } = layoutDoGrafo(CADEIA);
    expect(nodes.get("task-setup")!.rank).toBe(0);
    expect(nodes.get("task-build")!.rank).toBe(1);
    expect(nodes.get("task-deploy")!.rank).toBe(2);
    expect(nodes.get("task-setup")!.linha).toBeLessThan(nodes.get("task-build")!.linha);
    expect(nodes.get("task-build")!.linha).toBeLessThan(nodes.get("task-deploy")!.linha);
  });

  it("'standup' (sem predecessor/sucessor) fica no rank 0 — nunca numa linha intermediária", () => {
    const { nodes } = layoutDoGrafo(CADEIA);
    expect(nodes.get("task-standup")!.rank).toBe(0);
    expect(nodes.get("task-standup")!.linha).toBe(nodes.get("task-setup")!.linha);
  });

  it("a distância vertical entre linhas é ALTURA_DO_CARTAO + gapY (token único)", () => {
    const { nodes } = layoutDoGrafo({ ids: ["a", "b"], edges: [{ origem: "a", destino: "b" }] });
    expect(nodes.get("b")!.y - nodes.get("a")!.y).toBe(PASSO_Y);
  });

  it("ciclo não trava (corta em rank 0, layout ainda sai)", () => {
    const { nodes } = layoutDoGrafo({
      ids: ["a", "b"],
      edges: [
        { origem: "a", destino: "b" },
        { origem: "b", destino: "a" },
      ],
    });
    expect(nodes.size).toBe(2);
  });
});

describe("layoutDoGrafo — compactação em linhas (D2)", () => {
  const ids = Array.from({ length: 14 }, (_, i) => `n${String(i).padStart(2, "0")}`);

  it("um rank com 14 nós quebra em linhas de no máximo `maxColunas` — nunca uma fileira de 14", () => {
    for (const maxColunas of [3, 4, 6]) {
      const { nodes } = layoutDoGrafo({ ids, edges: [], maxColunas });
      const linhas = porLinha(nodes);
      expect(linhas.size).toBe(Math.ceil(14 / maxColunas));
      for (const lista of linhas.values()) expect(lista.length).toBeLessThanOrEqual(maxColunas);
      // A largura total do rank passa a caber no orçamento de colunas.
      const maiorX = Math.max(...[...nodes.values()].map((n) => n.x));
      expect(maiorX + NODE_W).toBeLessThanOrEqual(maxColunas * PASSO_X);
    }
  });

  it("6 colunas a ≥1024px de pane, 3 abaixo de 640 — a largura do rank cai com a do pane", () => {
    const largo = layoutDoGrafo({ ids, edges: [], maxColunas: 6 });
    const estreito = layoutDoGrafo({ ids, edges: [], maxColunas: 3 });
    const larguraDe = (r: typeof largo): number =>
      Math.max(...[...r.nodes.values()].map((n) => n.x)) + NODE_W;
    expect(larguraDe(largo)).toBe(6 * PASSO_X - GAP_X);
    expect(larguraDe(estreito)).toBe(3 * PASSO_X - GAP_X);
  });

  it("todo cartão fica numa COLUNA do grid (a invariante que mantém os corredores verticais livres)", () => {
    const { nodes } = layoutDoGrafo({ ids, edges: [], maxColunas: 4 });
    for (const n of nodes.values()) {
      expect(n.x).toBe(n.coluna * PASSO_X);
      expect(Number.isInteger(n.coluna)).toBe(true);
    }
  });

  it("linha incompleta fica centralizada no orçamento de colunas", () => {
    // 7 nós, 3 colunas → linhas de 3, 3 e 1; a última centraliza (coluna 1).
    const sete = Array.from({ length: 7 }, (_, i) => `s${i}`);
    const { nodes } = layoutDoGrafo({ ids: sete, edges: [], maxColunas: 3 });
    const linhas = porLinha(nodes);
    expect(linhas.get(2)!.length).toBe(1);
    expect(linhas.get(2)![0]!.coluna).toBe(1);
  });
});

describe("layoutDoGrafo — críticos na 1ª linha do rank, centralizados (D2)", () => {
  const ids = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "crit"];

  it("o nó crítico fica na 1ª linha do seu rank", () => {
    const { nodes } = layoutDoGrafo({ ids, edges: [], criticoIds: ["crit"], maxColunas: 3 });
    const linhaDoCritico = nodes.get("crit")!.linha;
    expect(linhaDoCritico).toBe(Math.min(...[...nodes.values()].map((n) => n.linha)));
  });

  it("e CENTRALIZADO nela — não no canto, como a ordenação 'crítico primeiro' deixava", () => {
    const { nodes } = layoutDoGrafo({ ids, edges: [], criticoIds: ["crit"], maxColunas: 3 });
    const daLinha = [...nodes.values()]
      .filter((n) => n.linha === nodes.get("crit")!.linha)
      .sort((a, b) => a.coluna - b.coluna);
    expect(daLinha.length).toBe(3);
    expect(daLinha[1]!.id).toBe("crit");
  });

  it("a ordem dentro do rank é estável (por id) — não muda com a ordem de chegada", () => {
    const embaralhado = [...ids].reverse();
    const a = layoutDoGrafo({ ids, edges: [], criticoIds: ["crit"], maxColunas: 3 });
    const b = layoutDoGrafo({ ids: embaralhado, edges: [], criticoIds: ["crit"], maxColunas: 3 });
    for (const id of ids) {
      expect(b.nodes.get(id)).toEqual(a.nodes.get(id));
    }
  });

  it("a rota de cada aresta também é determinística (mesma entrada, mesmos pontos)", () => {
    const params = {
      ids,
      edges: [{ origem: "a1", destino: "crit" }],
      criticoIds: ["crit"],
      maxColunas: 3,
      todasArestas: [
        { id: "e1", origem: "a1", destino: "crit" },
        { id: "e2", origem: "a2", destino: "crit" },
      ],
    };
    const a = layoutDoGrafo(params);
    const b = layoutDoGrafo({ ...params, ids: [...ids].reverse() });
    expect(b.edges).toEqual(a.edges);
  });
});
