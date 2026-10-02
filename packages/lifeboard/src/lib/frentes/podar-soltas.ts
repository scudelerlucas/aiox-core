import type { Task, TaskEdge } from "@/types/canonical";

/** 46 de 74 conversas estavam em grau zero na medição de 26/09/2026. */
export const CONVERSAS_SOLTAS_MEDIDAS = 46;

/** Remove exclusivamente conversas materializadas sem aresta do universo do grafo. */
export function podarConversasSoltas(
  tasks: Task[],
  edges: TaskEdge[],
  conversasMaterializadas: ReadonlySet<string>,
): Task[] {
  const ligadas = new Set<string>();
  for (const edge of edges) {
    ligadas.add(edge.origem);
    ligadas.add(edge.destino);
  }
  return tasks.filter((task) => !conversasMaterializadas.has(task.id) || ligadas.has(task.id));
}
