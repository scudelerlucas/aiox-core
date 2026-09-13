import "server-only";
/**
 * OS-LIFEBOARD · P2 — Caminho crítico (CPM) sobre o grafo de tarefas. PURA.
 *
 * Contrato: `src/core/prioritize/tipos-v3.ts` (`ResultadoCPM`, `JanelaCPM`,
 * `DURACAO_PLACEHOLDER`, "Regras do CPM (P2)"). Implementa exatamente aquilo.
 *
 * `import "server-only"` como TODA peça de `core/prioritize/**` (defesa em
 * profundidade, ver `server-only.ts`). O CPM roda no servidor (page/route) e o
 * `ResultadoCPM` desce ao grafo (Client Component) como dado serializado —
 * `critico` vira array, `janelas` vira objeto. Editar uma duração no client é
 * round-trip ao servidor, o que também é o único lugar que grava.
 *
 * ── Precedência (union de 3 fontes, dedupe) ──────────────────────────────────
 * Igual ao espírito de `dag.ts`, mas somando a terceira fonte que `dag.ts` não
 * conhece: `task_edges` com `tipo = "predecessor"`. As 3 fontes viram arestas
 * "origem → destino" guardadas em `Set`, o que já deduplica sozinho quando duas
 * fontes declaram a mesma aresta (ex.: array `successorIds` E uma edge
 * `predecessor` dizendo a mesma coisa) — critério do teste #7.
 *
 * ── Ciclo e obsolescência saem do grafo ANTES do cálculo ─────────────────────
 * Ciclo: reusa `detectCycleIds(tasks, edges)` (a mesma detecção de `dag.ts`,
 * que desde v3 também olha as `edges` de `tipo = "predecessor"`). O Kahn abaixo
 * mantém uma rede de segurança (nunca trava, nunca lança) por defesa.
 * Obsolescência: destino de uma aresta `obsolescencia` cuja origem já está
 * `done` sai do grafo (virou desnecessário) — não aparece em `janelas` nem em
 * `critico`.
 *
 * ── Goal e o subgrafo que conta ──────────────────────────────────────────────
 * Com goal, o CPM é calculado SÓ sobre os ANCESTRAIS do goal (quem tem caminho
 * de precedência até ele, goal incluído). O backward pass usa apenas sucessores
 * dentro desse subgrafo: LF(nó) = min das LS dos sucessores que levam ao goal;
 * LF(goal) = EF(goal). É a régua de Goldratt do doc de átomos §4 — "se este nó
 * ficasse pronto agora, a data do goal mexe?" — e o que a rodada 1 do crítico
 * exigiu: um ramo lateral pesado que NÃO leva ao goal não pode puxar um
 * ancestral compartilhado para dentro do caminho crítico (contraexemplo
 * A→M→G, A→N(5)→G, M→H(10): M tem folga 4 com ou sem H). Nós fora dos
 * ancestrais NÃO ganham janela — para eles "folga" relativa ao goal não
 * significa nada; o score os trata como "fora do CPM" (alavanca 1).
 * Sem goal, o goal é virtual (todo terminal): CPM clássico no grafo inteiro,
 * `duracaoTotal` = maior EF entre os terminais, e todo terminal compartilha
 * esse prazo.
 *
 * [DECISÃO] Vários `isGoal`: vence o de menor `id` (ordem estável, independe da
 * ordem em que o banco devolve as linhas). O app mostra um goal por vez.
 * [DECISÃO] `goalId` explícito mas que não existe no grafo (removido por ciclo/
 * obsolescência, ou id que nunca existiu) cai na MESMA cascata que "não
 * informado": tenta a primeira `isGoal`, senão `null`. O contrato não distingue
 * os dois casos e "nunca lança" pede uma saída definida também aqui.
 * [DECISÃO] `goalId: null` explícito é tratado igual a `undefined` (aciona a
 * busca por `isGoal`) — o contrato não descreve um modo "force sem goal"
 * diferente de "nenhum goal encontrado".
 */

