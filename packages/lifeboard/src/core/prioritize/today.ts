import "server-only";
/**
 * OS-LIFEBOARD · E4 — Monta a lista "hoje" ordenada + justificativa (camada O). PURA.
 *
 * Fluxo (arch §8 / PRD §4):
 *   1. filtra só tarefas `status !== 'done'` (omite concluídas);
 *   2. calcula acionáveis via `resolveActionable` (respeita dependências, exclui
 *      ciclos) — um predecessor 'done' saiu no passo 1, logo o dag o vê como
 *      ausente e o trata como RESOLVIDO (ver AUTO-DECISION em `dag.ts`);
 *   3. ordena as acionáveis por HIERARQ (`compareHierarq`: produto desc,
 *      desempate s1>s3>s2);
 *   4. gera uma `reason` curta por item.
 *
 * Tarefas bloqueadas (predecessor aberto) NUNCA entram na lista. Tarefas em ciclo
 * são excluídas e devolvidas em `excludedCycles` (flag de erro, PRD §11 stress-1).
 *
 * server-only: camada O inalienável, jamais no bundle client (kill-switch nº 3).
 */

import { resolveActionable } from "@/core/prioritize/dag";
import { compareHierarq, scoreHierarq } from "@/core/prioritize/hierarq";
import type { Task } from "@/types/canonical";

export interface TodayItem {
  task: Task;
  /** Justificativa curta de por que o item está aqui/nesta posição. */
  reason: string;
}

export interface TodayList {
  items: TodayItem[];
  /**
   * Campo ADITIVO (além do contrato mínimo `{ items }` do enunciado): tarefas
   * excluídas por participarem de um ciclo de dependência. Serve à degradação
   * graciosa (PRD §9) — o shell (`/api/today`) loga esta flag de erro.
   */
  excludedCycles: Task[];
}

export function buildTodayList(tasks: Task[]): TodayList {
  // 1) só pendentes (arch §8: omite concluídas).
  const pending = tasks.filter((t) => t.status !== "done");
  // 2) acionáveis (respeita dependências + exclui ciclos, sem derrubar o serviço).
  const { actionable, cyclic } = resolveActionable(pending);
  // 3) ordena por HIERARQ.
  const ordered = [...actionable].sort(compareHierarq);
  // 4) justificativa por item.
  const items: TodayItem[] = ordered.map((task, i) => ({
    task,
    reason: reasonFor(task, i, ordered),
  }));

  return { items, excludedCycles: cyclic };
}

/** Razão curta por item, contextual à posição na lista ordenada. */
function reasonFor(task: Task, index: number, ordered: Task[]): string {
  const s = scoreHierarq(task);
  if (ordered.length === 1) return "único item pendente";
  if (index === 0) return `S alto (${s}) e sem dependência aberta`;

  const prev = ordered[index - 1];
  if (!prev) return `S ${s}, sem dependência aberta`;

  if (scoreHierarq(prev) === s) {
    // Mesmo produto que o item imediatamente acima → foi o desempate que decidiu.
    const field = tieBreakField(prev, task);
    return field
      ? `desempate por ${field}`
      : "mesmo S e mesmos pesos (ordem estável)";
  }

  return `S ${s}, sem dependência aberta`;
}

/**
 * Qual campo decidiu o desempate entre `higher` (ranqueada acima) e `lower`,
 * na ordem S1 > S3 > S2 (PRD §4). `null` se são idênticas em s1/s3/s2.
 */
function tieBreakField(higher: Task, lower: Task): "s1" | "s3" | "s2" | null {
  const a = higher.priorityHierarq;
  const b = lower.priorityHierarq;
  if (a.s1 !== b.s1) return "s1";
  if (a.s3 !== b.s3) return "s3";
  if (a.s2 !== b.s2) return "s2";
  return null;
}
