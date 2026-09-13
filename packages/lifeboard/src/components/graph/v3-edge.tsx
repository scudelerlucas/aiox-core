"use client";
import { Position, useViewport, type EdgeProps } from "reactflow";

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

/**
 * P4e (achado MÉDIO #5 do crítico hostil ROUND 4): aresta de MESMO rank sai e
 * entra pelo handle Top — `sourceY === targetY`, a cota do topo da fileira. O
 * path de 3 segmentos degenerava numa RETA horizontal a 2,5px acima do topo
 * dos cartões alheios da mesma fileira (e `calcularDesvio` nunca disparava,
 * porque a comparação `midY > ny0` era estrita e `midY` valia exatamente
 * `ny0`). Agora a aresta de mesmo rank SEMPRE sobe por um corredor próprio,
 * com dois cotovelos: `M sx,sy L sx,sy−C L tx,sy−C L tx,ty`. 28px (≥ 24, a
 * régua do achado) deixam ≥ 8px de folga para qualquer cartão da própria
 * fileira e ainda ≥ 32px para a fileira de cima (o menor `gapY` aceito pelo
 * layout é 60).
 */
const CORREDOR_MESMO_RANK_PX = 28;

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
export interface CaminhoOrtogonal {
  path: string;
  midX: number;
  midY: number;
  anguloGraus: number;
}

/**
 * Path ortogonal PRÓPRIO — exportado para teste direto (achado MÉDIO #6 do
 * crítico hostil ROUND 3: "teste unitário do `d` de `caminhoOrtogonal`"),
 * sem precisar montar um `<V3Edge>` dentro de um `ReactFlowProvider` (o
 * componente usa `useViewport`, que só existe dentro de um provider — a
 * função pura não).
 */
