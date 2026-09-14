import { describe, expect, it } from "vitest";

import { ZOOM_MINIMO } from "@/components/graph/tipografia-do-cartao";
import {
  larguraDaBanda,
  larguraDaBandaMaisLarga,
  larguraDoTracoNoMundo,
  PISO_DE_TRACO_NA_TELA_PX,
  SEPARACAO_DA_TRIPLA_MUNDO,
  TIPOS_DE_BANDA,
} from "@/lib/geometria-da-aresta";
import {
  FAIXA_PX,
  FOLGA_ENTRE_BANDAS,
  layoutDoGrafo,
  limiteDeFaixasPorCorredor,
} from "@/lib/layout-do-grafo";

import { arestasDo11, FIXTURE_11, grafo40 } from "./cenarios-do-grafo";

/**
 * OS-LIFEBOARD · P4g — decisão D3 do crítico hostil ROUND 6: **uma régua só,
 * em px de MUNDO**.
 *
 * O que ele mediu: o passo do canal era 6px de MUNDO, a separação da tripla
 * 4px de TELA e a largura do traço px de tela (`non-scaling-stroke`). A zoom
 * 0,5 o passo virava 3,0px de tela e a meia-banda da tripla 5,0px — a tripla
 * do caminho crítico pintava POR CIMA das vizinhas. Varredura de pixel em
 * y=356, DPR 2: `249,3 vermelho · 253,3 vermelho · 256,0 VERDE · 257,3
 * vermelho`. Uma aresta verde DENTRO da tripla.
 *
 * A régua agora é uma: `FAIXA_PX` é CALCULADO a partir da banda mais larga, e
 * o corredor que não comporta o passo faz o vão crescer em vez de comprimir a
 * faixa.
 */

describe("larguraDaBanda — a régua que dimensiona o canal", () => {
  it("FAIXA_PX é MAIOR que a banda dos 6 tipos (a invariante que fecha o achado ALTO #3)", () => {
    for (const tipo of TIPOS_DE_BANDA) {
      expect(FAIXA_PX).toBeGreaterThan(larguraDaBanda(tipo));
    }
    expect(FAIXA_PX).toBe(larguraDaBandaMaisLarga() + FOLGA_ENTRE_BANDAS);
  });

  it("a tripla do caminho crítico é a banda mais larga — e é ela que manda no passo", () => {
    expect(larguraDaBandaMaisLarga()).toBe(larguraDaBanda("critico"));
    // Duas separações + o traço: se a separação crescer, o canal cresce junto.
    expect(larguraDaBanda("critico")).toBeGreaterThanOrEqual(2 * SEPARACAO_DA_TRIPLA_MUNDO);
  });

  it("o traço encolhe com o zoom (px de MUNDO) mas nunca some: piso de 1px de TELA", () => {
    // A zoom 1 vale o nominal; no piso do canvas o piso de tela é que manda.
    expect(larguraDoTracoNoMundo("sucessao", 1)).toBe(1.75);
    expect(larguraDoTracoNoMundo("sucessao", ZOOM_MINIMO)).toBe(
      PISO_DE_TRACO_NA_TELA_PX / ZOOM_MINIMO,
    );
    // Em px de TELA o piso é respeitado em qualquer zoom suportado.
    for (const zoom of [ZOOM_MINIMO, 0.6, 0.85, 1, 1.8]) {
      for (const tipo of TIPOS_DE_BANDA) {
        expect(larguraDoTracoNoMundo(tipo, zoom) * zoom).toBeGreaterThanOrEqual(
          PISO_DE_TRACO_NA_TELA_PX - 1e-9,
        );
      }
    }
  });
});

/**
 * Achado BAIXO #13: `LIMITE_DE_FAIXAS_POR_CORREDOR` podia ir de 12 a 0 e só 1
 * dos 902 testes caía — ninguém media o que ele faz. Agora o limite não é um
 * número solto: sai da LARGURA do vão, e há teste nos cenários que o produto
 * serve (11 e 40, em 3 e em 6 colunas).
 */
