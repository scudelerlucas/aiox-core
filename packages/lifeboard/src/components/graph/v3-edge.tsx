"use client";
import { useViewport, type EdgeProps } from "reactflow";

import { ArestaSvgGroup, type ArestaSvgSpec } from "@/components/graph/aresta-svg";

/**
 * OS-LIFEBOARD · P4 — Edge customizado do ReactFlow para o grafo v3.
 *
 * Só calcula geometria (path ortogonal + ângulo do fim) e repassa para
 * `ArestaSvgGroup` — a MESMA função que o teste de render instancia direto com
 * coordenadas fixas (`aresta-svg.tsx`, cabeçalho). Registrar em
 * `edgeTypes = { v3: V3Edge }` em `dependency-graph.tsx`.
 *
 * P4c (achado CRÍTICO #2 do crítico hostil ROUND 2): a v P4b desviava
 * passando `centerX` pro `getSmoothStepPath` da própria lib — mas com handles
 * Bottom→Top (verticais), a lib só lê `centerY` pra deslocar o segmento do
 * meio; `centerX` nunca aparecia no `d` renderizado (prova do crítico: o path
 * de `task-review→task-deploy` não continha o offset em X nenhum). Path
 * PRÓPRIO abaixo — sem depender da lib pra geometria — garante que o desvio
 * é real: 3 segmentos retos (desce → atravessa → desce) sem desvio, 5 quando
 * `desviar` (desce até a faixa ocupada → salta `desvioPx` pro lado → desce
 * along o desvio → volta pra coluna de destino → desce no handle).
 */
export interface V3EdgeData extends ArestaSvgSpec {
  /**
   * P4b/P4c (achado CRÍTICO #1/#2): meio gap horizontal de desvio para
   * arestas que pulam rank E têm uma célula intermediária ocupada na mesma
   * coluna — `layout-do-grafo.ts` calcula quando; `undefined`/0 = path reto
   * (default, a maioria das arestas — layout em rank sem pulo nenhum).
   */
  desvioPx?: number;
  /**
   * Faixa vertical (px de mundo) que o desvio contorna — `undefined` quando
   * `desvioPx` também é. Ver `layout-do-grafo.ts` (`ArestaDoLayout`).
   */
  desvioYInicio?: number;
  desvioYFim?: number;
}

/** Zoom real medido pelo crítico no fixture: 0,43–0,51 — o piso "nunca encolhe" é 1. */
const PX_DE_TELA_ALVO_DO_OFFSET = 4;
const ESCALA_MAXIMA_DO_GLIFO = 3;
/**
 * P4c (achado ALTO #5): o ❌ de obsolescência, desenhado bem no handle de
 * destino, ficava ATRÁS do card (o handle já está na borda do nó — o crop
 * DPR-1 do crítico não achou nenhum pixel magenta ali). Recuar 16px de TELA
 * (zoom-invariante, mesmo truque de `offsetPx`) ao longo do último segmento
 * do path deixa o glifo no vão entre os cards, sempre visível.
 */
const RECUO_GLIFO_OBSOLESCENCIA_PX = 16;
/**
 * P4c (achado ALTO #5, correção de geometria na verificação): a 1ª versão
 * recuava ao longo da DIREÇÃO DO SEGMENTO final do path — funciona quando a
 * aresta "desce" na ordem normal do rank, mas obsolescência/sinergia podem
 * ligar um nó de rank MAIOR para um de rank MENOR (ex. `task-build`(rank 1)
 * → `task-archive`(rank 0)) — o path então precisa SUBIR pra alcançar o
 * handle Top por baixo, e "recuar ao longo do segmento" empurrava o glifo
 * pra DENTRO do próprio card de destino (medido: 6 pixels magenta num crop
 * que devia ter >50 — o glifo ficou atrás do card de novo, por um motivo
 * diferente do achado original). Verdade mais simples: `Position.Top` é
 * SEMPRE o topo do card, que sempre se estende pra BAIXO dali (+Y) — "fora
 * do card" a partir do handle de entrada é SEMPRE `-Y`, não importa de que
 * direção o path chega.
 */

interface PontoPath {
  x: number;
  y: number;
}

/**
 * Path ortogonal PRÓPRIO (sem `getSmoothStepPath`): desce do handle de saída
 * até o meio do vão vertical, atravessa, desce no handle de entrada. Quando
 * `desvioPx`/`desvioYInicio`/`desvioYFim` estão presentes (o layout marcou
 * `desviar: true` — há um nó ocupando a coluna no meio do caminho), o
 * atravessamento sai da coluna de origem ANTES de entrar na faixa ocupada,
 * viaja deslocado `desvioPx` para o lado durante toda a faixa, e volta para a
 * coluna de destino depois de sair dela — um desvio geométrico de verdade,
 * não um parâmetro que a lib ignora.
 */
