import "server-only";
/**
 * OS-LIFEBOARD · P3 — Score de assimetria por tarefa (camada O). Função PURA.
 *
 * Contrato: `src/core/prioritize/tipos-v3.ts` (`ScoreAssimetria`, "Regras do
 * score (P3)"). Fonte dos átomos: hub,
 * `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md` §3–§4.
 *
 * O numerador REUSA a forma do HIERARQ (`hierarq.ts`: S = s1×s2×s3) — aqui
 * dividido pelo custo de fazer (esforço × custo), porque assimetria é
 * "quanto retorno por quanto sacrifício", não só prioridade. NUNCA altera o
 * HIERARQ nem a ordem de "hoje" (`today.ts`): é um número A MAIS no cartão.
 *
 * v2 (pós-reprovação do crítico, 13/09/2026): domínio dos átomos declarados e
 * validade de `peso` vêm SEMPRE de `atomosDeclaradosValidos`/`pesoValido`
 * (`tipos-v3.ts`) — nunca reimplementados aqui. Toda aresta `sinergia` ou
 * `obsolescencia` cuja origem não existe em `tasks`, ou cujo `peso` não é
 * finito em 0..1, é ignorada em silêncio. QUALQUER obsolescência com origem
 * `done` zera o score (não só a primeira aresta encontrada). `alcance` aceita
 * um grafo pré-construído (`grafoSucessao`, agora exportada) para uso em
 * lote via `scoreAssimetriaLote`, que soma tempo O(N) em vez de O(N²).
 *
 * P2 (`caminho-critico.ts`) é construída em paralelo e pode não existir ainda
 * nesta árvore — por isso esta peça NUNCA importa dela. Recebe o
 * `ResultadoCPM` já pronto como parâmetro (tipo vem só de `tipos-v3.ts`, que é
 * o contrato compartilhado, não a implementação).
 *
 * server-only: mesma camada O inalienável de hierarq.ts/dag.ts/today.ts
 * (kill-switch nº 3 do PRD) — defesa em profundidade contra import direto por
 * um Client Component.
 */

import {
  atomosDeclaradosValidos,
  pesoValido,
  type ResultadoCPM,
  type ScoreAssimetria,
} from "@/core/prioritize/tipos-v3";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * Alavanca (s1): o quanto a tarefa trava o resto do plano.
 * - 3: está no caminho crítico (folga zero até o goal).
 * - 2: tem janela no CPM mas com folga apertada (< 2 dias) — quase crítica.
 * - 1: fora da janela calculada (nunca entrou no CPM) OU folga ≥ 2 dias.
 *
 * [DECISÃO] "fora do CPM" inclui tanto tarefa ausente de `cpm.janelas` quanto
 * tarefa presente mas com folga confortável — as duas caem no mesmo "1", como
 * o contrato pede ("inclusive fora do CPM").
 */
export function alavanca(taskId: string, cpm: ResultadoCPM): 1 | 2 | 3 {
  if (cpm.critico.has(taskId)) return 3;
  const janela = cpm.janelas.get(taskId);
  if (janela && janela.folga < 2) return 2;
  return 1;
}

/**
 * Constrói o grafo de SUCESSÃO (x acontece antes de y ⇒ aresta x → y) pelas
 * MESMAS três fontes de precedência do CPM (`tipos-v3.ts` §"Regras do CPM"):
 * `successorIds` direto, `predecessorIds` lido ao contrário, e `TaskEdge` com
 * `tipo === "predecessor"`. Reusar exatamente essas três fontes é o que faz
 * `alcance` contar "quantas tarefas dependem desta" com o mesmo grafo que o
 * CPM enxerga — nunca um grafo paralelo que poderia divergir.
 */
export function grafoSucessao(tasks: Task[], edges: TaskEdge[]): Map<string, Set<string>> {
  const adjacencia = new Map<string, Set<string>>();
  const adiciona = (origem: string, destino: string): void => {
    const existentes = adjacencia.get(origem);
    if (existentes) existentes.add(destino);
    else adjacencia.set(origem, new Set([destino]));
  };

  for (const t of tasks) {
    for (const sucessor of t.successorIds) adiciona(t.id, sucessor);
    for (const predecessor of t.predecessorIds) adiciona(predecessor, t.id);
  }
  for (const e of edges) {
    if (e.tipo === "predecessor") adiciona(e.origem, e.destino);
  }

  return adjacencia;
}

