import "server-only";
/**
 * OS-LIFEBOARD · P6 — OS ELOS DE PRECEDÊNCIA, EM UM LUGAR SÓ. PURA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * [ALTO A5, rodada 11] A PÁGINA MOSTRAVA O CRONOGRAMA E ESCONDIA OS ELOS QUE
 * O PRODUZEM.
 *
 * `caminho-critico.ts` montava a precedência somando TRÊS fontes
 * (`predecessorIds` ∪ `successorIds` ∪ arestas de tipo `predecessor`).
 * `page.tsx` montava a lista "Relações" com UMA (as arestas). Medido em
 * `/tarefa/task-build`: o cabeçalho dizia "Relações (2)", o cronograma usava
 * 4 elos, e o caminho crítico real — `task-setup → task-build → task-deploy`
 * — era invisível e inalcançável, enquanto a MESMA tela estampava
 * "folga 0 · crítico" ao lado.
 *
 * A correção não é copiar a soma para a página (era assim que as duas
 * listas divergiam). É esta função: **o cronograma e a lista leem a mesma
 * função**, e cada elo carrega DE ONDE veio — o que a tela usa para dizer,
 * em português, qual elo ela não consegue editar e por quê.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Task, TaskEdge } from "@/types/canonical";

/** De onde o elo veio — é o que decide se a tela consegue editá-lo. */
export type FonteDoElo = "predecessorIds" | "successorIds" | "aresta";

export interface EloDePrecedencia {
  origem: string;
  destino: string;
  /** Todas as fontes que declaram este mesmo elo (dedupe por par). */
  fontes: FonteDoElo[];
  /** O `id` da aresta, quando alguma fonte é uma aresta editável. */
  arestaId: string | null;
}

/**
 * Todos os elos "origem precede destino" do grafo, deduplicados por par.
 *
 * `permitido` poda o grafo do jeito que o CPM precisa (nós em ciclo ou já
 * obsoletos saem antes do cálculo). Sem ele, nada é podado — é o que a
 * página quer: mostrar o elo mesmo quando o nó saiu da conta.
 *
 * Auto-laço nunca é elo (mesma convenção de `dag.ts`/`caminho-critico.ts`).
 */
export function elosDePrecedencia(
  tasks: readonly Task[],
  edges: readonly TaskEdge[],
  permitido?: (id: string) => boolean,
): EloDePrecedencia[] {
  const porPar = new Map<string, EloDePrecedencia>();

  const somar = (
    origem: string,
    destino: string,
    fonte: FonteDoElo,
    arestaId: string | null,
  ): void => {
    if (origem === destino) return;
    if (permitido !== undefined && (!permitido(origem) || !permitido(destino))) return;
    const chave = `${origem}\u0000${destino}`;
    const existente = porPar.get(chave);
    if (existente === undefined) {
      porPar.set(chave, { origem, destino, fontes: [fonte], arestaId });
      return;
    }
    if (!existente.fontes.includes(fonte)) existente.fontes.push(fonte);
    if (existente.arestaId === null && arestaId !== null) existente.arestaId = arestaId;
  };

  for (const t of tasks) {
    for (const p of t.predecessorIds) somar(p, t.id, "predecessorIds", null);
    for (const s of t.successorIds) somar(t.id, s, "successorIds", null);
  }
  for (const e of edges) {
    if (e.tipo === "predecessor") somar(e.origem, e.destino, "aresta", e.id);
  }

  return [...porPar.values()];
}

/**
 * Os elos que a tela NÃO consegue editar: os que nascem só dos arrays
 * `predecessorIds`/`successorIds` da tarefa (não há aresta por trás deles, e
 * esta página não edita esses campos). Ficam visíveis assim mesmo — invisível
 * era o defeito.
 */
export function elosNaoEditaveis(elos: readonly EloDePrecedencia[]): EloDePrecedencia[] {
  return elos.filter((e) => e.arestaId === null);
}
