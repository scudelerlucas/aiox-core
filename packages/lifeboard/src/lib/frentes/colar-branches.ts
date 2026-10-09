import type { Task, TaskEdge } from "@/types/canonical";

/** Substitui, apenas no grafo, cada branch materializada por sua única mudança. */
export function colarBranchesNaMudanca(
  tasks: Task[],
  edges: TaskEdge[],
  branchesColadas: ReadonlyMap<string, string>,
): { tasks: Task[]; edges: TaskEdge[] } {
  const ids = new Set(tasks.map((task) => task.id));
  const colagens = new Map(
    [...branchesColadas].filter(([branch, mudanca]) => ids.has(branch) && ids.has(mudanca)),
  );
  const restantes = tasks.filter((task) => !colagens.has(task.id));
  const idsRestantes = new Set(restantes.map((task) => task.id));
  const chaves = new Set<string>();
  const edgesFinais: TaskEdge[] = [];

  for (const edge of edges) {
    const origem = colagens.get(edge.origem) ?? edge.origem;
    const destino = colagens.get(edge.destino) ?? edge.destino;
    if (origem === destino || !idsRestantes.has(origem) || !idsRestantes.has(destino)) continue;
    const chave = `${origem}|${destino}|${edge.tipo}`;
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    edgesFinais.push({ ...edge, origem, destino });
  }

  const predecessores = new Map<string, Set<string>>();
  const sucessores = new Map<string, Set<string>>();
  for (const edge of edgesFinais) {
    if (edge.tipo !== "predecessor") continue;
    const pred = predecessores.get(edge.destino) ?? new Set<string>();
    pred.add(edge.origem);
    predecessores.set(edge.destino, pred);
    const succ = sucessores.get(edge.origem) ?? new Set<string>();
    succ.add(edge.destino);
    sucessores.set(edge.origem, succ);
  }

  return {
    tasks: restantes.map((task) => ({
      ...task,
      predecessorIds: [...(predecessores.get(task.id) ?? [])].sort(),
      successorIds: [...(sucessores.get(task.id) ?? [])].sort(),
    })),
    edges: edgesFinais,
  };
}
