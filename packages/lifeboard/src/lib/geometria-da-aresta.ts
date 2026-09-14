/**
 * OS-LIFEBOARD · P4f — Geometria pura da aresta (sem React, sem estado).
 *
 * Nasce do achado MÉDIO #4 do crítico hostil ROUND 4→5: a posição do ❌ de
 * obsolescência (escolhida pela DIREÇÃO DE CHEGADA) e o `zIndex` que põe a
 * aresta acima dos nós viviam soltos dentro de componentes — `v3-edge.tsx` e
 * `dependency-graph.tsx` —, cada um com um `? :` inline que NENHUM teste
 * cobria. O crítico provou reverter as DUAS metades (recuo invertido +
 * `zIndex` removido) com 570/570 testes verdes. Aqui as duas viram função
 * pura, testada em `tests/unit/geometria-da-aresta.test.ts` (prova de
 * mutação: reverter cada metade derruba um teste nomeado).
 *
 * `handlesDaConexao` mora aqui pela mesma razão (achado MÉDIO #5): o teste de
 * rota REIMPLEMENTAVA a regra de handle em vez de importar a de produção —
 * duas cópias que podiam divergir em silêncio. Agora é uma só, e é esta.
 */

import { Position } from "reactflow";

import type { CamadaGrafo } from "@/lib/camadas-do-grafo";
import type { NoDoLayout } from "@/lib/layout-do-grafo";

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

export interface PontoDoGlifo {
  x: number;
  y: number;
}

/**
 * Onde desenhar o glifo do fim da aresta, recuado para FORA do cartão de
 * destino.
 *
 * A verdade geométrica: o handle de entrada fica numa borda do cartão, e o
 * cartão se estende para o lado OPOSTO ao recuo. Entrada por `Top` → o cartão
 * está em +Y → recua −Y. Entrada por `Bottom` → o cartão está em −Y → recua
 * +Y. Recuar "ao longo do último segmento do path" (a versão de duas rodadas
 * atrás) errava sempre que a aresta chegava subindo: empurrava o ❌ para
 * DENTRO do cartão.
 */
export function posicaoDoGlifo(
  targetX: number,
  targetY: number,
  targetPosition: Position,
  recuo: number,
): PontoDoGlifo {
  const entraPorBaixo = targetPosition === Position.Bottom;
  return { x: targetX, y: targetY + (entraPorBaixo ? recuo : -recuo) };
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
