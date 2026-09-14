"use client";
import { useViewport, type EdgeProps } from "reactflow";

import { ArestaSvgGroup, type ArestaSvgSpec } from "@/components/graph/aresta-svg";
import { tipografiaDoCartao } from "@/components/graph/tipografia-do-cartao";
import { posicaoDoGlifo } from "@/lib/geometria-da-aresta";
import type { Ponto } from "@/lib/layout-do-grafo";

/**
 * OS-LIFEBOARD · P4 — Edge customizado do ReactFlow para o grafo v3.
 *
 * Este arquivo NÃO calcula rota. A rota inteira (canais, faixas, pés em
 * leque) vem pronta de `layout-do-grafo.ts` em `data.pontos` — decisão D5 da
 * rodada 5, porque escolher faixa exige conhecer TODAS as arestas, e a
 * decisão local por aresta foi o que empilhou correlação e obsolescência na
 * mesma cota. Aqui ficam só as três coisas que dependem do ZOOM (e que,
 * portanto, não podem ser pré-calculadas): a separação do traço triplo, o
 * tamanho do glifo e o recuo do ❌ — todas em px de TELA, divididas pelo zoom
 * real (`useViewport`).
 *
 * O desenho em si é de `ArestaSvgGroup` (`aresta-svg.tsx`) — o MESMO
 * componente que o teste de render instancia direto, nunca uma segunda
 * implementação.
 */

/** Zoom real medido pelo crítico no fixture: 0,43–0,51 — o piso "nunca encolhe" é 1. */
const PX_DE_TELA_ALVO_DO_OFFSET = 4;
const ESCALA_MAXIMA_DO_GLIFO = 3;
/**
 * O ❌ de obsolescência, desenhado bem no handle de destino, ficava ATRÁS do
 * cartão. Recuar 16px de TELA (zoom-invariante) para FORA do cartão de
 * destino deixa o glifo no vão entre os cartões, sempre visível. Para que
 * lado é "fora" é decisão de `posicaoDoGlifo` (`geometria-da-aresta.ts`),
 * testada — não mais um `? :` inline aqui.
 */
const RECUO_GLIFO_OBSOLESCENCIA_PX = 16;

export interface V3EdgeData extends ArestaSvgSpec {
  /**
   * P4f (decisão D5, achado ALTO #3 do crítico hostil ROUND 4): a ROTA INTEIRA,
   * em px de mundo, calculada por `layout-do-grafo.ts` com canal e faixa
   * próprios. O renderer não escolhe mais geometria nenhuma — não pode: a
   * escolha de faixa depende de TODAS as outras arestas, e uma decisão local
   * por aresta foi exatamente o que pôs correlação e obsolescência na mesma
   * cota (`midY`), uma escondendo a outra por completo.
   */
  pontos: Ponto[];
}

export interface GeometriaDoTraco {
  path: string;
  midX: number;
  midY: number;
  anguloGraus: number;
  /** Eixo do deslocamento perpendicular do traço triplo do caminho crítico. */
  eixoDeslocamento: "x" | "y";
}

/**
 * `d` do SVG + âncora do rótulo + ângulo do glifo, a partir da rota já
 * roteada. Função PURA e exportada: o teste mede a rota REAL, sem montar um
 * `<V3Edge>` dentro de um `ReactFlowProvider`.
 *
 * O rótulo (só sinergia) ancora no ponto médio do segmento MAIS LONGO — nunca
 * num vértice do meio, que podia cair no "toco" de poucos pixels de um desvio.
 */
export function geometriaDoTraco(pontos: readonly Ponto[]): GeometriaDoTraco {
  const lista = pontos.length > 0 ? pontos : [{ x: 0, y: 0 }];
  const path = lista.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  let a = lista[0]!;
  let b = lista[1] ?? lista[0]!;
  let maiorComprimento = -1;
  for (let i = 0; i < lista.length - 1; i++) {
    const pa = lista[i]!;
    const pb = lista[i + 1]!;
    const comprimento = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    if (comprimento > maiorComprimento) {
      maiorComprimento = comprimento;
      a = pa;
      b = pb;
    }
  }

  const fim = lista[lista.length - 1]!;
  const penultimo = lista[lista.length - 2] ?? fim;
  const dx = fim.x - penultimo.x;
  const dy = fim.y - penultimo.y;
  const anguloGraus = Math.hypot(dx, dy) === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;

  const inicio = lista[0]!;
  const eixoDeslocamento =
    Math.abs(fim.y - inicio.y) >= Math.abs(fim.x - inicio.x) ? "x" : "y";

  return { path, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, anguloGraus, eixoDeslocamento };
}

export function V3Edge(props: EdgeProps<V3EdgeData>): JSX.Element | null {
  const { targetX, targetY, targetPosition, data } = props;
  // Zoom REAL do canvas (achado ALTO #3/#4): a 0,43–0,51 (medido pelo
  // crítico), um offset/tamanho fixo em unidades de mundo encolhe junto e
  // vira mancha ilegível. Dividir pelo zoom mantém a separação/tamanho
  // constantes EM PIXEL DE TELA, em qualquer zoom.
  const { zoom } = useViewport();
  if (!data) return null;

  const zoomSeguro = zoom > 0 ? zoom : 1;
  const offsetPx = PX_DE_TELA_ALVO_DO_OFFSET / zoomSeguro;
  const glifoEscala = Math.min(ESCALA_MAXIMA_DO_GLIFO, Math.max(1, 1 / zoomSeguro));

  const { path, midX, midY, anguloGraus, eixoDeslocamento } = geometriaDoTraco(data.pontos);

  // P4f (achado MÉDIO #4): a posição do ❌ virou função pura e testada
  // (`posicaoDoGlifo`) — o `? :` inline que morava aqui era exatamente a
  // metade que o crítico reverteu com 570/570 testes verdes.
  const recuoPx = RECUO_GLIFO_OBSOLESCENCIA_PX / zoomSeguro;
  const glifo =
    data.camada === "obsolescencia"
      ? posicaoDoGlifo(targetX, targetY, targetPosition, recuoPx)
      : { x: targetX, y: targetY };

  return (
    <ArestaSvgGroup
      path={path}
      midX={midX}
      midY={midY}
      endX={glifo.x}
      endY={glifo.y}
      spec={data}
      anguloGraus={anguloGraus}
      eixoDeslocamento={eixoDeslocamento}
      offsetPx={offsetPx}
      glifoEscala={glifoEscala}
      // O rótulo de % da sinergia segue a MESMA régua de tipografia do
      // cartão (piso de 11,4px de tela em qualquer zoom) — era o único texto
      // do grafo que ainda tinha tamanho fixo de 12px.
      labelFontePx={tipografiaDoCartao(zoomSeguro).dadoPx}
    />
  );
}
