/**
 * OS-LIFEBOARD · P6 — Store MUTÁVEL em memória para o modo fixture.
 *
 * `tasks.fixture.ts` (E4/E5) é read-only de propósito — o resto do app
 * (dashboard, grafo, linha do tempo) consome `FixtureTasksRepository` como um
 * fake estável e não pode ficar sujeito a mutação de outra tela. Este módulo é
 * a EXCEÇÃO, só para `/tarefa/[id]`: sem sessão de escrita real em modo
 * fixture (não há banco), as ações precisam de ALGUM lugar para gravar — aqui.
 *
 * Semente = cópia profunda de `FIXTURE_TASKS`/`FIXTURE_EDGES`/`FIXTURE_NOTES`
 * na primeira leitura; dali em diante vive só na memória do processo (perde
 * estado a cada redeploy/reinício — esperado para fixture).
 *
 * **Por que `globalThis` e não um `let` de módulo:** medido em smoke test com
 * Playwright contra o build real — uma Server Action grava (`ok: true`), mas
 * uma leitura logo depois (inclusive em aba nova, sem depender de
 * `router.refresh()`) não via a gravação. O bundler do Next separa o handler
 * de Server Action e a árvore de Server Components em chunks diferentes; um
 * módulo pequeno como este pode ser inlinado em CADA chunk em vez de
 * deduplicado num runtime comum — cada lado fica com sua PRÓPRIA cópia do `let`
 * de módulo, e a "mutação" só valia para a cópia de quem escreveu. `globalThis`
 * é o único ponto garantidamente único no processo Node, independente de queu
 * chunk webpack carregou o código — é o mesmo truque usado para não duplicar
 * client de banco em dev com Fast Refresh.
 *
 * Cada função devolve `{ ok: true, id? } | { erro: string }` — nunca lança —
 * mesmo contrato de `mutateLifeboard` (`@/lib/supabase/live-client`), para que
 * `src/app/tarefa/actions.ts` trate os dois modos de forma idêntica.
 */

import { AUTOR_MAXIMO, DURACAO_MINIMA_DIAS, TITULO_MAXIMO } from "@/core/prioritize/tipos-v3";
import {
  FIXTURE_EDGES,
  FIXTURE_NOTES,
  FIXTURE_TASKS,
} from "@/lib/repositories/tasks.fixture";
import { sourceIdFor } from "@/lib/repositories/sources.fixture";
import type {
  AssimetriaDeclarada,
  EdgeTipo,
  Task,
  TaskEdge,
  TaskNote,
  TaskStatus,
} from "@/types/canonical";

export type ResultadoMutacaoFixture = { ok: true; id?: string } | { erro: string };

interface EstadoFixture {
  tasks: Map<string, Task>;
  edges: Map<string, TaskEdge>;
  notes: Map<string, TaskNote>;
  contador: number;
}

function clonarTask(t: Task): Task {
  return {
    ...t,
    predecessorIds: [...t.predecessorIds],
    successorIds: [...t.successorIds],
    assimetria: t.assimetria ? { ...t.assimetria } : (t.assimetria ?? null),
  };
}

function estadoNovo(): EstadoFixture {
  return {
    tasks: new Map(FIXTURE_TASKS.map((t) => [t.id, clonarTask(t)] as const)),
    edges: new Map(FIXTURE_EDGES.map((e) => [e.id, { ...e }] as const)),
    notes: new Map(FIXTURE_NOTES.map((n) => [n.id, { ...n }] as const)),
    contador: 0,
  };
}

interface GlobalComStore {
  __lifeboardFixtureStore?: EstadoFixture;
}

/** Único ponto de acesso ao estado — sempre a mesma instância no processo. */
function loja(): EstadoFixture {
  const g = globalThis as unknown as GlobalComStore;
  if (!g.__lifeboardFixtureStore) {
    g.__lifeboardFixtureStore = estadoNovo();
  }
  return g.__lifeboardFixtureStore;
}

/**
 * Só para teste [achado BAIXO #9, crítico 13/09, rodada 2]: sobrescreve
 * `predecessorIds` de uma tarefa SEM espelhar `successorIds` do lado oposto.
 * `tasks.fixture-store.test.ts` tinha um teste que dizia provar a 3ª fonte
 * de precedência do anti-ciclo (`predecessorIds` lido ao contrário,
 * `arestaAddFixture`) mas não conseguia — no fixture semeado, toda relação
 * predecessor↔successor já vem espelhada nos dois lados, então a 1ª fonte
 * (`successorIds` direto) sempre bastava para achar o ciclo, mascarando se a
 * 3ª fonte de fato participava sozinha. Este helper isola a 3ª fonte: ajusta
 * só `predecessorIds`, deixando `successorIds` do outro lado como estava.
 */
export function definirPredecessorIdsFixture(taskId: string, predecessorIds: string[]): void {
  const estado = loja();
  const tarefa = estado.tasks.get(taskId);
  if (!tarefa) return;
  estado.tasks.set(taskId, { ...tarefa, predecessorIds });
}

