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
 * - Aresta cuja origem ou destino NÃO está na lista de tarefas é descartada em
 *   silêncio (mesma guarda de `dag.ts`: "ignora arestas para fora da lista").
 *   A RPC pode entregar ponta solta quando os filtros por dono divergem.
 * - Tarefa `done` continua no grafo (duração 0) e CONTA como sucessor transitivo
 *   no alcance (s3) — espelha o CPM, que também a mantém.
 */
export const DURACAO_PLACEHOLDER = 1;

/** Faixas p80 aceitas para esforço e custo declarados. */
export const FAIXAS_ESFORCO_CUSTO: ReadonlySet<number> = new Set([1, 2, 3, 5]);

/**
 * Domínio dos átomos declarados — a MESMA régua do CHECK `tasks_assimetria_dominio`
 * (migration 0005): opcionalidade 1..3; esforço e custo em {1, 2, 3, 5}. Fora
 * disso o objeto inteiro é inválido (o cartão mostra "sem átomos declarados").
 * Usada pelo normalizador da RPC e pelo score — nunca duplicar a régua.
 */
export function atomosDeclaradosValidos(
  raw: unknown,
): raw is { opcionalidade: number; esforco: number; custo: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const { opcionalidade, esforco, custo } = raw as Record<string, unknown>;
  const numero = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  return (
    numero(opcionalidade) && opcionalidade >= 1 && opcionalidade <= 3 &&
    numero(esforco) && FAIXAS_ESFORCO_CUSTO.has(esforco) &&
    numero(custo) && FAIXAS_ESFORCO_CUSTO.has(custo)
  );
}

/** `peso` de aresta válido para entrar numa conta: número finito em 0..1. */
export function pesoValido(peso: unknown): peso is number {
  return typeof peso === "number" && Number.isFinite(peso) && peso >= 0 && peso <= 1;
}

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
 * - Obsolescência: QUALQUER aresta `obsolescencia` cujo destino é esta tarefa e cuja
 *   origem está `done` → `valor = 0`, `obsoleta = true`, porquê nomeia essa origem
 *   (não só a primeira aresta encontrada).
 * - Aresta (sinergia ou obsolescência) cuja origem não existe na lista, ou cujo
 *   `peso` não é finito em 0..1, é ignorada — nunca desconta, nunca zera.
 * - Átomos declarados fora do domínio (`atomosDeclaradosValidos`) → `null`.
 * - `valor` e `c` saem arredondados a 2 casas decimais (regra do contrato, não da UI).
 * - Nunca muda a ordem do HIERARQ em produção: é um número a mais no cartão.
 * - Nunca muta `task`, `tasks`, `edges` nem `cpm` recebidos.
 */
