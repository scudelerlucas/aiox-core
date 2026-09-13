"use client";
import { getSmoothStepPath, useViewport, type EdgeProps } from "reactflow";

import { ArestaSvgGroup, type ArestaSvgSpec } from "@/components/graph/aresta-svg";

/**
 * OS-LIFEBOARD · P4 — Edge customizado do ReactFlow para o grafo v3.
 *
 * Só calcula geometria (path smoothstep + ângulo do fim) e repassa para
 * `ArestaSvgGroup` — a MESMA função que o teste de render instancia direto com
 * coordenadas fixas (`aresta-svg.tsx`, cabeçalho). Registrar em
 * `edgeTypes = { v3: V3Edge }` em `dependency-graph.tsx`.
 */
export interface V3EdgeData extends ArestaSvgSpec {
  /**
   * P4b (achado CRÍTICO #1): meio gap horizontal de desvio para arestas que
   * pulam rank E têm uma célula intermediária ocupada na mesma coluna —
   * `layout-do-grafo.ts` calcula quando; `undefined`/0 = path reto (default,
   * a maioria das arestas — layout em rank sem pulo nenhum).
   */
  desvioPx?: number;
}

/** Zoom real medido pelo crítico no fixture: 0,43–0,51 — o piso "nunca encolhe" é 1. */
const PX_DE_TELA_ALVO_DO_OFFSET = 4;
const ESCALA_MAXIMA_DO_GLIFO = 3;

export function V3Edge(props: EdgeProps<V3EdgeData>): JSX.Element | null {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  // Zoom REAL do canvas (achado ALTO #3/#4): a 0,43–0,51 (medido pelo
  // crítico), um offset/tamanho fixo em unidades de mundo encolhe junto e
  // vira mancha ilegível. Dividir pelo zoom mantém a separação/tamanho
  // constantes EM PIXEL DE TELA, em qualquer zoom.
  const { zoom } = useViewport();
  if (!data) return null;

  const zoomSeguro = zoom > 0 ? zoom : 1;
  const offsetPx = PX_DE_TELA_ALVO_DO_OFFSET / zoomSeguro;
  const glifoEscala = Math.min(ESCALA_MAXIMA_DO_GLIFO, Math.max(1, 1 / zoomSeguro));

  const centerXBase = (sourceX + targetX) / 2;
  const centerX = data.desvioPx ? centerXBase + data.desvioPx : undefined;
  const [path, midX, midY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    ...(centerX !== undefined ? { centerX } : {}),
  });
  const anguloGraus = (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI;
  // Traço triplo: desloca no eixo perpendicular ao lado MAIS COMPRIDO do
  // retângulo origem→destino — é o que garante 3 linhas visíveis tanto numa
  // aresta vertical (a maioria, no layout em colunas) quanto numa horizontal.
  const eixoDeslocamento = Math.abs(targetY - sourceY) >= Math.abs(targetX - sourceX) ? "x" : "y";

  return (
    <ArestaSvgGroup
      path={path}
      midX={midX}
      midY={midY}
      endX={targetX}
      endY={targetY}
      spec={data}
      anguloGraus={anguloGraus}
      eixoDeslocamento={eixoDeslocamento}
      offsetPx={offsetPx}
      glifoEscala={glifoEscala}
    />
  );
}