describe("limiteDeFaixasPorCorredor — quantas faixas o vão comporta, sem comprimir", () => {
  it("sai da largura do vão, nunca de um número escolhido à mão", () => {
    expect(limiteDeFaixasPorCorredor(56)).toBe(Math.floor((56 - 12) / FAIXA_PX) + 1);
    expect(limiteDeFaixasPorCorredor(56 + FAIXA_PX)).toBe(limiteDeFaixasPorCorredor(56) + 1);
    // Vão apertado ainda aceita UMA faixa — corredor nenhum fica inutilizável.
    expect(limiteDeFaixasPorCorredor(0)).toBe(1);
  });

  const cenarios: { nome: string; params: Parameters<typeof layoutDoGrafo>[0] }[] = [
    {
      nome: "11 tarefas, 6 colunas",
      params: {
        ids: FIXTURE_11.ids,
        edges: FIXTURE_11.edges,
        todasArestas: arestasDo11(),
        criticoIds: FIXTURE_11.criticoIds,
        maxColunas: 6,
      },
    },
    {
      nome: "11 tarefas, 3 colunas",
      params: {
        ids: FIXTURE_11.ids,
        edges: FIXTURE_11.edges,
        todasArestas: arestasDo11(),
        criticoIds: FIXTURE_11.criticoIds,
        maxColunas: 3,
      },
    },
    { nome: "40 tarefas, 6 colunas", params: { ...grafo40(), maxColunas: 6 } },
    { nome: "40 tarefas, 3 colunas", params: { ...grafo40(), maxColunas: 3 } },
  ];

  for (const { nome, params } of cenarios) {
    it(`${nome}: nenhum corredor VERTICAL usa mais faixas SIMULTÂNEAS do que o vão comporta`, () => {
      const { edges, gapX } = layoutDoGrafo(params);
      const limite = limiteDeFaixasPorCorredor(gapX);
      expect(maxFaixasSimultaneas(edges, 200 + gapX, gapX)).toBeLessThanOrEqual(limite);
    });

    it(`${nome}: toda faixa cabe no vão — o passo nunca é comprimido abaixo da banda`, () => {
      const { edges, gapX, gapY } = layoutDoGrafo(params);
      expect(gapX).toBeGreaterThanOrEqual(56);
      expect(gapY).toBeGreaterThanOrEqual(84);
      // A separação mínima entre dois segmentos paralelos que correm juntos
      // tem de superar a soma das meias-bandas mais largas possíveis.
      expect(separacaoMinima(edges)).toBeGreaterThan(larguraDaBandaMaisLarga());
    });
  }
});

/**
 * Maior número de trechos verticais que coexistem (y sobreposto) no MESMO
 * corredor — é isso que o limite por corredor governa.
 */
function maxFaixasSimultaneas(
  edges: { id: string; pontos: { x: number; y: number }[] }[],
  passoDaColuna: number,
  gapX: number,
): number {
  const porCorredor = new Map<number, { x: number; y0: number; y1: number }[]>();
  for (const e of edges) {
    for (let i = 0; i < e.pontos.length - 1; i++) {
      const a = e.pontos[i]!;
      const b = e.pontos[i + 1]!;
      if (Math.abs(a.x - b.x) > 1e-9 || Math.abs(a.y - b.y) < 1e-9) continue;
      const corredor = Math.round((a.x + gapX / 2) / passoDaColuna);
      // Só os trechos que correm DENTRO do corredor (os "pés" saem da borda do
      // cartão e não disputam faixa com eles).
      if (Math.abs(a.x - (corredor * passoDaColuna - gapX / 2)) > gapX / 2) continue;
      const lista = porCorredor.get(corredor) ?? [];
      lista.push({ x: a.x, y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) });
      porCorredor.set(corredor, lista);
    }
  }
  let maior = 0;
  for (const lista of porCorredor.values()) {
    for (const alvo of lista) {
      const meio = (alvo.y0 + alvo.y1) / 2;
      const faixas = new Set(
        lista.filter((o) => o.y0 <= meio && meio <= o.y1).map((o) => Math.round(o.x * 100)),
      );
      if (faixas.size > maior) maior = faixas.size;
    }
  }
  return maior;
}

function separacaoMinima(edges: { id: string; pontos: { x: number; y: number }[] }[]): number {
  const segs: { id: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const e of edges) {
    for (let i = 0; i < e.pontos.length - 1; i++) {
      segs.push({
        id: e.id,
        x0: e.pontos[i]!.x,
        y0: e.pontos[i]!.y,
        x1: e.pontos[i + 1]!.x,
        y1: e.pontos[i + 1]!.y,
      });
    }
  }
  const ov = (a0: number, a1: number, b0: number, b1: number): number =>
    Math.max(0, Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1)));
  let min = Infinity;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]!;
      const t = segs[j]!;
      if (s.id === t.id) continue;
      const sH = Math.abs(s.y1 - s.y0) < 1e-9;
      const sV = Math.abs(s.x1 - s.x0) < 1e-9;
      const tH = Math.abs(t.y1 - t.y0) < 1e-9;
      const tV = Math.abs(t.x1 - t.x0) < 1e-9;
      if (sH && tH && ov(s.x0, s.x1, t.x0, t.x1) > 0) min = Math.min(min, Math.abs(s.y0 - t.y0));
      if (sV && tV && ov(s.y0, s.y1, t.y0, t.y1) > 0) min = Math.min(min, Math.abs(s.x0 - t.x0));
    }
  }
  return min;
}
