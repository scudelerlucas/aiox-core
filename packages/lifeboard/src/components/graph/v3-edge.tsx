"use client";
import { getSmoothStepPath, type EdgeProps } from "reactflow";

import { ArestaSvgGroup, type ArestaSvgSpec } from "@/components/graph/aresta-svg";

/**
 * OS-LIFEBOARD · P4 — Edge customizado do ReactFlow para o grafo v3.
 *
 * Só calcula geometria (path smoothstep + ângulo do fim) e repassa para
 * `ArestaSvgGroup` — a MESMA função que o teste de render instancia direto com
 * coordenadas fixas (`aresta-svg.tsx`, cabeçalho). Registrar em
 * `edgeTypes = { v3: V3Edge }` em `dependency-graph.tsx`.
 */
export type V3EdgeData = ArestaSvgSpec;

export function V3Edge(props: EdgeProps<V3EdgeData>): JSX.Element | null {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  if (!data) return null;

  const [path, midX, midY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
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
    />
  );
}
