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
 * - Nó removido (ciclo ou obsolescência) deixa de ser predecessor de quem
 *   dependia dele: o dependente é tratado como livre (ES 0), a mesma convenção
 *   "órfão = resolvido" de `dag.ts`. É aviso na interface, nunca erro.
 * - Folga é comparada com `EPSILON_FOLGA`: |folga| abaixo dele vira 0 (crítico).
 *   Sem isso, 0.1 + 0.2 − 0.3 ≠ 0 e o nó some da linha vermelha.
 * - `iniciadoEm` está FORA do escopo do CPM: dia 0 é "agora", e uma tarefa já em
 *   andamento não recebe crédito pelo tempo decorrido. Calendário real é P5.
 */
export const DURACAO_PLACEHOLDER = 1;
/** Tolerância para "folga zero" em dias — bem abaixo de qualquer estimativa real. */
export const EPSILON_FOLGA = 1e-9;

/** Faixas p80 aceitas para esforço e custo declarados. */
export const FAIXAS_ESFORCO_CUSTO: ReadonlySet<number> = new Set([1, 2, 3, 5]);

/**
 * Domínio dos átomos declarados — a MESMA régua do CHECK `tasks_assimetria_dominio`
 * (migration 0008: `opcionalidade in (1,2,3)`, esforço e custo em {1, 2, 3, 5}). Fora
 * disso o objeto inteiro é inválido (o cartão mostra "sem átomos declarados").
 * Usada pelo normalizador da RPC e pelo score — nunca duplicar a régua.
 *
 * [ALTO/BAIXO #17, crítico 13/09] `opcionalidade` só aceita INTEIRO 1|2|3 —
 * `1.5` passava antes (`>= 1 && <= 3` aceita fração) e não corresponde a nada
 * no vocabulário do "porquê" nem no CHECK do banco (que agora usa `in (1,2,3)`,
 * não `between`). Esforço/custo já eram inteiros de fato porque `Set.has`
 * nunca bate com fração.
 */
export function atomosDeclaradosValidos(
  raw: unknown,
): raw is { opcionalidade: number; esforco: number; custo: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const { opcionalidade, esforco, custo } = raw as Record<string, unknown>;
  const numero = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  return (
    numero(opcionalidade) && Number.isInteger(opcionalidade) &&
    opcionalidade >= 1 && opcionalidade <= 3 &&
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
 * Herança de esforço/custo — resultado de `herancaEfetiva` (`heranca.ts`, P6).
 * Movida para cá (achado BAIXO #19, crítico 13/09): vivia em `heranca.ts`, que
 * é `server-only` — um Client Component (`atomos-form.tsx`) importava o TIPO
 * de lá; `import type` é apagado no build, mas o contrato pertence ao mesmo
 * lugar dos outros tipos compartilhados entre camada O e Client Components.
 *
 * v2 (achado ALTO #1, rodada 2 do crítico 13/09): existir filha(s) ABERTA(s)
 * não basta mais para `herdado: true` — só quando a soma delas é > 0. Uma
 * mãe com filha aberta mas SEM NENHUM átomo declarado em toda a subárvore
 * (nem nela, nem em netas) volta a usar os átomos DECLARADOS da própria
 * tarefa (`herdado: false`) em vez de "herdar" um 0/0 que o piso
 * `Math.max(1, ·)` do chamador inflava para 1/1 (ver `assimetria.ts`).
 */
export interface HerancaResultado {
  /** Esforço efetivo: soma RECURSIVA das filhas abertas (quando > 0), ou o átomo próprio. */
  esforco: number;
  /** Custo efetivo: mesma regra do esforço. */
  custo: number;
  /** `true` só quando a soma das filhas abertas é > 0 (herança de verdade, não 0/0). */
  herdado: boolean;
  /** Quantas filhas abertas (diretas) existem — 0 quando não há nenhuma. */
  filhasAbertas: number;
  /**
   * Quantas dessas filhas abertas (diretas) NÃO contribuíram nada (nem elas,
   * nem a subárvore delas, declararam átomo) — o que a interface mostra como
   * "N subtarefa(s) sem átomos" quando `herdado` é `false` mas `filhasAbertas
   * > 0`. Quando `herdado` é `true`, é a contagem informativa de quantas das
   * filhas somadas vieram vazias (as outras cobriram a soma).
   */
  filhasSemAtomos: number;
}

/**
 * Regras do score (P3):
 * - Sem `task.assimetria` declarado → devolve `null` (o cartão mostra "sem átomos declarados").
 * - Herança (P6, `heranca.ts`): `e` e `c` efetivos de uma tarefa com filha(s) ABERTA(s)
 *   (`status ≠ done`, `parentId === task.id`) são a SOMA RECURSIVA do `e`/`c` EFETIVO de
 *   cada filha aberta (uma filha sem átomos próprios, mas com filhas dela mesma, herda
 *   por sua vez; sem átomos e sem filhas, contribui 0) — com guarda de ciclo — **só
 *   quando essa soma é > 0**. Sem filha aberta nenhuma, OU com filha(s) aberta(s) mas
 *   soma zero (nenhuma delas, nem a subárvore delas, declarou átomo — achado ALTO #1,
 *   rodada 2), usa os átomos próprios declarados da tarefa (`declarado.esforco`/`.custo`)
 *   e marca `herdado: false` com `filhasSemAtomos` contando as filhas vazias — nunca
 *   herda um 0/0 disfarçado de herança. `opcionalidade` (s2) NUNCA herda — vem sempre do
 *   átomo próprio da tarefa. O desconto de sinergia se aplica sobre o `c` EFETIVO
 *   (pós-herança), não sobre o declarado. `porque` ganha o prefixo "herdado das
 *   subtarefas: " quando `herdado` é `true`.
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

/**
 * Duração mínima aceita para `estimativaDias`, em dias — ÚNICA régua para as
 * duas portas de entrada (`estimativa_set` E `subtarefa_add`, TS e RPC).
 *
 * [BAIXO #10, crítico 13/09, rodada 2] antes disto havia DUAS réguas: `estimativa_set`
 * exigia `>= 0.25`; `subtarefa_add` só exigia `> 0` (aceitava `0.1`) — o mesmo
 * campo, duas leis diferentes conforme a porta de entrada. Import único em
 * `src/app/tarefa/actions.ts` e mesmo valor hardcoded (com referência a este
 * arquivo em comentário) em `supabase/migrations/0010_lifeboard_v3_escrita_ajustes_2.sql`
 * (SQL não importa TS — o número é o contrato, não o módulo).
 */
export const DURACAO_MINIMA_DIAS = 0.25;

/**
 * Teto de caracteres de `tasks.title` — mesmo CHECK em
 * `supabase/migrations/0010_lifeboard_v3_escrita_ajustes_2.sql`
 * (`check (length(title) <= 500)`). [ALTO #2, crítico 13/09, rodada 2]: sem
 * teto, um título de 3 MB era aceito ponta a ponta (TS e banco).
 */
export const TITULO_MAXIMO = 500;

/**
 * Teto de caracteres de `task_notes.autor` — mesmo CHECK na migration 0010
 * (`check (autor is null or length(autor) <= 120)`). [ALTO #2, crítico 13/09,
 * rodada 2]: sem teto, um `autor` de 1 MB era aceito.
 */
export const AUTOR_MAXIMO = 120;