interface CaminhoOrtogonal {
  path: string;
  midX: number;
  midY: number;
  anguloGraus: number;
}

function caminhoOrtogonal(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  desvioPx: number | undefined,
  desvioYInicio: number | undefined,
  desvioYFim: number | undefined,
): CaminhoOrtogonal {
  const pontos: PontoPath[] = [{ x: sourceX, y: sourceY }];

  if (desvioPx && desvioYInicio !== undefined && desvioYFim !== undefined) {
    const xDesvio = sourceX + desvioPx;
    // Nunca deixar o "início"/"fim" do desvio invertidos com sourceY/targetY
    // (defensivo — origem sempre acima do destino no layout em rank, mas um
    // grafo com ciclo/rank 0 forçado pode produzir entradas fora de ordem).
    const yInicio = Math.max(sourceY, Math.min(desvioYInicio, targetY));
    const yFim = Math.max(yInicio, Math.min(desvioYFim, targetY));
    pontos.push({ x: sourceX, y: yInicio });
    pontos.push({ x: xDesvio, y: yInicio });
    pontos.push({ x: xDesvio, y: yFim });
    pontos.push({ x: targetX, y: yFim });
    pontos.push({ x: targetX, y: targetY });
  } else {
    const midY = (sourceY + targetY) / 2;
    pontos.push({ x: sourceX, y: midY });
    pontos.push({ x: targetX, y: midY });
    pontos.push({ x: targetX, y: targetY });
  }

  const path = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  // `pontos` sempre tem ≥3 elementos (os dois ramos acima empurram pelo menos
  // 2, mais o ponto inicial) — non-null assertion documentada, não um `any`.
  const meio = pontos[Math.floor(pontos.length / 2)]!;
  const fim = pontos[pontos.length - 1]!;
  const penultimo = pontos[pontos.length - 2]!;
  const dx = fim.x - penultimo.x;
  const dy = fim.y - penultimo.y;
  const comprimento = Math.hypot(dx, dy);
  const anguloGraus = comprimento === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  return { path, midX: meio.x, midY: meio.y, anguloGraus };
}

export function V3Edge(props: EdgeProps<V3EdgeData>): JSX.Element | null {
  const { sourceX, sourceY, targetX, targetY, data } = props;
  // Zoom REAL do canvas (achado ALTO #3/#4): a 0,43–0,51 (medido pelo
  // crítico), um offset/tamanho fixo em unidades de mundo encolhe junto e
  // vira mancha ilegível. Dividir pelo zoom mantém a separação/tamanho
  // constantes EM PIXEL DE TELA, em qualquer zoom.
  const { zoom } = useViewport();
  if (!data) return null;

  const zoomSeguro = zoom > 0 ? zoom : 1;
  const offsetPx = PX_DE_TELA_ALVO_DO_OFFSET / zoomSeguro;
  const glifoEscala = Math.min(ESCALA_MAXIMA_DO_GLIFO, Math.max(1, 1 / zoomSeguro));

  const { path, midX, midY, anguloGraus } = caminhoOrtogonal(
    sourceX,
    sourceY,
    targetX,
    targetY,
    data.desvioPx,
    data.desvioYInicio,
    data.desvioYFim,
  );
  // Traço triplo: desloca no eixo perpendicular ao lado MAIS COMPRIDO do
  // retângulo origem→destino — é o que garante 3 linhas visíveis tanto numa
  // aresta vertical (a maioria, no layout em colunas) quanto numa horizontal.
  const eixoDeslocamento = Math.abs(targetY - sourceY) >= Math.abs(targetX - sourceX) ? "x" : "y";

  // P4c (achado ALTO #5): só o ❌ de obsolescência recua — os outros glifos
  // (seta/círculo/losango) continuam ancorados no handle, como sempre.
  // Sempre `-Y` a partir do handle Top (nunca ao longo do path — ver o
  // comentário de `RECUO_GLIFO_OBSOLESCENCIA_PX` acima) — `Position.Top`
  // garante que o card do destino só existe em `+Y` a partir daqui.
  const recuoPx = RECUO_GLIFO_OBSOLESCENCIA_PX / zoomSeguro;
  const glifoEndX = targetX;
  const glifoEndY = data.camada === "obsolescencia" ? targetY - recuoPx : targetY;

  return (
    <ArestaSvgGroup
      path={path}
      midX={midX}
      midY={midY}
      endX={glifoEndX}
      endY={glifoEndY}
      spec={data}
      anguloGraus={anguloGraus}
      eixoDeslocamento={eixoDeslocamento}
      offsetPx={offsetPx}
      glifoEscala={glifoEscala}
    />
  );
}
