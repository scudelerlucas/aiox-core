/**
 * OS-LIFEBOARD · P4b — Layout em CAMADAS (rank) do grafo de dependências.
 *
 * Corrige o achado CRÍTICO do crítico hostil (13/09/2026): o layout anterior
 * (`dependency-graph.tsx` v2) fazia `col = i % COLS_MAX` sobre o ÍNDICE de
 * encontro no array de tarefas, com sub-linhas de transbordo DENTRO de cada
 * profundidade. Como uma profundidade com >COLS_MAX tarefas soterrava algumas
 * delas numa sub-linha visualmente abaixo, um nó SEM relação de precedência
 * nenhuma ("Daily standup", profundidade 0, sem predecessor/sucessor) acabava
 * desenhado na mesma coluna e "entre" duas linhas de uma cadeia real
 * (setup→build→deploy) — a aresta crítica (traço triplo) passava reto por
 * cima do card dele. Prova: fixture do teste abaixo.
 *
 * Regra nova, sem ambiguidade:
 *   - **linha (rank)** = profundidade topológica por caminho mais longo a
 *     partir das fontes (raiz sem predecessor = rank 0), pela MESMA união de
 *     precedência que o CPM usa: `predecessorIds ∪ successorIds (invertido) ∪
 *     TaskEdge tipo=predecessor`. Cada rank é UMA linha — nunca quebra em
 *     sub-linhas por dentro (era exatamente a quebra que causava a colisão).
 *   - **coluna** = ordem ESTÁVEL dentro do rank: nós críticos primeiro, depois
 *     por id crescente — nunca pela ordem de chegada no array de tarefas (essa
 *     era a segunda causa: a ordem de chegada é arbitrária e muda o desenho a
 *     cada edição do fixture/produção).
 *   - **aresta que pula rank** (destino.rank − origem.rank > 1) ganha a flag
 *     `desviar: true` quando alguma célula INTERMEDIÁRIA (rank estritamente
 *     entre os dois, na coluna de origem OU de destino) está ocupada — só aí
 *     faz sentido desviar o traço; um pulo sobre uma coluna vazia não precisa.
 *
 * Módulo PURO (sem React/ReactFlow) — testável isoladamente e reusado por
 * `dependency-graph.tsx`.
 */

import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

export interface LayoutDoGrafoParams {
  /** Todas as tarefas do grafo (nós sem nenhuma aresta entram no rank 0). */
  ids: readonly string[];
  /** União de precedência — MESMA fonte que `caminhoCritico` usa (não recalcular diferente). */
  edges: readonly { origem: string; destino: string }[];
  /** Ids no caminho crítico — critério de desempate de coluna (crítico primeiro). */
  criticoIds?: ReadonlySet<string> | readonly string[];
  nodeW?: number;
  nodeH?: number;
  gapX?: number;
  gapY?: number;
  /**
   * P4c (achado CRÍTICO #2, cobertura completa): o RANK só pode vir da
   * precedência (`edges` acima) — misturar sinergia/correlação/obsolescência
   * ali corromperia a topologia (uma sinergia entre irmãos viraria precedência
   * falsa). Mas o DESVIO geométrico (item 2 da spec) precisa valer para TODAS
   * as 6 arestas visuais, não só sucessão — o crítico mediu invasão real de
   * até 64px em arestas de sinergia/obsolescência que pulam rank sobre um nó
   * ocupado. Passar aqui a união de TODOS os pares origem→destino visíveis no
   * grafo (as 6 camadas); ausente = usa só `edges` (compat, mesmo
   * comportamento de antes — é o que os testes existentes fazem).
   */
  todasArestas?: readonly { origem: string; destino: string }[];
}

export interface NoDoLayout {
  id: string;
  /** Profundidade topológica (0 = raiz sem predecessor). */
  rank: number;
  /** Posição estável dentro do rank (crítico primeiro, depois por id). */
  coluna: number;
  x: number;
  y: number;
}

