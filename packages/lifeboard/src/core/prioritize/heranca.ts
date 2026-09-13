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
 * 0, mesmo que as netas tivessem átomos reais. Passou a ser RECURSIVA (a
 * contribuição de cada filha é o efetivo DELA, mesma regra aplicada de novo
 * — filha sem filhas usa os átomos próprios dela, ou 0), com guarda de ciclo
 * (o CHECK de `parent_id` na migration 0005 já proíbe ciclo no banco, mas o
 * fixture e os testes não passam por lá). Consumida por `assimetria.ts` — o
 * score deixou de ignorar a herança (era só decorativa na UI antes disso).
 *
 * v3 (rodada 2 do crítico, 13/09/2026 — achado ALTO #1): existir filha aberta
 * não bastava mais para `herdado: true` — uma subtarefa sem NENHUM átomo em
 * toda a subárvore fazia a mãe "herdar" 0/0, que `assimetria.ts` inflava com
 * `Math.max(1, ·)` para 1/1 (A pulava de 0,36 para 9 num caso medido). Agora
 * a soma só vira herança de verdade quando é > 0; soma zero cai nos átomos
 * PRÓPRIOS da tarefa (mesmo comportamento de "sem filha aberta"), com
 * `herdado: false` e `filhasSemAtomos` contando quantas filhas abertas não
 * contribuíram nada — é o que a interface mostra em vez de "esforço 0, custo 0".
 *
 * v3 também troca a recursão — "cada chamador refaz a árvore inteira"
 * (O(N²) em cadeia de `parentId` funda, medido 1029 ms num N=3000) E "uma
 * chamada de função por nível" (`RangeError: Maximum call stack size
 * exceeded` na MESMA cadeia de 3000, medido ao escrever o teste desta
 * correção) — por uma pilha explícita, iterativa, sem recursão de função:
 * `resolverSubarvore` empilha/desempilha frames à mão (DFS pós-ordem) e
 * preenche `memo` uma vez por tarefa; a profundidade da árvore vira o
 * TAMANHO da pilha em memória, não a profundidade da PILHA DE CHAMADAS do
 * motor JS — não há mais teto de N por causa do V8. `herancaEmLote` reusa o
 * mesmo `memo` entre tarefas (nenhuma reconstrói a subárvore de quem já foi
 * resolvido); `herancaEfetiva` (uso avulso) chama a mesma função só para o
 * necessário a partir de UMA tarefa.
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

const SEM_CONTRIBUICAO: HerancaResultado = {
  esforco: 0,
  custo: 0,
  herdado: false,
  filhasAbertas: 0,
  filhasSemAtomos: 0,
};

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

/** Um frame da pilha explícita: a tarefa, suas filhas ABERTAS já filtradas, e
 * até onde a varredura das filhas já chegou. */
interface Frame {
  task: Task;
  abertas: Task[];
  indice: number;
}

/**
 * A regra de negócio pura (achado ALTO #1): soma o EFETIVO já memoizado de
 * cada filha aberta; um filho ainda não resolvido (ciclo — está mais acima
 * na MESMA descida, então nunca vai terminar antes do pai) conta 0, mesma
 * defesa das versões anteriores. Sem filha aberta, OU soma zero mesmo
 * havendo filha aberta, cai nos átomos PRÓPRIOS da tarefa.
 */
function calcularDoMemo(task: Task, abertas: Task[], memo: Map<string, HerancaResultado>): HerancaResultado {
  if (abertas.length === 0) {
    return {
      esforco: task.assimetria?.esforco ?? 0,
      custo: task.assimetria?.custo ?? 0,
      herdado: false,
      filhasAbertas: 0,
      filhasSemAtomos: 0,
    };
  }

  let esforco = 0;
  let custo = 0;
  let filhasSemAtomos = 0;
  for (const filha of abertas) {
    const efetivaFilha = memo.get(filha.id) ?? SEM_CONTRIBUICAO;
    esforco += efetivaFilha.esforco;
    custo += efetivaFilha.custo;
    if (efetivaFilha.esforco === 0 && efetivaFilha.custo === 0) filhasSemAtomos += 1;
  }

  if (esforco === 0 && custo === 0) {
    // Nenhuma filha aberta — nem a subárvore de nenhuma delas — declarou
    // átomo algum: "herdar" isso seria herdar um 0/0. Cai nos átomos
    // PRÓPRIOS da tarefa, com `herdado: false` e `filhasSemAtomos` = todas
    // as abertas (nenhuma contribuiu).
    return {
      esforco: task.assimetria?.esforco ?? 0,
      custo: task.assimetria?.custo ?? 0,
      herdado: false,
      filhasAbertas: abertas.length,
      filhasSemAtomos: abertas.length,
    };
  }

  return { esforco, custo, herdado: true, filhasAbertas: abertas.length, filhasSemAtomos };
}

/**
 * DFS pós-ordem ITERATIVO (pilha explícita, sem recursão de função — é a
 * correção do achado MÉDIO #4/estouro de pilha, rodada 2): resolve `raiz` e
 * toda a subárvore que ainda falta, escrevendo cada tarefa em `memo` uma
 * única vez. `emPilha` marca só os nós no caminho ATUAL da pilha (os
 * ancestrais de quem está sendo processado agora) — reencontrar um deles ao
 * descer é ciclo (A→B→A), e `calcularDoMemo` já trata "ainda não está em
 * `memo`" como contribuição zero, então nunca trava.
 */
function resolverSubarvore(
  raiz: Task,
  filhosMapa: Map<string, Task[]>,
  memo: Map<string, HerancaResultado>,
): void {
  if (memo.has(raiz.id)) return;

  const emPilha = new Set<string>();
  const pilha: Frame[] = [];

  function empilhar(t: Task): void {
    const filhos = filhosMapa.get(t.id) ?? [];
    const abertas = filhos.filter((f) => f.status !== "done");
    pilha.push({ task: t, abertas, indice: 0 });
    emPilha.add(t.id);
  }

  empilhar(raiz);

  while (pilha.length > 0) {
    const frame = pilha[pilha.length - 1];
    if (!frame) break; // defensivo — noUncheckedIndexedAccess; nunca deveria faltar aqui.

    if (frame.indice < frame.abertas.length) {
      const filha = frame.abertas[frame.indice];
      frame.indice += 1;
      if (!filha) continue;
      if (memo.has(filha.id)) continue; // já resolvida (reuso entre ramos/chamadas).
      if (emPilha.has(filha.id)) continue; // ciclo: é ancestral de quem já está na pilha.
      empilhar(filha);
      continue;
    }

    // Todas as filhas abertas já foram resolvidas (ou são ciclo, e portanto
    // nunca vão terminar antes — contam 0 via `calcularDoMemo`): calcula
    // este nó e desempilha.
    const resultado = calcularDoMemo(frame.task, frame.abertas, memo);
    memo.set(frame.task.id, resultado);
    emPilha.delete(frame.task.id);
    pilha.pop();
  }
}

/**
 * Herança efetiva de esforço/custo de UMA tarefa (P6). `tasks`: a lista que
 * contém a tarefa e (pelo menos) suas descendentes — o chamador avulso passa
 * a lista inteira do dia; `scoreAssimetriaLote` usa `herancaEmLote` (abaixo)
 * em vez desta função, para não refazer a descida por tarefa.
 */
export function herancaEfetiva(
  task: Task,
  tasks: readonly Task[],
  filhosMapa?: Map<string, Task[]>,
): HerancaResultado {
  const mapa = filhosMapa ?? filhosPorPai(tasks);
  const memo = new Map<string, HerancaResultado>();
  resolverSubarvore(task, mapa, memo);
  return memo.get(task.id) ?? SEM_CONTRIBUICAO; // sempre presente — defensivo.
}

/**
 * Herança efetiva de TODAS as tarefas em uma só passada (achado MÉDIO #4,
 * rodada 2 do crítico: `scoreAssimetriaLote` chamava `herancaEfetiva` por
 * tarefa, e cada chamada refazia a descida da árvore inteira a partir do
 * zero — numa cadeia de `parentId` funda (3000 nós em fila), isso é O(N²):
 * medido 1029 ms em N=3000.
 *
 * Aqui cada tarefa é resolvida (post-order, via memoização compartilhada)
 * EXATAMENTE uma vez, e uma mãe que aparece como filha de outra reusa o
 * resultado já calculado — O(N) no total.
 */
export function herancaEmLote(
  tasks: readonly Task[],
  filhosMapa?: Map<string, Task[]>,
): Map<string, HerancaResultado> {
  const mapa = filhosMapa ?? filhosPorPai(tasks);
  const memo = new Map<string, HerancaResultado>();
  for (const t of tasks) resolverSubarvore(t, mapa, memo);
  return memo;
}
