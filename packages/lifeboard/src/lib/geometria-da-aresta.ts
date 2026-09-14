/**
 * OS-LIFEBOARD · P4g — Geometria pura da aresta (sem React, sem estado).
 *
 * Três coisas moram aqui, e as três nasceram do mesmo defeito: geometria
 * decidida por um `? :` inline dentro de um componente, que nenhum teste
 * conseguia medir.
 *
 * • `posicaoDoGlifo` — onde a ponta da aresta é desenhada. Na rodada 6 o
 *   crítico mediu o glifo no HANDLE do ReactFlow e o traço em `data.pontos`:
 *   duas geometrias para o mesmo ponto, 34 de 45 glifos fora do fim do próprio
 *   caminho. Agora a única fonte é a polilinha.
 * • `larguraDaBanda` e as constantes de traço — a régua ÚNICA, em px de mundo,
 *   que `layout-do-grafo.ts` usa para dimensionar o passo do canal (`FAIXA_PX`).
 * • `handlesDaConexao` — a regra de handle, importada também pelo teste de
 *   rota (nunca uma segunda cópia livre para divergir).
 */

import { ZOOM_MINIMO } from "@/components/graph/tipografia-do-cartao";
import type { CamadaGrafo } from "@/lib/camadas-do-grafo";
import type { NoDoLayout, Ponto } from "@/lib/layout-do-grafo";

/**
 * zIndex do `<div class="react-flow__nodes">` — o React Flow agrupa as arestas
 * por nível de zIndex em `<svg>`s próprios e os nós ficam no nível 0. Qualquer
 * aresta que precise ser PINTADA por cima do cartão tem de passar deste valor.
 */
export const Z_INDEX_DOS_NOS = 0;

/**
 * Camada de pintura da aresta. Só a obsolescência sobe: o ❌ dela é desenhado
 * junto ao cartão de destino e, no nível 0, bastava o recuo apontar para o
 * lado errado para o glifo sumir ATRÁS do cartão (era o bug). Cinto (recuo
 * correto, `posicaoDoGlifo`) E suspensório (esta camada).
 */
export function zIndexDaAresta(camada: Exclude<CamadaGrafo, "critico">): number {
  return camada === "obsolescencia" ? Z_INDEX_DOS_NOS + 5 : Z_INDEX_DOS_NOS;
}

export interface AncoraDoGlifo {
  x: number;
  y: number;
  /** Direção do último segmento, em graus (0 = para a direita). */
  anguloGraus: number;
}

/**
 * Onde o glifo do fim da aresta é desenhado: **no último vértice da própria
 * polilinha**, com a direção tirada do penúltimo→último.
 *
 * Achado ALTO #4 do crítico hostil ROUND 6: até aqui o glifo era desenhado em
 * `targetX/targetY` — o handle do ReactFlow, que fica no CENTRO da borda do
 * cartão — enquanto o `path` vinha de `data.pontos`, COM o deslocamento do
 * leque (`layout-do-grafo.ts`). Duas geometrias para o mesmo ponto: ele mediu
 * uma seta 24,0px fora do fim da própria linha, 34 de 45 glifos soltos em
 * 40@1280 e, num par ligado nos dois sentidos, seta + círculo + losango no
 * pixel idêntico (420, 469) — porque o handle é o MESMO ponto para todas as
 * arestas que chegam no cartão, e o fim do path não é.
 */
export function posicaoDoGlifo(pontos: readonly Ponto[]): AncoraDoGlifo {
  const fim = pontos[pontos.length - 1] ?? { x: 0, y: 0 };
  const penultimo = pontos[pontos.length - 2] ?? fim;
  const dx = fim.x - penultimo.x;
  const dy = fim.y - penultimo.y;
  const anguloGraus = dx === 0 && dy === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  return { x: fim.x, y: fim.y, anguloGraus };
}

// ── D3 (achado ALTO #3): UMA régua, em px de MUNDO ──────────────────────────
//
// O que o crítico mediu na rodada 6: três réguas em três unidades para a mesma
// coisa — o passo do canal em 6px de MUNDO (`FAIXA_PX`), a separação do traço
// triplo em 4px de TELA e a largura do traço em px de tela
// (`non-scaling-stroke`). A zoom 0,5 o passo virava 3,0px de tela e a
// meia-banda da tripla 5,0px: a tripla vermelha passava POR CIMA das vizinhas
// (varredura de pixel em y=356: `249,3 vermelho · 253,3 vermelho · 256,0
// VERDE · 257,3 vermelho` — uma aresta verde pintada DENTRO da tripla).
//
// Agora tudo é px de MUNDO: a espessura visual varia com o zoom (é o que faz a
// banda ser zoom-invariante), com piso de 1px de TELA aplicado por `max()`
// para o traço nunca sumir. E `FAIXA_PX` (o passo do canal) é CALCULADO a
// partir da banda mais larga — nunca mais um número escolhido à mão.