/**
 * Alcance (s3): quantas tarefas TRANSITIVAMENTE dependem desta (sucessores
 * diretos + sucessores dos sucessores, …). BFS com `visited` — protege contra
 * ciclo (A→B→A nunca reentra num nó já visto, então sempre termina).
 * - 1: nenhum sucessor transitivo.
 * - 2: 1 a 3.
 * - 3: 4 ou mais.
 *
 * `grafo`: passe o grafo já construído (`grafoSucessao`) para poupar a
 * reconstrução O(N) a cada chamada — é o que `scoreAssimetriaLote` faz. Sem
 * ele, constrói na hora (uso avulso, mesmo comportamento de antes).
 */
export function alcance(
  taskId: string,
  tasks: Task[],
  edges: TaskEdge[],
  grafo?: Map<string, Set<string>>,
): 1 | 2 | 3 {
  const adjacencia = grafo ?? grafoSucessao(tasks, edges);
  const visitados = new Set<string>([taskId]);
  const fila: string[] = [taskId];

  while (fila.length > 0) {
    const atual = fila.shift();
    if (atual === undefined) break;
    for (const proximo of adjacencia.get(atual) ?? []) {
      if (visitados.has(proximo)) continue; // já visto → ciclo não reentra
      visitados.add(proximo);
      fila.push(proximo);
    }
  }

  const quantidadeSucessores = visitados.size - 1; // exclui a própria tarefa
  if (quantidadeSucessores === 0) return 1;
  if (quantidadeSucessores <= 3) return 2;
  return 3;
}

// ── Vocabulário do "porquê" — TABELA por faixa, não geração livre ───────────
// Uma frase fixa por faixa de cada átomo; a função só concatena. Isso é o que
// a spec pede com "Não é IA, é tabela": o texto é 100% previsível e testável.

const VOCAB_ALAVANCA: Record<1 | 2 | 3, string> = {
  3: "está no caminho crítico",
  2: "tem pouca folga de prazo",
  1: "não trava nada com urgência",
};

const VOCAB_ALCANCE: Record<1 | 2 | 3, string> = {
  3: "abre muitas tarefas depois dela",
  2: "abre algumas tarefas depois dela",
  1: "não abre nenhuma tarefa depois dela",
};

/** Esforço/custo são declarados em faixas 1|2|3|5 (p80) — vocabulário por faixa. */
const VOCAB_ESFORCO: Record<1 | 2 | 3 | 5, string> = {
  1: "é rápida de fazer",
  2: "toma um esforço pequeno",
  3: "toma um esforço considerável",
  5: "toma um esforço grande",
};

const VOCAB_CUSTO: Record<1 | 2 | 3 | 5, string> = {
  1: "custa pouco",
  2: "custa um valor moderado",
  3: "custa caro",
  5: "custa muito caro",
};

/**
 * O custo, depois do desconto de sinergia, pode virar qualquer número ≥ 1
 * (ex.: 1.5) — não bate mais exatamente numa das 4 faixas declaradas. Para o
 * texto, arredonda para a faixa mais próxima por cima (o mesmo raciocínio
 * "p80": nunca subestima o custo na frase).
 */
function faixaMaisProxima(valor: number): 1 | 2 | 3 | 5 {
  if (valor <= 1) return 1;
  if (valor <= 2) return 2;
  if (valor <= 3) return 3;
  return 5;
}

function montaPorque(s1: 1 | 2 | 3, s3: 1 | 2 | 3, esforco: number, custo: number): string {
  const faixaEsforco = faixaMaisProxima(esforco);
  const faixaCusto = faixaMaisProxima(custo);
  return `${VOCAB_ALAVANCA[s1]}, ${VOCAB_ALCANCE[s3]}; ${VOCAB_ESFORCO[faixaEsforco]} e ${VOCAB_CUSTO[faixaCusto]}.`;
}

function arredonda2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Núcleo do score — recebe `byId` e `grafo` já construídos (uma vez, por
 * quem chama) em vez de reconstruí-los. `scoreAssimetria` e
 * `scoreAssimetriaLote` são as duas cascas finas em cima disto: a primeira
 * constrói os dois para UMA tarefa (uso avulso); a segunda constrói uma vez
 * só e reusa para todas (uso em lote — o que elimina o O(N²) medido).
 */