import { detectCycleIds } from "@/core/prioritize/dag";
import {
  DURACAO_PLACEHOLDER,
  type JanelaCPM,
  type ResultadoCPM,
} from "@/core/prioritize/tipos-v3";
import type { Task, TaskEdge } from "@/types/canonical";

/** Kahn's algorithm sobre o grafo já podado (sem ciclo/obsolescência). */
function ordemTopologica(
  nodeIds: ReadonlySet<string>,
  adj: ReadonlyMap<string, ReadonlySet<string>>,
  radj: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const grauEntrada = new Map<string, number>();
  for (const id of nodeIds) grauEntrada.set(id, radj.get(id)?.size ?? 0);

  const fila: string[] = [...nodeIds].filter((id) => (grauEntrada.get(id) ?? 0) === 0);
  const ordem: string[] = [];
  while (fila.length > 0) {
    const id = fila.shift();
    if (id === undefined) break;
    ordem.push(id);
    for (const proximo of adj.get(id) ?? []) {
      const grau = (grauEntrada.get(proximo) ?? 0) - 1;
      grauEntrada.set(proximo, grau);
      if (grau === 0) fila.push(proximo);
    }
  }

  // Rede de segurança: não deveria ser alcançado (ciclos saem antes via
  // `detectCycleIds(tasks, edges)`). Anexa o resto em qualquer ordem — nunca
  // trava, nunca lança; o CPM sobre esses nós pode sair impreciso, mas termina.
  if (ordem.length < nodeIds.size) {
    const vistos = new Set(ordem);
    for (const id of nodeIds) if (!vistos.has(id)) ordem.push(id);
  }
  return ordem;
}

/** Ancestrais de `alvo` (inclusive): todo nó com caminho de precedência até ele. */
function ancestraisDe(
  alvo: string,
  radj: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  const vistos = new Set<string>([alvo]);
  const pilha = [alvo];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (atual === undefined) break;
    for (const predecessor of radj.get(atual) ?? []) {
      if (!vistos.has(predecessor)) {
        vistos.add(predecessor);
        pilha.push(predecessor);
      }
    }
  }
  return vistos;
}

