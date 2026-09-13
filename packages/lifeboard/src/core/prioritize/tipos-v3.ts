/**
 * OS-LIFEBOARD · v3 — contratos do caminho crítico e do score de assimetria.
 *
 * Este arquivo é o ponto de encontro entre duas peças construídas em paralelo:
 * `caminho-critico.ts` (P2) produz `ResultadoCPM`; `assimetria.ts` (P3) o
 * consome para calcular o átomo s1 (alavanca). Quem muda um contrato aqui muda
 * as duas peças. Fonte dos átomos: hub,
 * `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md` §3–§4.
 */

/** Janela de um nó no CPM, em dias contados a partir de hoje (0 = agora). */
export interface JanelaCPM {
  /** Early start / early finish — o mais cedo que pode começar/terminar. */
  es: number;
  ef: number;
  /** Late start / late finish — o mais tarde sem atrasar o goal. */
  ls: number;
  lf: number;
  /** lf − ef. Zero = está no caminho crítico. */
  folga: number;
  /** Duração usada. Quando a tarefa não tem `estimativaDias`, é o PLACEHOLDER. */
  duracao: number;
}

export interface ResultadoCPM {
  /** Goal usado. `null` = nenhum goal na lista → CPM sobre o DAG inteiro (caminho mais longo). */
  goalId: string | null;
  /** Ids com folga zero no caminho até o goal, goal incluído. */
  critico: ReadonlySet<string>;
  /** Janela de cada nó alcançado pelo cálculo. */
  janelas: ReadonlyMap<string, JanelaCPM>;
  /**
   * Ids sem `estimativaDias` que entraram no cálculo com o PLACEHOLDER — a
   * interface mostra "estimativa faltando" neles e o número do goal como provisório.
   */
  semDuracao: readonly string[];
  /** Duração total do caminho crítico, em dias. 0 quando não há goal alcançável. */
  duracaoTotal: number;
  /** Ids excluídos por ciclo (mesma detecção de `dag.ts`) — nunca derrubam o cálculo. */
  emCiclo: readonly string[];
}

/**
 * Regras do CPM (P2):
 * - Precedência = `predecessorIds` ∪ `successorIds` (lidos ao contrário) ∪
 *   `task_edges` com `tipo = "predecessor"`. As três fontes se somam.
 * - Tarefa `done` tem duração 0 (já aconteceu).
 * - Tarefa sem `estimativaDias` usa `DURACAO_PLACEHOLDER` e entra em `semDuracao`.
 * - Tarefa cuja `obsolescencia` de origem está `done` sai do grafo (virou desnecessária).
 * - Nunca lança: ciclo → `emCiclo`; goal ausente → `goalId: null` e caminho mais longo.
 */
export const DURACAO_PLACEHOLDER = 1;

/** O score de assimetria de UMA tarefa — os 5 átomos por extenso, mais o porquê. */
export interface ScoreAssimetria {
  /** A = (s1 × s2 × s3) / (e × c). 0 quando a tarefa ficou obsoleta. */
  valor: number;
  /** Alavanca: 3 no caminho crítico · 2 folga < 2 dias · 1 fora / sem CPM. Calculado. */
  s1: number;
  /** Opcionalidade 1–3. Declarado. */
  s2: number;
  /** Alcance: 1 (0 sucessores transitivos) · 2 (1–3) · 3 (4+). Calculado. */
  s3: number;
  /** Esforço p80 em faixas 1|2|3|5. Declarado. */
  e: number;
  /** Custo p80 em faixas 1|2|3|5, já com o desconto de sinergia aplicado. Declarado. */
  c: number;
  /** Uma frase em português explicando o número — vai para o cartão. */
  porque: string;
  /** `true` quando alguma aresta de obsolescência com origem `done` zerou o score. */
  obsoleta: boolean;
}

/**
 * Regras do score (P3):
 * - Sem `task.assimetria` declarado → devolve `null` (o cartão mostra "sem átomos declarados").
 * - Sinergia: cada aresta `sinergia` cujo destino é esta tarefa e cuja origem NÃO está
 *   `done` desconta `peso` do custo: `c = max(1, c × Π(1 − peso))`.
 * - Obsolescência: aresta `obsolescencia` cujo destino é esta tarefa e origem está `done`
 *   → `valor = 0`, `obsoleta = true`, porquê nomeia a origem.
 * - Nunca muda a ordem do HIERARQ em produção: é um número a mais no cartão.
 */