/** Só para teste: devolve o store ao estado seed. */
export function resetarFixtureStore(): void {
  (globalThis as unknown as GlobalComStore).__lifeboardFixtureStore = estadoNovo();
}

export function listarTasksFixture(): Task[] {
  return [...loja().tasks.values()].map(clonarTask);
}

export function listarEdgesFixture(): TaskEdge[] {
  return [...loja().edges.values()].map((e) => ({ ...e }));
}

export function listarNotesFixture(): TaskNote[] {
  return [...loja().notes.values()]
    .map((n) => ({ ...n }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function novoId(prefixo: string): string {
  const estado = loja();
  estado.contador += 1;
  return `${prefixo}-fixture-${estado.contador}`;
}

export function notaAddFixture(
  taskId: string,
  texto: string,
  autor: string | null,
): ResultadoMutacaoFixture {
  const estado = loja();
  if (!estado.tasks.has(taskId)) return { erro: "Tarefa não encontrada." };
  const limpo = texto.trim();
  if (limpo.length === 0) return { erro: "O texto da nota não pode ficar vazio." };
  const autorLimpo = autor && autor.trim().length > 0 ? autor.trim() : null;
  // [ALTO #2, crítico 13/09, rodada 2] mesmo teto de `task_notes.autor`
  // (migration 0010) e de `notaAddAction` — o fixture não pode aceitar o que
  // o banco recusaria.
  if (autorLimpo !== null && autorLimpo.length > AUTOR_MAXIMO) {
    return { erro: `O nome do autor não pode passar de ${AUTOR_MAXIMO} caracteres.` };
  }
  const id = novoId("note");
  estado.notes.set(id, {
    id,
    taskId,
    texto: limpo,
    autor: autorLimpo,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, id };
}

export function notaDelFixture(id: string): ResultadoMutacaoFixture {
  const estado = loja();
  if (!estado.notes.has(id)) return { erro: "Nota não encontrada (ou não é sua)." };
  estado.notes.delete(id);
  return { ok: true };
}

export function subtarefaAddFixture(
  parentId: string,
  title: string,
  estimativaDias: number | null,
): ResultadoMutacaoFixture {
  const estado = loja();
  const mae = estado.tasks.get(parentId);
  if (!mae) return { erro: "A tarefa mãe não existe (ou não é sua)." };
  const limpo = title.trim();
  if (limpo.length === 0) return { erro: "O título da subtarefa não pode ficar vazio." };
  // [ALTO #2, crítico 13/09, rodada 2] mesmo teto de `tasks.title` (migration 0010).
  if (limpo.length > TITULO_MAXIMO) {
    return { erro: `O título não pode passar de ${TITULO_MAXIMO} caracteres.` };
  }
  // [BAIXO #10, rodada 2] mesma régua unificada de `estimativaValidaOuErro`
  // (actions.ts) — antes o fixture só exigia `> 0`, divergindo de `estimativa_set`.
  if (estimativaDias !== null && !(estimativaDias >= DURACAO_MINIMA_DIAS)) {
    const minimoFormatado = String(DURACAO_MINIMA_DIAS).replace(".", ",");
    return {
      erro: `A duração (estimativa em dias) precisa ser um número de pelo menos ${minimoFormatado} dia.`,
    };
  }
  const id = novoId("task");
  const agora = new Date().toISOString();
  estado.tasks.set(id, {
    id,
    projectId: mae.projectId,
    title: limpo,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: sourceIdFor("notes"),
    externalRef: `manual:${id}`,
    updatedAt: agora,
    estimativaDias,
    iniciadoEm: null,
    parentId,
    isGoal: false,
    assimetria: null,
  });
  return { ok: true, id };
}

export function parentSetFixture(taskId: string, parentId: string | null): ResultadoMutacaoFixture {
  const estado = loja();
  const tarefa = estado.tasks.get(taskId);
  if (!tarefa) return { erro: "A tarefa não existe (ou não é sua)." };
  if (parentId !== null) {
    if (!estado.tasks.has(parentId)) return { erro: "A tarefa mãe não existe (ou não é sua)." };
    if (parentId === taskId) {
      return { erro: "Uma tarefa não pode ser mãe de si mesma." };
    }
    // Anti-ciclo simples: sobe pelos pais de `parentId`; achar `taskId` é ciclo.
    let atual: string | null = parentId;
    const vistos = new Set<string>();
    while (atual !== null) {
      if (atual === taskId) {
        // [BAIXO #18, crítico 13/09] "mãe de si mesma" só cobre 1 nível — a
        // mesma frase da RPC (0008), que cobre A→B→A e cadeias mais longas.
        return { erro: "Isso criaria um ciclo de hierarquia: a tarefa viraria ancestral de si mesma." };
      }
      if (vistos.has(atual)) break;
      vistos.add(atual);
      atual = estado.tasks.get(atual)?.parentId ?? null;
    }
  }
  estado.tasks.set(taskId, { ...tarefa, parentId });
  return { ok: true };
}

export function goalSetFixture(taskId: string, isGoal: boolean): ResultadoMutacaoFixture {
  const estado = loja();
  const tarefa = estado.tasks.get(taskId);
  if (!tarefa) return { erro: "A tarefa não existe (ou não é sua)." };
  estado.tasks.set(taskId, { ...tarefa, isGoal });
  return { ok: true };
}

export function atomosSetFixture(
  taskId: string,
  assimetria: AssimetriaDeclarada | null,
): ResultadoMutacaoFixture {
  const estado = loja();
  const tarefa = estado.tasks.get(taskId);
  if (!tarefa) return { erro: "A tarefa não existe (ou não é sua)." };
  estado.tasks.set(taskId, { ...tarefa, assimetria });
  return { ok: true };
}

export function estimativaSetFixture(
  taskId: string,
  estimativaDias: number | null,
): ResultadoMutacaoFixture {
  const estado = loja();
  const tarefa = estado.tasks.get(taskId);
  if (!tarefa) return { erro: "A tarefa não existe (ou não é sua)." };
  // [BAIXO #10, rodada 2] mesma régua de `subtarefaAddFixture` — uma só lei.
  if (estimativaDias !== null && !(estimativaDias >= DURACAO_MINIMA_DIAS)) {
    const minimoFormatado = String(DURACAO_MINIMA_DIAS).replace(".", ",");
    return {
      erro: `A duração (estimativa em dias) precisa ser um número de pelo menos ${minimoFormatado} dia.`,
    };
  }
  estado.tasks.set(taskId, { ...tarefa, estimativaDias });
  return { ok: true };
}

export function statusSetFixture(taskId: string, status: TaskStatus): ResultadoMutacaoFixture {
  const estado = loja();
  const tarefa = estado.tasks.get(taskId);
  if (!tarefa) return { erro: "A tarefa não existe (ou não é sua)." };
  estado.tasks.set(taskId, { ...tarefa, status });
  return { ok: true };
}

export function arestaAddFixture(
  origem: string,
  destino: string,
  tipo: EdgeTipo,
  peso: number,
  nota: string | null,
): ResultadoMutacaoFixture {
  const estado = loja();
  if (!estado.tasks.has(origem)) return { erro: "A tarefa de origem não existe (ou não é sua)." };
  if (!estado.tasks.has(destino)) return { erro: "A tarefa de destino não existe (ou não é sua)." };
  if (origem === destino) return { erro: "origem e destino não podem ser a mesma tarefa." };
  const jaExiste = [...estado.edges.values()].some(
    (e) => e.origem === origem && e.destino === destino && e.tipo === tipo,
  );
  if (jaExiste) return { erro: "Já existe uma aresta desse tipo entre essas duas tarefas." };

  if (tipo === "predecessor") {
    // Alcançável a partir de `destino` andando pelas MESMAS 3 fontes de
    // precedência que o gatilho do banco lê (`lifeboard_check_edge_dag`,
    // migration 0004): task_edges tipo predecessor, `successorIds` direto e
    // `predecessorIds` LIDO AO CONTRÁRIO — achar `origem` significa que a
    // nova aresta origem→destino fecharia um ciclo.
    //
    // [ALTO/MÉDIO #13, crítico 13/09] a v1 só lia as duas primeiras fontes:
    // uma tarefa cujo predecessorIds já apontava de volta para o destino
    // fechava um ciclo que o banco recusa, mas o fixture aceitava — os dois
    // modos divergiam sobre o MESMO dado.
    const alcancaveis = new Set<string>();
    const fila: string[] = [destino];
    while (fila.length > 0) {
      const atual = fila.shift();
      if (atual === undefined || alcancaveis.has(atual)) continue;
      alcancaveis.add(atual);
      for (const e of estado.edges.values()) {
        if (e.tipo === "predecessor" && e.origem === atual) fila.push(e.destino);
      }
      for (const sucessor of estado.tasks.get(atual)?.successorIds ?? []) fila.push(sucessor);
      // predecessorIds lido ao contrário: se ALGUMA tarefa lista `atual` como
      // predecessor dela, `atual` precede essa tarefa (atual → essa tarefa).
      for (const t of estado.tasks.values()) {
        if (t.predecessorIds.includes(atual)) fila.push(t.id);
      }
    }
    if (alcancaveis.has(origem)) {
      return { erro: "Essa aresta criaria um ciclo de dependências (predecessor circular)." };
    }
  }

  const id = novoId("edge");
  estado.edges.set(id, {
    id,
    origem,
    destino,
    tipo,
    peso,
    nota,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, id };
}

export function arestaDelFixture(id: string): ResultadoMutacaoFixture {
  const estado = loja();
  if (!estado.edges.has(id)) return { erro: "Aresta não encontrada (ou não é sua)." };
  estado.edges.delete(id);
  return { ok: true };
}
