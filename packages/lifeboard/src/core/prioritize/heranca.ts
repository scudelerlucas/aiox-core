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
 * v2 (pós-reprovação do crítico, 13/09/2026 — achado CRÍTICO #1): a v1 parava
 * na primeira geração — uma filha SEM átomos próprios mas com netas contava
 * 0, mesmo que as netas tivessem átomos reais. `herancaEfetiva` substitui
 * `heranca`: RECURSIVA (a contribuição de cada filha é o efetivo DELA, mesma
 * regra aplicada de novo — filha sem filhas usa os átomos próprios dela, ou 0)
 * e com guarda de ciclo (`visitados`, defesa em profundidade — o CHECK de
 * `parent_id` na migration 0005 já proíbe ciclo no banco, mas o fixture e os
 * testes não passam por lá). Consumida por `assimetria.ts` — o score deixou
 * de ignorar a herança (era só decorativa na UI antes disso).
 *
 * `HerancaResultado` mudou de casa: agora é o contrato em `tipos-v3.ts`
 * (achado BAIXO #19) — este módulo só re-exporta para quem já importava daqui.
 *
 * server-only por convenção da camada O (mesma defesa em profundidade de
 * `assimetria.ts`/`caminho-critico.ts`) — ainda que esta função não leia
 * segredo nenhum, mora ao lado de quem lê.
 */

import type { HerancaResultado } from "@/core/prioritize/tipos-v3";
import type { Task } from "@/types/canonical";

export type { HerancaResultado };

/**
 * Mapa `parentId → filhos diretos`, construído 1x por quem chama em lote
 * (`scoreAssimetriaLote`) em vez de refazer a varredura O(N) por tarefa.
 */
export function filhosPorPai(tasks: readonly Task[]): Map<string, Task[]> {
  const mapa = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parentId === null || t.parentId === undefined) continue;
    const lista = mapa.get(t.parentId);
    if (lista) lista.push(t);
    else mapa.set(t.parentId, [t]);
  }
  return mapa;
}

function calcular(task: Task, filhosMapa: Map<string, Task[]>, visitados: Set<string>): HerancaResultado {
  // Guarda de ciclo: um nó já visitado nesta descida não contribui de novo —
  // sem isto, um ciclo A→B→A (que só o banco impede, não a memória) recursaria
  // para sempre. Contribuição zero, não erro: a UI mostra um número, nunca quebra.
  if (visitados.has(task.id)) {
    return { esforco: 0, custo: 0, herdado: false, filhasAbertas: 0 };
  }
  visitados.add(task.id);

  const filhos = filhosMapa.get(task.id) ?? [];
  const abertas = filhos.filter((f) => f.status !== "done");

  if (abertas.length === 0) {
    // Folha na prática (sem filha aberta): os átomos próprios valem — 0/0 se
    // a tarefa nem declarou os seus.
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
    // Recursivo: a contribuição da filha é o EFETIVO dela, não o átomo cru —
    // uma filha sem átomo próprio mas com netas abertas ainda soma o das netas.
    const efetivaFilha = calcular(filha, filhosMapa, visitados);
    esforco += efetivaFilha.esforco;
    custo += efetivaFilha.custo;
  }
  return { esforco, custo, herdado: true, filhasAbertas: abertas.length };
}

/**
 * Herança efetiva de esforço/custo de UMA tarefa (P6). `tasks`: a lista que
 * contém a tarefa e (pelo menos) suas descendentes — o chamador avulso passa
 * a lista inteira do dia; `scoreAssimetriaLote` passa `filhosMapa` já pronto
 * (3º parâmetro) para não reconstruir o índice a cada tarefa.
 */
export function herancaEfetiva(
  task: Task,
  tasks: readonly Task[],
  filhosMapa?: Map<string, Task[]>,
): HerancaResultado {
  const mapa = filhosMapa ?? filhosPorPai(tasks);
  return calcular(task, mapa, new Set());
}
