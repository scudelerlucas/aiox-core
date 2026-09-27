import { describe, expect, it } from "vitest";

import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";
import { layoutDoGrafo, type ArestaDoLayout, type Ponto } from "@/lib/layout-do-grafo";
import {
  AFASTAMENTO_DO_ROTULO_MUNDO,
  caixaDoRotulo,
  caixaEstimadaDoTexto,
  colocarRotulos,
  segmentoCruzaRetangulo,
  type Retangulo,
} from "@/lib/rotulo-da-aresta";
import { arvore200, cadeia200, grafo40 } from "./cenarios-do-grafo";

/**
 * OS-LIFEBOARD · P4 rodada 15 — achado BAIXO 6 do crítico hostil:
 * *"o universo é magro para a classe"*.
 *
 * ── A DECISÃO, REGISTRADA (é o que o achado pede) ──────────────────────────
 *
 * A fixture de RUNTIME (11 tarefas, 10 arestas) **não** foi ampliada. Ela é a
 * régua de dezenas de medidas que CONTAM arestas — `tests/unit/panes-medidos.json`,
 * o piso por camada de §0, as contagens do canvas × dado bruto de §12, as
 * sentinelas de §19/§21 — e ampliá-la moveria todos esses números de uma vez,
 * trocando cobertura por ruído. O piso de §0 (≥ 2 arestas por camada, ≥ 2 no
 * caminho crítico) continua sendo o mínimo que ela tem de sustentar.
 *
 * A densidade se prova AQUI, onde ela é barata: os cenários sintéticos de
 * `cenarios-do-grafo.ts` (40, 200 em cadeia, 200 em árvore), que já cobriam
 * cruzamento e empilhamento de canal em `canais-de-aresta.test.ts` e
 * `banda-da-aresta.test.ts`. O que NÃO era coberto em lugar nenhum, e é o que
 * este arquivo fecha, é a terceira coisa que o crítico nomeia: **rótulo
 * disputando espaço num grafo cheio**. O colocador de rótulos só era medido em
 * casos de brinquedo (um ou dois rótulos, um cartão), nunca contra dezenas de
 * rótulos, dezenas de cartões e centenas de traços ao mesmo tempo.
 *
 * A régua do colocador, que é a da peça: **rótulo colocado é rótulo legível**
 * — nunca em cima de cartão, nunca em cima de traço, nunca em cima de outro
 * rótulo. Onde não há lugar, ele NÃO é desenhado (o valor fica no rótulo
 * acessível da aresta). Então o teste tem duas metades: nenhuma colisão entre
 * os colocados, E uma fração mínima colocada — porque suprimir todos também
 * passaria na primeira metade, e aprovar por ausência é o vício nº 2 desta
 * esteira.
 */

const LARGURA_DO_CARTAO = 200;
const FONTE_DO_ROTULO_PX = 12;

function caixasDosCartoes(nodes: Map<string, { x: number; y: number }>): Retangulo[] {
  return [...nodes.values()].map((n) => ({
    x0: n.x,
    y0: n.y,
    x1: n.x + LARGURA_DO_CARTAO,
    y1: n.y + ALTURA_DO_CARTAO,
  }));
}

function cruzaAlgumTraco(caixa: Retangulo, rotas: readonly (readonly Ponto[])[]): boolean {
  for (const rota of rotas) {
    for (let i = 0; i + 1 < rota.length; i += 1) {
      if (segmentoCruzaRetangulo(rota[i]!, rota[i + 1]!, caixa)) return true;
    }
  }
  return false;
}

