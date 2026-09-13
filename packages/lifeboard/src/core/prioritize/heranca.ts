import "server-only";
/**
 * OS-LIFEBOARD · P6 — Herança de esforço/custo de mãe para filha. PURA.
 *
 * Regra (hub, `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md` §5/§6):
 * "a mãe herda esforço e custo como soma das filhas abertas". Uma tarefa com
 * subtarefas não some — mas o esforço/custo dela na conta do score deixa de
 * ser o que ELA declarou e passa a ser a SOMA do que as filhas ainda abertas
 * declararam (o trabalho real está nelas). Sem filha aberta, os átomos
 * próprios (se houver) valem — a mãe é folha na prática.
 *
 * server-only por convenção da camada O (mesma defesa em profundidade de
 * `assimetria.ts`/`caminho-critico.ts`) — ainda que esta função não leia
 * segredo nenhum, mora ao lado de quem lê.
 */

import type { Task } from "@/types/canonical";

export interface HerancaResultado {
  /** Esforço efetivo: soma das filhas abertas, ou o próprio quando não há filha aberta. */
  esforco: number;
  /** Custo efetivo: mesma regra do esforço. */
  custo: number;
  /** `true` quando o valor veio da soma das filhas abertas (não do átomo próprio). */
  herdado: boolean;
  /** Quantas filhas abertas entraram na soma (0 quando `herdado` é falso). */
  filhasAbertas: number;
}

/**
 * `filhas`: só as tarefas com `parentId === task.id` (o chamador filtra; esta
 * função não varre a lista inteira, para não depender de conhecer o grafo
 * inteiro). Filha sem `assimetria` declarada entra na soma como 0 — ela conta
 * como filha aberta (o trabalho existe), só não tem átomo para somar ainda.
 */
export function heranca(task: Task, filhas: readonly Task[]): HerancaResultado {
  const abertas = filhas.filter((f) => f.status !== "done");

  if (abertas.length === 0) {
    return {
      esforco: task.assimetria?.esforco ?? 0,
      custo: task.assimetria?.custo ?? 0,
      herdado: false,
      filhasAbertas: 0,
    };
  }

  let esforco = 0;
  let custo = 0;
  for (const filha of abertas) {
    esforco += filha.assimetria?.esforco ?? 0;
    custo += filha.assimetria?.custo ?? 0;
  }

  return { esforco, custo, herdado: true, filhasAbertas: abertas.length };
}