/** Deslocamento perpendicular de cada linha lateral do traço triplo (mundo). */
export const SEPARACAO_DA_TRIPLA_MUNDO = 4;
/** Largura do traço por papel, em px de MUNDO. */
export const LARGURA_DO_TRACO_MUNDO = 1.75;
export const LARGURA_DO_TRACO_DESTACADA_MUNDO = 2.5;
export const LARGURA_DO_TRACO_CRITICA_MUNDO = 2;
/** Piso do traço em px de TELA — abaixo disto o navegador não pinta linha nenhuma. */
export const PISO_DE_TRACO_NA_TELA_PX = 1;

/** Os 6 papéis de aresta que o grafo desenha. */
export const TIPOS_DE_BANDA = [
  "sucessao",
  "correlacao",
  "sinergia",
  "obsolescencia",
  "destacada",
  "critico",
] as const;
export type TipoDeBanda = (typeof TIPOS_DE_BANDA)[number];

/** Largura nominal do traço (mundo) de cada papel — antes do piso de tela. */
export function larguraDoTracoNominal(tipo: TipoDeBanda): number {
  if (tipo === "critico") return LARGURA_DO_TRACO_CRITICA_MUNDO;
  if (tipo === "destacada") return LARGURA_DO_TRACO_DESTACADA_MUNDO;
  return LARGURA_DO_TRACO_MUNDO;
}

/** Largura do traço em px de MUNDO no zoom dado, já com o piso de 1px de tela. */
export function larguraDoTracoNoMundo(tipo: TipoDeBanda, zoom: number): number {
  const z = zoom > 0 ? zoom : 1;
  return Math.max(larguraDoTracoNominal(tipo), PISO_DE_TRACO_NA_TELA_PX / z);
}

/**
 * Largura TOTAL que a aresta ocupa perpendicularmente ao próprio traço, em px
 * de MUNDO, no PIOR zoom suportado (`ZOOM_MINIMO` — é lá que o piso de 1px de
 * tela engorda mais a banda em unidades de mundo). A tripla do caminho crítico
 * é a mais larga: duas separações + o traço.
 */
export function larguraDaBanda(tipo: TipoDeBanda): number {
  const traco = larguraDoTracoNoMundo(tipo, ZOOM_MINIMO);
  if (tipo === "critico") return 2 * SEPARACAO_DA_TRIPLA_MUNDO + traco;
  return traco;
}

/** A banda mais larga dos 6 papéis — a régua que `FAIXA_PX` tem de superar. */
export function larguraDaBandaMaisLarga(): number {
  return Math.max(...TIPOS_DE_BANDA.map(larguraDaBanda));
}

export interface HandlesDaConexao {
  sourceHandle: string;
  targetHandle: string;
}

/**
 * Par de handles de uma aresta, pela LINHA relativa dos dois nós (não pelo
 * rank: depois da compactação — `layout-do-grafo.ts`, decisão D2 — um mesmo
 * rank ocupa várias linhas, e quem manda na geometria é a linha).
 *
 *   • destino ABAIXO  → sai por Bottom, entra por Top.
 *   • MESMA linha     → sai por Top, entra por Top (os dois lados abrem para o
 *     corredor acima da fileira, nunca para dentro do próprio cartão).
 *   • destino ACIMA   → sai por Top, entra por Bottom.
 *
 * A MESMA regra decide o roteamento em `layout-do-grafo.ts` (`ladoDeSaida`/
 * `ladoDeEntrada`, que chamam esta função) — nunca duas cópias.
 */
export function handlesDaConexao(
  nodes: ReadonlyMap<string, NoDoLayout>,
  origem: string,
  destino: string,
): HandlesDaConexao {
  const linhaOrigem = nodes.get(origem)?.linha ?? 0;
  const linhaDestino = nodes.get(destino)?.linha ?? 0;
  if (linhaDestino > linhaOrigem) {
    return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  }
  if (linhaDestino === linhaOrigem) {
    return { sourceHandle: "source-top", targetHandle: "target-top" };
  }
  return { sourceHandle: "source-top", targetHandle: "target-bottom" };
}

/** Lado do cartão de onde a aresta SAI ("top" | "bottom"), derivado dos handles. */
export function ladoDeSaida(
  nodes: ReadonlyMap<string, NoDoLayout>,
  origem: string,
  destino: string,
): "top" | "bottom" {
  return handlesDaConexao(nodes, origem, destino).sourceHandle === "source-bottom"
    ? "bottom"
    : "top";
}

/** Lado do cartão por onde a aresta ENTRA ("top" | "bottom"), derivado dos handles. */
export function ladoDeEntrada(
  nodes: ReadonlyMap<string, NoDoLayout>,
  origem: string,
  destino: string,
): "top" | "bottom" {
  return handlesDaConexao(nodes, origem, destino).targetHandle === "target-bottom"
    ? "bottom"
    : "top";
}