function scoreAssimetriaNucleo(
  task: Task,
  edges: TaskEdge[],
  cpm: ResultadoCPM,
  byId: Map<string, Task>,
  grafo: Map<string, Set<string>>,
): ScoreAssimetria | null {
  const declarado = task.assimetria;
  if (declarado === null || declarado === undefined) return null;
  if (!atomosDeclaradosValidos(declarado)) return null;

  const s1 = alavanca(task.id, cpm);
  const s2 = declarado.opcionalidade;
  const s3 = alcance(task.id, [], [], grafo);
  const e = declarado.esforco;

  // Sinergia: cada origem que AINDA vai acontecer (não 'done') barateia o
  // destino — o trabalho dela poupa parte do custo desta tarefa. Origem já
  // feita não desconta mais (o barateamento já aconteceu ou não veio).
  //
  // Obsolescência: QUALQUER origem já `done` torna esta tarefa desnecessária
  // — zera o valor em vez de só descontar. Coletamos TODAS as ocorrências
  // (não só a primeira aresta encontrada) e citamos a primeira no "porquê".
  //
  // As duas regras compartilham a MESMA guarda: origem que não existe em
  // `tasks`, ou `peso` que não é finito em 0..1, é ignorada em silêncio —
  // nunca desconta, nunca zera (`tipos-v3.ts`, "Regras do score (P3)").
  let produtoDescontos = 1;
  const origensObsoletas: Task[] = [];
  for (const edge of edges) {
    if (edge.destino !== task.id) continue;
    if (edge.tipo !== "sinergia" && edge.tipo !== "obsolescencia") continue;
    const origem = byId.get(edge.origem);
    if (!origem) continue; // origem desconhecida — ignora
    if (!pesoValido(edge.peso)) continue; // peso inválido — ignora

    if (edge.tipo === "sinergia") {
      if (origem.status !== "done") produtoDescontos *= 1 - edge.peso;
    } else if (origem.status === "done") {
      origensObsoletas.push(origem);
    }
  }
  const c = arredonda2(Math.max(1, declarado.custo * produtoDescontos));

  if (origensObsoletas.length > 0) {
    const primeira = origensObsoletas[0];
    if (primeira) {
      return {
        valor: 0,
        s1,
        s2,
        s3,
        e,
        c,
        porque: `desnecessária: ${primeira.title} já foi feita`,
        obsoleta: true,
      };
    }
  }

  const valor = arredonda2((s1 * s2 * s3) / (e * c));
  return { valor, s1, s2, s3, e, c, porque: montaPorque(s1, s3, e, c), obsoleta: false };
}

/**
 * Score de assimetria de UMA tarefa (P3). `null` quando a tarefa não declarou
 * `assimetria` ou declarou algum átomo fora do domínio (`atomosDeclaradosValidos`)
 * — o cartão mostra "sem átomos declarados" (decisão do consumidor da
 * interface, não desta função). Nunca muta `task`, `tasks` ou `edges`.
 */
export function scoreAssimetria(
  task: Task,
  tasks: Task[],
  edges: TaskEdge[],
  cpm: ResultadoCPM,
): ScoreAssimetria | null {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const grafo = grafoSucessao(tasks, edges);
  return scoreAssimetriaNucleo(task, edges, cpm, byId, grafo);
}

/**
 * Score de assimetria de TODAS as tarefas em uma só passada — constrói
 * `byId` e o grafo de sucessão UMA vez (não por tarefa) e reusa nos dois
 * átomos calculados (s1 via `cpm`, s3 via BFS no grafo pronto). Medido em
 * 2,5s/N=3000 quando cada tarefa reconstruía o grafo sozinha (`alcance`
 * chamado direto); esta função é o caminho de lote que evita isso.
 */
export function scoreAssimetriaLote(
  tasks: Task[],
  edges: TaskEdge[],
  cpm: ResultadoCPM,
): Map<string, ScoreAssimetria | null> {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const grafo = grafoSucessao(tasks, edges);
  const resultado = new Map<string, ScoreAssimetria | null>();
  for (const task of tasks) {
    resultado.set(task.id, scoreAssimetriaNucleo(task, edges, cpm, byId, grafo));
  }
  return resultado;
}
