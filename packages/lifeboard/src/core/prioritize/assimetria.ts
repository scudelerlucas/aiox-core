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
 * P2 (`caminho-critico.ts`) é construída em paralelo e pode não existir ainda
 * nesta árvore — por isso esta peça NUNCA importa dela. Recebe o
 * `ResultadoCPM` já pronto como parâmetro (tipo vem só de `tipos-v3.ts`, que é
 * o contrato compartilhado, não a implementação).
 *
 * server-only: mesma camada O inalienável de hierarq.ts/dag.ts/today.ts
 * (kill-switch nº 3 do PRD) — defesa em profundidade contra import direto por
 * um Client Component.
 */

import type { ResultadoCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
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
function grafoSucessao(tasks: Task[], edges: TaskEdge[]): Map<string, Set<string>> {
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
 */
export function alcance(taskId: string, tasks: Task[], edges: TaskEdge[]): 1 | 2 | 3 {
  const adjacencia = grafoSucessao(tasks, edges);
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

/** Um número é um átomo declarado válido: finito e estritamente positivo. */
function ehPositivoFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
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
 * Score de assimetria de UMA tarefa (P3). `null` quando a tarefa não declarou
 * `assimetria` ou declarou algum átomo inválido — o cartão mostra "sem átomos
 * declarados" (decisão do consumidor da interface, não desta função).
 */
export function scoreAssimetria(
  task: Task,
  tasks: Task[],
  edges: TaskEdge[],
  cpm: ResultadoCPM,
): ScoreAssimetria | null {
  const declarado = task.assimetria;
  if (declarado === null || declarado === undefined) return null;
  if (
    !ehPositivoFinito(declarado.opcionalidade) ||
    !ehPositivoFinito(declarado.esforco) ||
    !ehPositivoFinito(declarado.custo)
  ) {
    return null;
  }

  const byId = new Map(tasks.map((t) => [t.id, t] as const));

  const s1 = alavanca(task.id, cpm);
  const s2 = declarado.opcionalidade;
  const s3 = alcance(task.id, tasks, edges);
  const e = declarado.esforco;

  // Sinergia: cada origem que AINDA vai acontecer (não 'done') barateia o
  // destino — o trabalho dela poupa parte do custo desta tarefa. Origem já
  // feita não desconta mais (o barateamento já aconteceu ou não veio).
  let produtoDescontos = 1;
  for (const edge of edges) {
    if (edge.tipo !== "sinergia" || edge.destino !== task.id) continue;
    const origem = byId.get(edge.origem);
    if (origem?.status === "done") continue;
    produtoDescontos *= 1 - edge.peso;
  }
  const c = arredonda2(Math.max(1, declarado.custo * produtoDescontos));

  // Obsolescência: a origem já feita torna esta tarefa desnecessária — zera
  // o valor em vez de só descontar (diferente de sinergia: aqui não sobra
  // nenhum motivo para fazer a tarefa).
  const edgeObsoleta = edges.find(
    (edge) => edge.tipo === "obsolescencia" && edge.destino === task.id,
  );
  const origemObsoleta = edgeObsoleta ? byId.get(edgeObsoleta.origem) : undefined;
  const obsoleta = origemObsoleta?.status === "done";

  if (obsoleta && origemObsoleta) {
    return {
      valor: 0,
      s1,
      s2,
      s3,
      e,
      c,
      porque: `desnecessária: ${origemObsoleta.title} já foi feita`,
      obsoleta: true,
    };
  }

  const valor = arredonda2((s1 * s2 * s3) / (e * c));
  return { valor, s1, s2, s3, e, c, porque: montaPorque(s1, s3, e, c), obsoleta: false };
}