export function caminhoCritico(
  tasks: Task[],
  edges: TaskEdge[],
  goalId?: string | null,
): ResultadoCPM {
  const porId = new Map(tasks.map((t) => [t.id, t] as const));

  // ── 1. Ciclo (reuso de dag.ts) e obsolescência saem do grafo ──────────────
  const idsEmCiclo = detectCycleIds(tasks, edges);
  const idsObsoletos = new Set<string>();
  for (const e of edges) {
    if (e.tipo !== "obsolescencia") continue;
    const origem = porId.get(e.origem);
    if (origem?.status === "done") idsObsoletos.add(e.destino);
  }
  const excluidos = new Set<string>([...idsEmCiclo, ...idsObsoletos]);

  const nodes = tasks.filter((t) => !excluidos.has(t.id));
  const nodeIds = new Set(nodes.map((t) => t.id));

  // ── 2. Precedência = predecessorIds ∪ successorIds (invertido) ∪ edges ────
  //      "predecessor" — as 3 fontes somam num Set (dedupe automático, teste #7).
  const adj = new Map<string, Set<string>>();
  const radj = new Map<string, Set<string>>();
  for (const id of nodeIds) {
    adj.set(id, new Set());
    radj.set(id, new Set());
  }
  const adicionaPrecedencia = (origem: string, destino: string): void => {
    // Órfão (fora da lista podada) = resolvido, mesma convenção de dag.ts: ignora.
    if (!nodeIds.has(origem) || !nodeIds.has(destino) || origem === destino) return;
    adj.get(origem)?.add(destino);
    radj.get(destino)?.add(origem);
  };
  for (const t of nodes) {
    for (const p of t.predecessorIds) adicionaPrecedencia(p, t.id);
    for (const s of t.successorIds) adicionaPrecedencia(t.id, s);
  }
  for (const e of edges) {
    if (e.tipo === "predecessor") adicionaPrecedencia(e.origem, e.destino);
  }

  // ── 3. Duração por nó ──────────────────────────────────────────────────────
  const duracao = new Map<string, number>();
  const semDuracao: string[] = [];
  for (const t of nodes) {
    if (t.status === "done") {
      duracao.set(t.id, 0); // já aconteceu
      continue;
    }
    if (typeof t.estimativaDias === "number" && t.estimativaDias > 0) {
      duracao.set(t.id, t.estimativaDias);
    } else {
      duracao.set(t.id, DURACAO_PLACEHOLDER);
      semDuracao.push(t.id);
    }
  }

  // ── 4. Forward pass (ES/EF) em ordem topológica ───────────────────────────
  const ordem = ordemTopologica(nodeIds, adj, radj);
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of ordem) {
    let esId = 0;
    for (const predecessor of radj.get(id) ?? []) {
      esId = Math.max(esId, ef.get(predecessor) ?? 0);
    }
    es.set(id, esId);
    ef.set(id, esId + (duracao.get(id) ?? DURACAO_PLACEHOLDER));
  }

  // ── 5. Resolve o goal (regra + as decisões documentadas acima) ────────────
  let goal: string | null = null;
  if (typeof goalId === "string" && nodeIds.has(goalId)) {
    goal = goalId;
  } else {
    const candidatos = nodes.filter((t) => t.isGoal === true).map((t) => t.id).sort();
    goal = candidatos[0] ?? null;
  }

  // ── 5b. Subgrafo que conta: ancestrais do goal (goal incluído); sem goal, tudo.
  const ancestrais: ReadonlySet<string> = goal !== null ? ancestraisDe(goal, radj) : nodeIds;

  // ── 6. Duração total (EF do goal real, ou o maior EF terminal do virtual) ──
  let duracaoTotal: number;
  if (goal !== null) {
    duracaoTotal = ef.get(goal) ?? 0;
  } else {
    const terminais = [...nodeIds].filter((id) => (adj.get(id)?.size ?? 0) === 0);
    duracaoTotal = terminais.reduce((max, id) => Math.max(max, ef.get(id) ?? 0), 0);
  }

  // ── 7. Backward pass (LS/LF) em ordem topológica reversa, SÓ no subgrafo ──
  //      dos ancestrais do goal (ver "Goal e o subgrafo que conta" no cabeçalho).
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of [...ordem].reverse()) {
    if (!ancestrais.has(id)) continue;
    const sucessores = [...(adj.get(id) ?? [])].filter((s) => ancestrais.has(s));
    let lfId: number;
    if (goal !== null && id === goal) {
      lfId = ef.get(goal) ?? 0; // LF do goal = EF do goal, por definição.
    } else if (sucessores.length === 0) {
      // Só acontece sem goal (todo ancestral do goal real tem sucessor no
      // subgrafo): terminal compartilha o prazo do DAG inteiro.
      lfId = duracaoTotal;
    } else {
      lfId = Math.min(...sucessores.map((s) => ls.get(s) ?? (ef.get(s) ?? 0)));
    }
    lf.set(id, lfId);
    ls.set(id, lfId - (duracao.get(id) ?? DURACAO_PLACEHOLDER));
  }

  // ── 8. Janelas + crítico — só para quem está no subgrafo do goal ──────────
  const janelas = new Map<string, JanelaCPM>();
  const critico = new Set<string>();
  for (const id of nodeIds) {
    if (!ancestrais.has(id)) continue;
    const janela: JanelaCPM = {
      es: es.get(id) ?? 0,
      ef: ef.get(id) ?? 0,
      ls: ls.get(id) ?? 0,
      lf: lf.get(id) ?? 0,
      folga: (lf.get(id) ?? 0) - (ef.get(id) ?? 0),
      duracao: duracao.get(id) ?? DURACAO_PLACEHOLDER,
    };
    janelas.set(id, janela);
    if (janela.folga === 0) critico.add(id);
  }

  return {
    goalId: goal,
    critico,
    janelas,
    semDuracao,
    duracaoTotal,
    emCiclo: [...idsEmCiclo],
  };
}