function seSobrepoem(a: Retangulo, b: Retangulo): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Coloca um "NN%" em TODA aresta de sinergia do cenário e devolve o veredito. */
function medirRotulosNoGrafoCheio(cenario: {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: { id: string; origem: string; destino: string }[];
  criticoIds?: string[];
}, maxColunas: number) {
  const layout = layoutDoGrafo({
    ids: cenario.ids,
    edges: cenario.edges,
    criticoIds: cenario.criticoIds,
    todasArestas: cenario.todasArestas,
    maxColunas,
  });
  const porId = new Map<string, ArestaDoLayout>(layout.edges.map((e) => [e.id, e]));
  const comRotulo = layout.edges.filter((e) => e.id.startsWith("sinergia:"));
  const texto = "50%";
  const caixaTexto = caixaEstimadaDoTexto(texto, FONTE_DO_ROTULO_PX);
  const pedidos = comRotulo.map((e) => ({
    id: e.id,
    pontos: e.pontos,
    largura: caixaTexto.largura,
    altura: caixaTexto.altura,
  }));
  const cartoes = caixasDosCartoes(layout.nodes);
  const rotas = layout.edges.map((e) => e.pontos);
  const colocados = colocarRotulos(pedidos, cartoes, {
    arestas: rotas,
    deslocamento: AFASTAMENTO_DO_ROTULO_MUNDO,
  });

  const problemas: string[] = [];
  const caixasColocadas: Retangulo[] = [];
  let quantosColocados = 0;
  for (const pedido of pedidos) {
    const ponto = colocados.get(pedido.id) ?? null;
    if (ponto === null) continue;
    quantosColocados += 1;
    const caixa = caixaDoRotulo(ponto, pedido.largura, pedido.altura);
    if (cartoes.some((c) => seSobrepoem(caixa, c))) {
      problemas.push(`o rótulo de ${pedido.id} caiu em cima de um cartão`);
    }
    if (cruzaAlgumTraco(caixa, rotas)) {
      problemas.push(`o rótulo de ${pedido.id} caiu em cima de um traço`);
    }
    for (let i = 0; i < caixasColocadas.length; i += 1) {
      if (seSobrepoem(caixa, caixasColocadas[i]!)) {
        problemas.push(`o rótulo de ${pedido.id} caiu em cima de outro rótulo já colocado`);
        break;
      }
    }
    caixasColocadas.push(caixa);
  }
  return { problemas, quantosColocados, pedidos: pedidos.length, porId, layout };
}

describe("BAIXO 6 — o grafo CHEIO: toda aresta roteada, todo rótulo legível", () => {
  it("40 tarefas com as quatro camadas: nenhuma aresta fica sem rota", () => {
    for (const maxColunas of [6, 3]) {
      const cenario = grafo40();
      const layout = layoutDoGrafo({ ...cenario, maxColunas });
      const roteadas = new Set(layout.edges.map((e) => e.id));
      const semRota = cenario.todasArestas.filter((a) => !roteadas.has(a.id));
      expect({ maxColunas, semRota: semRota.map((a) => a.id) }).toEqual({ maxColunas, semRota: [] });
      /* E as quatro camadas base chegam ao layout juntas, no mesmo grafo. */
      const prefixos = new Set([...roteadas].map((id) => id.split(":")[0]));
      expect([...prefixos].sort()).toEqual(["correlacao", "obsolescencia", "sinergia", "sucessao"]);
    }
  });

  it("40 tarefas: rótulo colocado nunca fica sobre cartão, traço ou outro rótulo", () => {
    for (const maxColunas of [6, 3]) {
      const r = medirRotulosNoGrafoCheio(grafo40(), maxColunas);
      expect({ maxColunas, problemas: r.problemas }).toEqual({ maxColunas, problemas: [] });
      expect(r.pedidos).toBeGreaterThanOrEqual(4);
      /* E não vale suprimir tudo: aprovar por ausência é o vício nº 2. */
      expect(r.quantosColocados).toBeGreaterThan(0);
    }
  });

  it("200 tarefas em cadeia e em árvore: toda aresta continua com rota", () => {
    for (const cenario of [cadeia200(), arvore200()]) {
      const layout = layoutDoGrafo({ ...cenario, maxColunas: 6 });
      const roteadas = new Set(layout.edges.map((e) => e.id));
      const semRota = cenario.todasArestas.filter((a) => !roteadas.has(a.id));
      expect(semRota.map((a) => a.id)).toEqual([]);
    }
  });

  it("falsificador: sem recusar traço nem cartão, o grafo cheio COLIDE de verdade", () => {
    /* Se a medição acima devolvesse [] por não conseguir ver colisão nenhuma,
       ela não provaria nada. Aqui o mesmo grafo é medido com o colocador sem
       nenhuma das duas recusas — e tem de sujar. */
    const cenario = grafo40();
    const layout = layoutDoGrafo({ ...cenario, maxColunas: 6 });
    const comRotulo = layout.edges.filter((e) => e.id.startsWith("sinergia:"));
    const caixaTexto = caixaEstimadaDoTexto("50%", FONTE_DO_ROTULO_PX);
    const rotas = layout.edges.map((e) => e.pontos);
    const cartoes = caixasDosCartoes(layout.nodes);
    let sujos = 0;
    for (const e of comRotulo) {
      const meio = e.pontos[Math.floor(e.pontos.length / 2)]!;
      const caixa = caixaDoRotulo(meio, caixaTexto.largura, caixaTexto.altura);
      if (cruzaAlgumTraco(caixa, rotas) || cartoes.some((c) => seSobrepoem(caixa, c))) sujos += 1;
    }
    expect(sujos).toBeGreaterThan(0);
  });
});
