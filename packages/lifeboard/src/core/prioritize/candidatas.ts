import "server-only";
/**
 * OS-LIFEBOARD · P6 — QUEM PODE SER ESCOLHIDO, calculado antes de oferecer. PURA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * [MÉDIO A6, rodada 11] PREVENIR ANTES DE AVISAR (F5 da régua de UI/UX).
 *
 * O `<select>` "Mãe" oferecia as próprias descendentes da tarefa: escolher
 * uma ia ao servidor e voltava com *"Isso criaria um ciclo de hierarquia: a
 * tarefa viraria ancestral de si mesma."*. O `<select>` "Destino" das
 * relações fazia o mesmo com `predecessor` circular e com relações que já
 * existiam. Um erro que a tela podia ter evitado é um erro que ela não devia
 * ter deixado o operador cometer.
 *
 * As duas funções abaixo usam a MESMA régua da gravação — a hierarquia sobe
 * por `parentId` (como `parentSetFixture` e a RPC 0008), e a precedência sai
 * de `elosDePrecedencia` (as 3 fontes que o gatilho `lifeboard_check_edge_dag`
 * lê). Se a régua do servidor mudar, o lugar de mudar é um só.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { elosDePrecedencia } from "@/core/prioritize/elos-de-precedencia";
import type { EdgeTipo, Task, TaskEdge } from "@/types/canonical";

/**
 * A subárvore de `taskId` pela hierarquia (`parentId`), SEM a própria tarefa.
 * Qualquer uma delas como mãe fecharia o ciclo que o servidor recusa.
 */
export function descendentesDe(taskId: string, tasks: readonly Task[]): Set<string> {
  const filhasPorMae = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.parentId === null || t.parentId === undefined) continue;
    const lista = filhasPorMae.get(t.parentId);
    if (lista === undefined) filhasPorMae.set(t.parentId, [t.id]);
    else lista.push(t.id);
  }
  const fora = new Set<string>();
  const pilha = [...(filhasPorMae.get(taskId) ?? [])];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (atual === undefined || fora.has(atual)) continue;
    fora.add(atual);
    for (const filha of filhasPorMae.get(atual) ?? []) pilha.push(filha);
  }
  return fora;
}

/**
 * Para cada outra tarefa, os tipos de relação que o servidor recusaria se
 * esta tarefa fosse a ORIGEM. Dois motivos, os mesmos do servidor:
 *  - já existe uma aresta daquele tipo entre as duas (qualquer tipo);
 *  - `predecessor` fecharia um ciclo de dependências.
 */
export function tiposBloqueadosPorCandidata(
  taskId: string,
  tasks: readonly Task[],
  edges: readonly TaskEdge[],
): Map<string, EdgeTipo[]> {
  const bloqueios = new Map<string, EdgeTipo[]>();
  const somar = (id: string, tipo: EdgeTipo): void => {
    const atual = bloqueios.get(id);
    if (atual === undefined) bloqueios.set(id, [tipo]);
    else if (!atual.includes(tipo)) atual.push(tipo);
  };

  // 1. "Já existe uma aresta desse tipo entre essas duas tarefas."
  for (const e of edges) {
    if (e.origem === taskId) somar(e.destino, e.tipo);
  }

  // 2. "Essa aresta criaria um ciclo de dependências (predecessor circular)."
  //    Alcançáveis a partir da candidata pelas MESMAS 3 fontes de precedência.
  const adj = new Map<string, string[]>();
  for (const elo of elosDePrecedencia(tasks, edges)) {
    const lista = adj.get(elo.origem);
    if (lista === undefined) adj.set(elo.origem, [elo.destino]);
    else lista.push(elo.destino);
  }
  for (const candidata of tasks) {
    if (candidata.id === taskId) continue;
    const vistos = new Set<string>();
    const fila = [candidata.id];
    let fechaCiclo = false;
    while (fila.length > 0 && !fechaCiclo) {
      const atual = fila.shift();
      if (atual === undefined || vistos.has(atual)) continue;
      vistos.add(atual);
      if (atual === taskId) fechaCiclo = true;
      else for (const proximo of adj.get(atual) ?? []) fila.push(proximo);
    }
    if (fechaCiclo) somar(candidata.id, "predecessor");
  }

  return bloqueios;
}
