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
   * cima de um card sem relação. `renderer` (v3-edge.tsx) lê esta flag para
   * desviar o `centerX` do smoothstep por meio gap.
   */
  desviar: boolean;
  /** Meio gap horizontal sugerido para o desvio, em px de mundo (não de tela). */
  desvioPx: number;
}

export interface ResultadoLayout {
  nodes: Map<string, NoDoLayout>;
  edges: ArestaDoLayout[];
}

const DEFAULTS = { nodeW: 200, nodeH: 96, gapX: 56, gapY: 84 } as const;

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
  const gapY = params.gapY ?? DEFAULTS.gapY;
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

  // Índice coluna→ids por rank, para o teste de ocupação das arestas que pulam rank.
  const colunaPorRank = new Map<number, Map<number, string>>();
  for (const no of nodes.values()) {
    let mapa = colunaPorRank.get(no.rank);
    if (!mapa) {
      mapa = new Map();
      colunaPorRank.set(no.rank, mapa);
    }
    mapa.set(no.coluna, no.id);
  }

  const desvioPx = (gapX + nodeW) / 2; // "meio gap" — spec do crítico, item 1
  const arestasLayout: ArestaDoLayout[] = edges
    .filter(({ origem, destino }) => idSet.has(origem) && idSet.has(destino))
    .map(({ origem, destino }) => {
      const noOrigem = nodes.get(origem);
      const noDestino = nodes.get(destino);
      if (!noOrigem || !noDestino) {
        return { origem, destino, pulaRank: false, desviar: false, desvioPx };
      }
      const distancia = noDestino.rank - noOrigem.rank;
      const pulaRank = distancia > 1;
      let desviar = false;
      if (pulaRank) {
        for (let r = noOrigem.rank + 1; r < noDestino.rank; r++) {
          const mapa = colunaPorRank.get(r);
          if (!mapa) continue;
          if (mapa.has(noOrigem.coluna) || mapa.has(noDestino.coluna)) {
            desviar = true;
            break;
          }
        }
      }
      return { origem, destino, pulaRank, desviar, desvioPx };
    });

  return { nodes, edges: arestasLayout };
}
