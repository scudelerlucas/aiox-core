import "server-only";
/**
 * OS-LIFEBOARD · E4 — Resolução de dependências + detecção de ciclo (camada O). PURA.
 *
 * [v3, 2026-09-13] `detectCycleIds` passou a aceitar `task_edges` (só as de
 * `tipo = "predecessor"`) como terceira fonte de precedência — a mesma união que
 * a migration 0005 impõe no banco. O `server-only` FICA: o CPM (`caminho-critico.ts`)
 * roda no servidor e o resultado (ids críticos, janelas) desce ao grafo como
 * dado serializado, nunca a função.
 *
 * Espelha CONCEITUALMENTE o trigger SQL anti-ciclo de E1
 * (`supabase/migrations/0001_init.sql` → `lifeboard_check_task_dag`), mas em
 * TypeScript puro sobre o array em memória. Cobre o stress test 1 do PRD §11
 * (A→B→A) também na camada de aplicação, complementando a checagem no banco.
 *
 * ── Arestas de PRECEDÊNCIA (x "antes de" y  ⇒  x → y) ────────────────────────
 * Combina as DUAS representações do modelo canônico, igual ao trigger de E1:
 *   • y.predecessorIds contém x   ⇒   x → y
 *   • x.successorIds   contém y   ⇒   x → y
 * Auto-referência (id no próprio predecessor/successor) é ciclo trivial.
 *
 * ── Ciclo não derruba o serviço (degradação graciosa, PRD §9) ────────────────
 * As tarefas participantes de um ciclo são EXCLUÍDAS da lista "hoje" e devolvidas
 * em `cyclic` (flag de erro). O log fica no shell impuro (`/api/today`), mantendo
 * este core puro (Pure Core / Impure Shell — architecture.md §2.5).
 *
 * ── Acionabilidade (PRD §4 / arch §8) ────────────────────────────────────────
 * Uma tarefa é "acionável hoje" só se TODOS os seus `predecessorIds` estiverem
 * resolvidos. Predecessor RESOLVIDO =
 *   • presente na lista com status 'done', OU
 *   • AUSENTE da lista recebida — [AUTO-DECISION] tratado como RESOLVIDO
 *     (concluído-e-filtrado, purgado, ou de fonte não carregada). Razão: senão a
 *     tarefa ficaria presa para sempre por uma referência órfã; alinhado ao
 *     append-only + degradação graciosa (PRD §9). Só `predecessorIds` bloqueiam
 *     (successorIds não bloqueiam — quem depende é o sucessor).
 */

import type { Task, TaskEdge } from "@/types/canonical";

export interface DagResult {
  /** Não-concluídas, sem predecessor aberto e fora de ciclo. Candidatas a "hoje". */
  actionable: Task[];
  /** Não-concluídas com ≥1 predecessor aberto. NUNCA entram na lista "hoje". */
  blocked: Task[];
  /** Não-concluídas participantes de um ciclo. Excluídas de "hoje" (flag de erro). */
  cyclic: Task[];
  /** Há pelo menos um ciclo de precedência no grafo recebido? */
  hasCycle: boolean;
}

/**
 * IDs das tarefas participantes de ALGUM ciclo de precedência.
 *
 * Estratégia: monta o grafo de precedência (arestas das duas representações),
 * roda Tarjan (componentes fortemente conexos) e marca como cíclico todo nó de
 * um SCC de tamanho > 1, além de qualquer auto-referência. Termina sempre (sem
 * loop infinito), igual à garantia do `union` deduplicado do trigger SQL.
 */
export function detectCycleIds(tasks: Task[], edges: readonly TaskEdge[] = []): Set<string> {
  const ids = new Set(tasks.map((t) => t.id));
  const adj = new Map<string, string[]>();
  const cyclic = new Set<string>();

  const addEdge = (from: string, to: string): void => {
    if (!ids.has(from) || !ids.has(to)) return; // ignora arestas para fora da lista
    const arr = adj.get(from);
    if (arr) arr.push(to);
    else adj.set(from, [to]);
  };

  for (const t of tasks) {
    // Auto-referência = ciclo trivial (igual ao trigger de E1).
    if (t.predecessorIds.includes(t.id) || t.successorIds.includes(t.id)) {
      cyclic.add(t.id);
    }
    for (const p of t.predecessorIds) addEdge(p, t.id); // p → t
    for (const s of t.successorIds) addEdge(t.id, s); // t → s
  }
  // Terceira fonte (v3): arestas declaradas de precedência. Auto-laço não chega
  // aqui (o normalizador e o CHECK do banco descartam), mas custa nada cobrir.
  for (const e of edges) {
    if (e.tipo !== "predecessor") continue;
    if (e.origem === e.destino && ids.has(e.origem)) cyclic.add(e.origem);
    else addEdge(e.origem, e.destino);
  }

  // ── Tarjan SCC (iterativo via recursão simples; profundidade ≤ N ≤ 1k) ──────
  let counter = 0;
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];

  const strongConnect = (v: string): void => {
    const vIndex = counter++;
    index.set(v, vIndex);
    lowlink.set(v, vIndex);
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v) ?? vIndex, lowlink.get(w) ?? vIndex));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v) ?? vIndex, index.get(w) ?? vIndex));
      }
    }

    if ((lowlink.get(v) ?? vIndex) === vIndex) {
      const component: string[] = [];
      for (;;) {
        const w = stack.pop();
        if (w === undefined) break;
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      if (component.length > 1) {
        for (const node of component) cyclic.add(node);
      }
    }
  };

  for (const v of ids) {
    if (!index.has(v)) strongConnect(v);
  }

  return cyclic;
}

/**
 * Classifica as tarefas em acionável / bloqueada / cíclica (PRD §4 / arch §8).
 * Puro: entrada → saída, sem I/O. Tarefas concluídas ('done') não são candidatas.
 */
export function resolveActionable(tasks: Task[]): DagResult {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const cyclicIds = detectCycleIds(tasks);

  const actionable: Task[] = [];
  const blocked: Task[] = [];
  const cyclic: Task[] = [];

  for (const task of tasks) {
    if (task.status === "done") continue; // concluída não é candidata a "hoje"
    if (cyclicIds.has(task.id)) {
      cyclic.push(task); // participa de ciclo → excluída (flag de erro)
      continue;
    }

    const hasOpenPredecessor = task.predecessorIds.some((pid) => {
      const pred = byId.get(pid);
      if (!pred) return false; // ausente ⇒ resolvido (AUTO-DECISION, ver cabeçalho)
      return pred.status !== "done"; // presente e não-'done' ⇒ bloqueia
    });

    if (hasOpenPredecessor) blocked.push(task);
    else actionable.push(task);
  }

  return { actionable, blocked, cyclic, hasCycle: cyclicIds.size > 0 };
}