export interface ArestaDoLayout {
  origem: string;
  destino: string;
  /** `rank(destino) − rank(origem) > 1` — pula ao menos uma linha. */
  pulaRank: boolean;
  /**
   * `true` só quando `pulaRank` E alguma linha intermediária tem um nó na
   * MESMA coluna de origem ou de destino — é aí que o traço reto passaria por
   * cima de um card sem relação. `renderer` (v3-edge.tsx) usa esta flag para
   * desenhar o desvio ortogonal (não é mais um parâmetro do smoothstep — P4c
   * achado CRÍTICO #2: com handles Bottom→Top, `getSmoothStepPath` só lê
   * `centerY`, nunca `centerX`, então o `centerX` desviado do P4b nunca
   * aparecia no `d` renderizado).
   */
  desviar: boolean;
  /** Meio gap horizontal do desvio, em px de mundo (não de tela). */
  desvioPx: number;
  /**
   * Faixa vertical (em px de mundo, mesma escala de `NoDoLayout.y`) que o
   * desvio precisa contornar — união de todos os ranks intermediários
   * ocupados que causaram `desviar`, com margem de meio `gapY`. `undefined`
   * quando `desviar` é `false`. `v3-edge.tsx` usa os dois para desenhar o
   * caminho ortogonal: desce até `desvioYInicio`, salta `desvioPx` para o
   * lado, desce até `desvioYFim`, volta para a coluna de destino, desce até
   * o handle.
   */
  desvioYInicio?: number;
  desvioYFim?: number;
}

export interface ResultadoLayout {
  nodes: Map<string, NoDoLayout>;
  edges: ArestaDoLayout[];
}

/**
 * P4c (achado CRÍTICO #1a/#1b, 13/09/2026): `nodeH: 96` era o palpite antigo —
 * o card real mede 124-207px de mundo quando o rodapé quebra em 3-4 linhas
 * (medido pelo crítico hostil, ROUND 2). `task-node.tsx` agora tem altura
 * FIXA — `112` é o piso determinístico. P4d (achado MÉDIO #6, rodada 3):
 * `ALTURA_DO_CARTAO` (`@/types/grafo-v3`) é o ÚNICO lugar onde esse número
 * existe — antes eram DOIS hardcoded (aqui e em `task-node.tsx`) que só
 * coincidiam por disciplina manual, e nenhum teste comparava um contra o
 * outro. `gapY: 84` já satisfazia o piso de 60px do item 1b; o `Math.max`
 * abaixo é só a garantia de que nenhum caller consegue passar um `gapY`
 * menor que isso sem querer.
 */
const DEFAULTS = { nodeW: 200, nodeH: ALTURA_DO_CARTAO, gapX: 56, gapY: 84 } as const;
/** Piso de `gapY` (item 1b da spec do P4c) — nunca aceitar menos, mesmo passado por fora. */
const GAP_Y_MINIMO = 60;

/** Rank por caminho mais longo a partir das fontes, com guarda de ciclo (corta em 0, nunca trava). */
function computeRanks(
  ids: readonly string[],
  predsOf: Map<string, string[]>,
): Map<string, number> {
  const memo = new Map<string, number>();
  const visitando = new Set<string>();

  const rank = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visitando.has(id)) return 0; // ciclo → corta, nunca recursão infinita
    visitando.add(id);
    let r = 0;
    for (const p of predsOf.get(id) ?? []) r = Math.max(r, rank(p) + 1);
    visitando.delete(id);
    memo.set(id, r);
    return r;
  };

  for (const id of ids) rank(id);
  return memo;
}