export function caminhoOrtogonal(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  desvioPx: number | undefined,
  desvioYInicio: number | undefined,
  desvioYFim: number | undefined,
): CaminhoOrtogonal {
  const pontosBrutos: PontoPath[] = [{ x: sourceX, y: sourceY }];
  const mesmoRank = Math.abs(sourceY - targetY) < 0.01;

  if (mesmoRank) {
    // P4e (achado MÉDIO #5): corredor próprio ACIMA da fileira — ver
    // `CORREDOR_MESMO_RANK_PX`. Os dois handles são Top, então "para cima" é
    // sempre para FORA dos dois cartões, em qualquer fileira.
    const yCorredor = sourceY - CORREDOR_MESMO_RANK_PX;
    pontosBrutos.push({ x: sourceX, y: yCorredor });
    pontosBrutos.push({ x: targetX, y: yCorredor });
    pontosBrutos.push({ x: targetX, y: targetY });
  } else if (desvioPx && desvioYInicio !== undefined && desvioYFim !== undefined) {
    const xDesvio = sourceX + desvioPx;
    // P4e (achado ALTO #3 do crítico hostil ROUND 4): a janela do desvio era
    // ordenada por VALOR (`Math.min`/`Math.max`), não pela ORDEM DE PERCURSO.
    // Com `sourceY > targetY` (aresta "para trás": obsolescência/sinergia que
    // apontam para um rank menor) o primeiro canto era o do DESTINO, e o
    // primeiro segmento atravessava o vão inteiro — passando por dentro do
    // cartão intermediário (medido no caso `r2→r0` contornando `r1`:
    // `M100,392 L100,154 …`, 222px de penetração em `r1`).
    // A ordem certa é sempre a do percurso: origem → canto PERTO DA ORIGEM →
    // corredor lateral → canto PERTO DO DESTINO → destino. `yPerto`/`yLonge`
    // são as duas bordas da mesma janela, escolhidas por proximidade e não
    // por magnitude — descendo ou subindo, o primeiro cotovelo é sempre o que
    // encosta no lado de onde o traço saiu.
    const yA = Math.min(desvioYInicio, desvioYFim);
    const yB = Math.max(desvioYInicio, desvioYFim);
    const subindo = targetY < sourceY;
    const yPerto = subindo ? yB : yA;
    const yLonge = subindo ? yA : yB;
    pontosBrutos.push({ x: sourceX, y: yPerto });
    pontosBrutos.push({ x: xDesvio, y: yPerto });
    pontosBrutos.push({ x: xDesvio, y: yLonge });
    pontosBrutos.push({ x: targetX, y: yLonge });
    pontosBrutos.push({ x: targetX, y: targetY });
  } else {
    const midY = (sourceY + targetY) / 2;
    pontosBrutos.push({ x: sourceX, y: midY });
    pontosBrutos.push({ x: targetX, y: midY });
    pontosBrutos.push({ x: targetX, y: targetY });
  }

  // P4d (achado MÉDIO #5/#6 do crítico hostil ROUND 3): pontos consecutivos
  // idênticos (segmento de comprimento zero) nunca entram no `d` — o
  // crítico mediu DOIS no MESMO path (`M1892,115 L1892,115 …`), sobra do
  // caso "mesmo rank" com sourceY===targetY. Limiar de 0,01px absorve ruído
  // de ponto flutuante sem apagar segmento real nenhum (o menor gap do
  // layout é dezenas de px).
  const pontos: PontoPath[] = [];
  for (const p of pontosBrutos) {
    const anterior = pontos[pontos.length - 1];
    if (anterior && Math.abs(anterior.x - p.x) < 0.01 && Math.abs(anterior.y - p.y) < 0.01) continue;
    pontos.push(p);
  }
  // Só pode ficar com 1 ponto se origem e destino coincidirem exatamente
  // (nunca no grafo real — nós não se sobrepõem) — duplicar em vez de
  // deixar o `d` vazio.
  if (pontos.length < 2) pontos.push({ ...pontos[0]! });

  const path = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // P4d (achado MÉDIO #5): o rótulo (só sinergia) ancora no ponto médio do
  // segmento MAIS LONGO — nunca num vértice do meio do array, que podia cair
  // bem no "toco" de poucos pixels de um desvio (o rótulo "50%" pousando
  // fora do traço visível, medido pelo crítico).
  let a = pontos[0]!;
  let b = pontos[1] ?? pontos[0]!;
  let maiorComprimento = -1;
  for (let i = 0; i < pontos.length - 1; i++) {
    const pa = pontos[i]!;
    const pb = pontos[i + 1]!;
    const comprimento = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    if (comprimento > maiorComprimento) {
      maiorComprimento = comprimento;
      a = pa;
      b = pb;
    }
  }
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  const fim = pontos[pontos.length - 1]!;
  const penultimo = pontos[pontos.length - 2] ?? fim;
  const dx = fim.x - penultimo.x;
  const dy = fim.y - penultimo.y;
  const comprimentoFinal = Math.hypot(dx, dy);
  const anguloGraus = comprimentoFinal === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  return { path, midX, midY, anguloGraus };
}

export function V3Edge(props: EdgeProps<V3EdgeData>): JSX.Element | null {
  const { sourceX, sourceY, targetX, targetY, targetPosition, data } = props;
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
  //
  // P4e (achado ALTO #4 do crítico hostil ROUND 4): o recuo era SEMPRE `-Y`,
  // apoiado na premissa "a aresta entra pelo handle Top". Desde a rodada 3 os
  // handles são escolhidos por rank relativo (`handlesDaConexao`), e uma
  // aresta "para trás" — a obsolescência real do fixture,
  // `task-build`(rank 1) → `task-archive`(rank 0) — entra por `target-bottom`.
  // Ali o cartão do destino se estende para CIMA (−Y), então `targetY − recuo`
  // punha o ❌ exatamente ATRÁS do cartão. A regra honesta é a direção de
  // CHEGADA, que o próprio ReactFlow informa em `targetPosition`:
  // entrada por Top → o cartão está em +Y, recua −Y; entrada por Bottom → o
  // cartão está em −Y, recua +Y. O `zIndex` da aresta de obsolescência
  // (`dependency-graph.tsx`) põe o glifo numa camada ACIMA dos nós, para o
  // caso de o recuo não bastar.
  const recuoPx = RECUO_GLIFO_OBSOLESCENCIA_PX / zoomSeguro;
  const entraPorBaixo = targetPosition === Position.Bottom;
  const glifoEndX = targetX;
  const glifoEndY =
    data.camada === "obsolescencia"
      ? targetY + (entraPorBaixo ? recuoPx : -recuoPx)
      : targetY;

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
