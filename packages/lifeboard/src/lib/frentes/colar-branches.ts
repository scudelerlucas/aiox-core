import type { Task, TaskEdge } from "@/types/canonical";

/** Substitui, apenas no grafo, cada branch materializada por sua única mudança. */
export function colarBranchesNaMudanca(
  tasks: Task[],
  edges: TaskEdge[],
  branchesColadas: ReadonlyMap<string, string>,
): { tasks: Task[]; edges: TaskEdge[] } {
  const ids = new Set(tasks.map((task) => task.id));
  if (branchesColadas.size === 0) return { tasks, edges };
  const colagens = new Map(
    [...branchesColadas].filter(([branch, mudanca]) => ids.has(branch) && ids.has(mudanca)),
  );
  const restantes = tasks.filter((task) => !colagens.has(task.id));
  const idsRestantes = new Set(restantes.map((task) => task.id));
  const chaves = new Set<string>();
  const edgesFinais: TaskEdge[] = [];
  // Precedência que a colagem redirecionou: só ela entra nas listas a partir das arestas.
  const redirecionadas: TaskEdge[] = [];

  for (const edge of edges) {
    const origem = colagens.get(edge.origem) ?? edge.origem;
    const destino = colagens.get(edge.destino) ?? edge.destino;
    if (origem === destino || !idsRestantes.has(origem) || !idsRestantes.has(destino)) continue;
    const chave = `${origem}|${destino}|${edge.tipo}`;
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    const nova = { ...edge, origem, destino };
    edgesFinais.push(nova);
    if (edge.tipo === "predecessor" && (colagens.has(edge.origem) || colagens.has(edge.destino))) {
      redirecionadas.push(nova);
    }
  }

  // As listas de vizinhos são preservadas e remapeadas, nunca reconstruídas só das arestas:
  // precedência que existe só na lista (sem aresta) continua valendo para o caminho crítico.
  const remapear = (lista: readonly string[], dono: string): string[] => {
    const vistos = new Set<string>();
    for (const id of lista) {
      const novo = colagens.get(id) ?? id;
      if (novo !== dono && idsRestantes.has(novo)) vistos.add(novo);
    }
    return [...vistos];
  };

  // Cada task colada entrega suas listas à mudança que a substitui.
  const herdadoPred = new Map<string, string[]>();
  const herdadoSucc = new Map<string, string[]>();
  for (const task of tasks) {
    const alvo = colagens.get(task.id);
    if (!alvo) continue;
    herdadoPred.set(alvo, [...(herdadoPred.get(alvo) ?? []), ...task.predecessorIds]);
    herdadoSucc.set(alvo, [...(herdadoSucc.get(alvo) ?? []), ...task.successorIds]);
  }
  const dasArestasPred = new Map<string, string[]>();
  const dasArestasSucc = new Map<string, string[]>();
  for (const edge of redirecionadas) {
    dasArestasPred.set(edge.destino, [...(dasArestasPred.get(edge.destino) ?? []), edge.origem]);
    dasArestasSucc.set(edge.origem, [...(dasArestasSucc.get(edge.origem) ?? []), edge.destino]);
  }

  const toca = (task: Task): boolean =>
    herdadoPred.has(task.id) ||
    dasArestasPred.has(task.id) ||
    dasArestasSucc.has(task.id) ||
    task.predecessorIds.some((id) => colagens.has(id)) ||
    task.successorIds.some((id) => colagens.has(id));
  const unir = (...listas: string[][]): string[] => [...new Set(listas.flat())];

  return {
    // Tarefa sem relação com nenhuma colagem sai como entrou (mesmo objeto).
    tasks: restantes.map((task) =>
      toca(task)
        ? {
            ...task,
            predecessorIds: remapear(
              unir(task.predecessorIds, herdadoPred.get(task.id) ?? [], dasArestasPred.get(task.id) ?? []),
              task.id,
            ),
            successorIds: remapear(
              unir(task.successorIds, herdadoSucc.get(task.id) ?? [], dasArestasSucc.get(task.id) ?? []),
              task.id,
            ),
          }
        : task,
    ),
    edges: edgesFinais,
  };
}