export function layoutDoGrafo(params: LayoutDoGrafoParams): ResultadoLayout {
  const { ids, edges } = params;
  const nodeW = params.nodeW ?? DEFAULTS.nodeW;
  const nodeH = params.nodeH ?? DEFAULTS.nodeH;
  const gapX = params.gapX ?? DEFAULTS.gapX;
  const gapY = Math.max(params.gapY ?? DEFAULTS.gapY, GAP_Y_MINIMO);
  const critico =
    params.criticoIds instanceof Set
      ? params.criticoIds
      : new Set(params.criticoIds ?? []);

  const idSet = new Set(ids);
  const predsOf = new Map<string, string[]>();
  for (const { origem, destino } of edges) {
    if (!idSet.has(origem) || !idSet.has(destino)) continue;
    const arr = predsOf.get(destino);
    if (arr) arr.push(origem);
    else predsOf.set(destino, [origem]);
  }

  const ranks = computeRanks(ids, predsOf);

  // Agrupa por rank, na ordem de chegada (a ordem final vem do sort abaixo —
  // isto é só o balde antes de ordenar, não decide coluna nenhuma).
  const porRank = new Map<number, string[]>();
  for (const id of ids) {
    const r = ranks.get(id) ?? 0;
    const balde = porRank.get(r);
    if (balde) balde.push(id);
    else porRank.set(r, [id]);
  }

  // Coluna estável: crítico primeiro, depois por id — NUNCA pela ordem de
  // chegada no array de tarefas (é o que fazia o desenho mudar sozinho a
  // cada edição do fixture, e o que empilhava "Daily standup" por acaso na
  // mesma coluna da cadeia setup→build→deploy).
  const nodes = new Map<string, NoDoLayout>();
  for (const [r, idsDoRank] of porRank) {
    const ordenados = [...idsDoRank].sort((a, b) => {
      const critA = critico.has(a) ? 0 : 1;
      const critB = critico.has(b) ? 0 : 1;
      if (critA !== critB) return critA - critB;
      return a.localeCompare(b);
    });
    ordenados.forEach((id, coluna) => {
      nodes.set(id, {
        id,
        rank: r,
        coluna,
        x: coluna * (nodeW + gapX),
        y: r * (nodeH + gapY),
      });
    });
  }

  const desvioPx = (gapX + nodeW) / 2;
  const margemDesvioY = gapY / 2; // meio gap vertical de folga acima/abaixo da faixa ocupada
  /**
   * P4c (achado CRÍTICO #2, cobertura completa — 2ª rodada de medição): a v1
   * do desvio só disparava em `pulaRank` (destino ≥2 ranks à frente da
   * origem) checando a coluna de origem/destino especificamente — cobria o
   * caso do crítico (`task-review→task-deploy`), mas o crítico hostil TAMBÉM
   * mediu 55-64px de invasão em arestas de SINERGIA/OBSOLESCÊNCIA que ligam
   * nós de rank IGUAL ou até rank MENOR (essas camadas não seguem precedência
   * — o destino pode estar "antes" da origem no rank). O teste certo não é
   * "pulou quantos ranks", é geométrico: o path reto de 3 segmentos (desce →
   * atravessa → desce, os mesmos que `v3-edge.tsx` desenha sem desvio)
   * atravessa o bbox de algum OUTRO nó? Prova de que o desvio em X sempre
   * cabe: `desvioPx = (gapX+nodeW)/2` somado ao CENTRO de um nó (a metade do
   * próprio gap) cai exatamente no meio do corredor vazio entre duas colunas
   * — nenhum nó do grid mora ali, em NENHUM rank — então uma vez detectada a
   * faixa Y a contornar, o desvio de sempre já resolve.
   */
  const nodesLista = [...nodes.values()];
  function calcularDesvio(
    origem: string,
    destino: string,
  ): Pick<ArestaDoLayout, "desviar" | "desvioYInicio" | "desvioYFim"> {
    const noOrigem = nodes.get(origem);
    const noDestino = nodes.get(destino);
    if (!noOrigem || !noDestino) return { desviar: false };

    // P4d (achado ALTO #4 + MÉDIO #5 do crítico hostil ROUND 3): handle de
    // saída/entrada por RANK RELATIVO — não mais Bottom→Top fixo. Uma aresta
    // "pra trás" (obsolescência/sinergia ligando um destino de rank ≤ ao da
    // origem) que sempre saísse por Bottom/entrasse por Top tinha que
    // atravessar o PRÓPRIO cartão de origem por dentro para alcançar um
    // destino que está ACIMA (penetração medida: 55,3–54,1px — a metade da
    // altura do cartão, quase exatamente `nodeH/2`, o raio do ponto médio
    // ingênuo entre Bottom-da-origem e Top-do-destino). Três casos, cada um
    // com o par de handles que NUNCA precisa atravessar nenhum dos dois
    // cartões (handles reais em `task-node.tsx`; escolha replicada em
    // `dependency-graph.tsx` → `handlesDaConexao`, os três comentam um para
    // o outro):
    //   • destino ADIANTE (rank maior)  → sai por Bottom, entra por Top —
    //     igual a antes, o único caso que existia até a rodada 2.
    //   • destino no MESMO rank        → sai por Top, entra por Top: os dois
    //     lados ficam na MESMA cota Y (o topo da fileira) — a média dos dois
    //     é essa MESMA cota, nunca a metade de um cartão (a causa do achado
    //     MÉDIO #5, o "desvio degenerado": com Bottom/Top, sourceY e targetY
    //     diferem por `nodeH`, e a média cai bem no meio da fileira).
    //   • destino ATRÁS (rank menor)   → sai por Top, entra por Bottom: os
    //     dois lados abrem para o VÃO entre as duas fileiras (nunca para
    //     dentro do próprio cartão), exatamente como o caso "adiante"
    //     espelhado.
    const rankOrigem = noOrigem.rank;
    const rankDestino = noDestino.rank;
    const sourceX = noOrigem.x + nodeW / 2;
    const targetX = noDestino.x + nodeW / 2;
    const sourceY = rankDestino > rankOrigem ? noOrigem.y + nodeH : noOrigem.y;
    const targetY = rankDestino < rankOrigem ? noDestino.y + nodeH : noDestino.y;
    const midY = (sourceY + targetY) / 2;
    const xLo = Math.min(sourceX, targetX);
    const xHi = Math.max(sourceX, targetX);
    const yVertLo1 = Math.min(sourceY, midY);
    const yVertHi1 = Math.max(sourceY, midY);
    const yVertLo2 = Math.min(midY, targetY);
    const yVertHi2 = Math.max(midY, targetY);

    let yTopo = Infinity;
    let yBase = -Infinity;
    let desviar = false;
    for (const n of nodesLista) {
      if (n.id === origem || n.id === destino) continue;
      const nx0 = n.x;
      const nx1 = n.x + nodeW;
      const ny0 = n.y;
      const ny1 = n.y + nodeH;
      // (a) bloqueia o desce inicial (vertical, em sourceX)?
      const bloqueiaA = sourceX > nx0 && sourceX < nx1 && ny0 < yVertHi1 && ny1 > yVertLo1;
      // (b) bloqueia o desce final (vertical, em targetX)?
      const bloqueiaB = targetX > nx0 && targetX < nx1 && ny0 < yVertHi2 && ny1 > yVertLo2;
      // (c) bloqueia o atravessamento (horizontal, em midY)?
      const bloqueiaC = midY > ny0 && midY < ny1 && nx0 < xHi && nx1 > xLo;
      if (bloqueiaA || bloqueiaB || bloqueiaC) {
        desviar = true;
        yTopo = Math.min(yTopo, ny0);
        yBase = Math.max(yBase, ny1);
      }
    }
    if (!desviar) return { desviar: false };
    const desvioYInicio = Math.max(Math.min(sourceY, targetY), yTopo - margemDesvioY);
    const desvioYFim = Math.min(Math.max(sourceY, targetY), yBase + margemDesvioY);
    // P4d (achado MÉDIO #5 do crítico hostil ROUND 3, "desvio degenerado"):
    // o clamp acima existe para nunca desviar mais longe do que o próprio
    // segmento precisa — mas com `sourceY === targetY` (podia acontecer com a
    // convenção antiga de handles fixos) ele colapsava a janela inteira num
    // único ponto, e o path renderizado saía com dois segmentos de
    // comprimento zero e um toco de fração de pixel (medido pelo crítico:
    // `M1892,115 L1892,115 …`). Com os 3 pares de handle acima isso não
    // deveria mais acontecer (prova: `tests/unit/layout-do-grafo.test.ts`,
    // "nunca degenera") — mas o cinto-e-suspensório fica: uma janela que
    // colapsa (ou inverte) vira ROTA DIRETA (sem desvio) em vez de um desvio
    // de largura zero/negativa.
    if (desvioYFim - desvioYInicio < 1) return { desviar: false };
    return { desviar: true, desvioYInicio, desvioYFim };
  }

  // P4c: o desvio geométrico roda sobre TODAS as arestas visuais quando o
  // chamador passar `todasArestas` (as 6 camadas) — só o RANK fica preso à
  // precedência (`edges`, acima). Sem `todasArestas`, comportamento idêntico
  // a antes (só `edges`) — os testes existentes não precisam mudar.
  const arestasParaDesvio = params.todasArestas ?? edges;
  const arestasLayout: ArestaDoLayout[] = arestasParaDesvio
    .filter(({ origem, destino }) => idSet.has(origem) && idSet.has(destino))
    .map(({ origem, destino }) => {
      const noOrigem = nodes.get(origem);
      const noDestino = nodes.get(destino);
      if (!noOrigem || !noDestino) {
        return { origem, destino, pulaRank: false, desviar: false, desvioPx };
      }
      const pulaRank = Math.abs(noDestino.rank - noOrigem.rank) > 1;
      const { desviar, desvioYInicio, desvioYFim } = calcularDesvio(origem, destino);
      return { origem, destino, pulaRank, desviar, desvioPx, desvioYInicio, desvioYFim };
    });

  return { nodes, edges: arestasLayout };
}
