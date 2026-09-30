import "server-only";
/**
 * OS-LIFEBOARD · P5 — Linha do tempo (Gantt). PURA — sem rede, sem `Date.now()`
 * escondido (`hoje` entra por parâmetro), nunca lança.
 *
 * Contrato: `@/types/linha-do-tempo` (`LinhaDoTempoProps`). Duas fontes de dado,
 * dois grupos:
 *   • "Assuntos" — `Pr[]` de `painel_frentes_prs` (`criado_em → mergeado_em`,
 *     ou hoje se ainda aberto). Fonte dos dados: `docs/ops/LIFEBOARD-V3-4z-…md` §7.
 *   • "Tarefas" — `Task[]`, com a janela do CPM (`ResultadoCPM`, `core/prioritize/
 *     caminho-critico.ts`) quando a tarefa é ancestral do goal; fora dele, a barra
 *     nasce de `iniciadoEm` (ou hoje) + `estimativaDias` (ou o placeholder),
 *     marcada `semDuracao`/`foraDoCpm`.
 *
 * Precedência de uma tarefa (predecessores/sucessores mostrados na tela) é a
 * MESMA união de 3 fontes do CPM (`predecessorIds` ∪ `successorIds` invertido ∪
 * `task_edges` tipo=predecessor) — nunca uma segunda definição de "o que precede
 * o quê" divergindo da que desenha o caminho crítico.
 *
 * Nunca lança: tasks/edges/prs vazios → grupos vazios; predecessor que aponta
 * para um id fora de `tasks` é ignorado (mesma convenção de `caminho-critico.ts`
 * — "órfão = resolvido"); goal ausente no CPM → todo mundo fica `foraDoCpm`.
 */

import type { ResultadoCPM } from "@/core/prioritize/tipos-v3";
import type { Pr } from "@/lib/frentes/types";
import { limparTitulo } from "@/lib/frentes/compose";
import { diaNoFusoDoOperador } from "@/lib/fuso";
import type { Task, TaskEdge } from "@/types/canonical";
import type {
  LinhaDoTempoAssuntoRow,
  LinhaDoTempoGrupo,
  LinhaDoTempoProps,
  LinhaDoTempoRow,
  LinhaDoTempoTarefaRow,
} from "@/types/linha-do-tempo";

const MS_POR_DIA = 86_400_000;
/** Mesma régua de `DURACAO_PLACEHOLDER` (tipos-v3), para a tarefa FORA do CPM
 * que também não tem `estimativaDias` — nunca uma barra de comprimento zero. */
const DURACAO_PLACEHOLDER_FORA_CPM = 1;

/** `Date.parse` de uma ISO qualquer; `NaN` (data podre) cai no fallback do chamador. */
function paraEpoch(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * [ALTO 2, rodada 13] O DIA DE CALENDÁRIO de um instante, NO FUSO DO OPERADOR.
 *
 * Era `iso.slice(0, 10)`: o dia em UTC. O `hoje` desta mesma função vem de
 * `hojeNoFusoDoOperador` (America/São Paulo) — então a faixa dourada, a origem
 * da régua e a comparação de atraso falavam um calendário enquanto as datas
 * dos itens falavam outro. Um PR criado às 23h de 21/09 em São Paulo nascia
 * desenhado em 22/09, à DIREITA do "Hoje", e o `title`, o `aria-label` e a
 * gaveta imprimiam 22/09/2026. Não era divergência de texto contra pixel (por
 * isso nenhum portão via): os dois saíam do mesmo valor errado.
 *
 * Delega à conversão única (`@/lib/fuso`), que devolve `AAAA-MM-DD` sem hora
 * INTACTO (não há instante para converter) e `null` para ISO ilegível — aqui
 * o `null` devolve a string como veio, porque esta função nunca lança e o
 * chamador já marcou `dataInvalida` antes de chegar neste ponto.
 */
function diaNoCalendarioDoOperador(iso: string): string {
  return diaNoFusoDoOperador(iso) ?? iso;
}

/** `iso` + `dias` dias corridos, devolvido como `AAAA-MM-DD`. */
function somaDias(iso: string, dias: number): string {
  const base = paraEpoch(iso) ?? Date.now();
  const dataFinal = new Date(base + dias * MS_POR_DIA);
  return dataFinal.toISOString().slice(0, 10);
}

/**
 * Precedência = `predecessorIds` ∪ `successorIds` (invertido) ∪ `task_edges`
 * tipo=predecessor — EXATAMENTE a mesma união que `caminhoCritico` usa para
 * montar o grafo (`tipos-v3.ts`, "Regras do CPM"). Órfão (aponta para fora de
 * `tasks`) é descartado em silêncio, nunca lança.
 */
function precedenciaDeclarada(
  tasks: readonly Task[],
  edges: readonly TaskEdge[],
): { predecessores: Map<string, Set<string>>; sucessores: Map<string, Set<string>> } {
  const idsValidos = new Set(tasks.map((t) => t.id));
  const predecessores = new Map<string, Set<string>>();
  const sucessores = new Map<string, Set<string>>();
  for (const id of idsValidos) {
    predecessores.set(id, new Set());
    sucessores.set(id, new Set());
  }
  const liga = (origem: string, destino: string): void => {
    if (!idsValidos.has(origem) || !idsValidos.has(destino) || origem === destino) return;
    sucessores.get(origem)?.add(destino);
    predecessores.get(destino)?.add(origem);
  };
  for (const t of tasks) {
    for (const p of t.predecessorIds) liga(p, t.id);
    for (const s of t.successorIds) liga(t.id, s);
  }
  for (const e of edges) {
    if (e.tipo === "predecessor") liga(e.origem, e.destino);
  }
  return { predecessores, sucessores };
}

/** Título de assunto: reusa `limparTitulo` (mesmo tratamento da tela `/frentes`); nunca vazio. */
function tituloDoAssunto(pr: Pr): string {
  const limpo = limparTitulo(pr.titulo);
  return limpo.length > 0 ? limpo : pr.titulo || `${pr.repo}#${pr.numero}`;
}

/**
 * P5b (achados MÉDIO #13 + ALTO #8): valida `inicio`/`fim` do assunto ANTES
 * de virar string curta — nunca deixa `Date.parse` de uma string podre
 * ("abc") virar silenciosamente "hoje" na tela, e nunca deixa um intervalo
 * negativo (`mergeado_em < criado_em`) virar uma barra de 4px fingindo
 * duração positiva. `aberto` sempre fecha em `hoje` (época válida por
 * construção — nunca cai no ramo de data inválida).
 */
function montaAssunto(pr: Pr, hoje: string): LinhaDoTempoAssuntoRow {
  const inicioIsoBruto = pr.criado_em ?? pr.atualizado_em;
  const aberto = pr.estado === "aberto";
  const fimIsoBruto = pr.mergeado_em ?? (aberto ? hoje : pr.fechado_em ?? pr.atualizado_em);

  const inicioEpoch = paraEpoch(inicioIsoBruto);
  const fimEpoch = paraEpoch(fimIsoBruto);
  const dataInvalida = inicioEpoch === null || fimEpoch === null;

  const inicio = dataInvalida ? hoje : diaNoCalendarioDoOperador(inicioIsoBruto);
  const fim = dataInvalida ? hoje : diaNoCalendarioDoOperador(fimIsoBruto);
  // Comparação por DIA de calendário (`inicio`/`fim` já truncados), não pelo
  // instante exato — um PR criado 08h e mergeado 18h do MESMO dia é "marco"
  // (mesmo dia), não duas datas diferentes por causa da hora.
  const inicioDiaEpoch = paraEpoch(inicio);
  const fimDiaEpoch = paraEpoch(fim);
  const datasInconsistentes =
    !dataInvalida && inicioDiaEpoch !== null && fimDiaEpoch !== null && fimDiaEpoch < inicioDiaEpoch;
  const marco =
    !dataInvalida && !datasInconsistentes && fimDiaEpoch !== null && fimDiaEpoch === inicioDiaEpoch;

  return {
    kind: "assunto",
    id: `${pr.repo}#${pr.numero}`,
    titulo: tituloDoAssunto(pr),
    repo: pr.repo,
    inicio,
    fim,
    aberto,
    estado: pr.estado,
    url: pr.url,
    dataInvalida,
    datasInconsistentes,
    marco,
  };
}

function estimativaValida(t: Task): number | null {
  return typeof t.estimativaDias === "number" && Number.isFinite(t.estimativaDias) && t.estimativaDias > 0
    ? t.estimativaDias
    : null;
}

/** Chave de ordenação interna: `es` do CPM (ou `+Infinity` fora dele). */
interface TarefaOrdenavel {
  row: LinhaDoTempoTarefaRow;
  es: number;
}

/**
 * P5c (achado ALTO #10 do crítico hostil, rodada 2): "rank" topológico —
 * distância (em arestas) até a raiz mais funda de predecessores — usado como
 * DESEMPATE entre `es` e `critico` na ordenação. Sem isto, duas tarefas com o
 * MESMO `es` (o caso comum de tudo `foraDoCpm`, onde `es = +Infinity` para
 * todo mundo) caem só no desempate `critico`/id, e uma predecessora podia
 * desenhar ABAIXO da sua sucessora na tela (setup → build → deploy fora de
 * ordem). `rank(t) = 0` sem predecessor; senão `1 + max(rank(pred))`. Ciclo
 * (predecessor que está no próprio caminho de cálculo) trata como "resolvido"
 * — mesma convenção de `dag.ts`/`caminho-critico.ts` para não travar nem lançar.
 */
function calcularRanks(predecessores: ReadonlyMap<string, Set<string>>): Map<string, number> {
  const memo = new Map<string, number>();
  const emProgresso = new Set<string>();
  function rankDe(id: string): number {
    const guardado = memo.get(id);
    if (guardado !== undefined) return guardado;
    if (emProgresso.has(id)) return 0; // ciclo — nunca lança, nunca trava
    emProgresso.add(id);
    const preds = predecessores.get(id);
    let rank = 0;
    if (preds) {
      for (const p of preds) rank = Math.max(rank, rankDe(p) + 1);
    }
    emProgresso.delete(id);
    memo.set(id, rank);
    return rank;
  }
  for (const id of predecessores.keys()) rankDe(id);
  return memo;
}

/** ISO curto de `t.dueDate`, só quando parseia; `null` senão (nunca lança). */
function dueDateValida(t: Task): string | null {
  return t.dueDate && paraEpoch(t.dueDate) !== null ? diaNoCalendarioDoOperador(t.dueDate) : null;
}

/**
 * P5b (achado ALTO #4): `dueDate` no passado e a tarefa não está `done` — a
 * mesma régua vale dentro OU fora do CPM (o CPM não sabe de `dueDate`, só de
 * `es/ef` a partir de "hoje"; atraso é um fato do calendário, independente).
 */
function estaAtrasada(t: Task, dueDateCurta: string | null, hoje: string): boolean {
  if (t.status === "done" || dueDateCurta === null) return false;
  const dueEpoch = paraEpoch(dueDateCurta);
  const hojeEpoch = paraEpoch(hoje);
  if (dueEpoch === null || hojeEpoch === null) return false;
  return dueEpoch < hojeEpoch;
}

/** ISO curto de `t.updatedAt`, quando parseia — o "ponto de conclusão" de uma `done` fora do CPM. */
function pontoDeConclusao(t: Task): string | null {
  return paraEpoch(t.updatedAt) !== null ? diaNoCalendarioDoOperador(t.updatedAt) : null;
}

function montaTarefa(
  t: Task,
  cpm: ResultadoCPM,
  predecessores: ReadonlyMap<string, Set<string>>,
  sucessores: ReadonlyMap<string, Set<string>>,
  scores: ReadonlyMap<string, number | null | undefined> | undefined,
  hoje: string,
): TarefaOrdenavel {
  const preds = [...(predecessores.get(t.id) ?? [])].sort();
  const sucs = [...(sucessores.get(t.id) ?? [])].sort();
  const scoreValor = scores?.get(t.id);
  const janela = cpm.janelas.get(t.id);
  const dueDate = dueDateValida(t);
  /**
   * P5h (achado ALTO 3, rodada 10): a estimativa DIGITADA viaja até a tela,
   * em vez de ser reinventada lá por `diffDias(inicio, fim)` (que devolvia 1
   * para `0,5` e 1 para "nenhuma"). `null` é "ninguém digitou" — e a tela
   * tem de dizer isso, nunca escolher um número no lugar de quem não digitou.
   */
  const estimativaDigitada = estimativaValida(t);

  const base = {
    kind: "tarefa" as const,
    id: t.id,
    titulo: t.title,
    predecessores: preds,
    sucessores: sucs,
    ...(typeof scoreValor === "number" ? { score: scoreValor } : {}),
    status: t.status,
    dueDate,
  };

  // P5d (achado ALTO #3 do crítico hostil, rodada 3): `done` é checado ANTES
  // da janela do CPM, não depois — o bug era exatamente a ordem inversa: uma
  // tarefa concluída que É ancestral do goal tem `es === ef` (duração zero
  // por CONSTRUÇÃO do CPM, que conta a partir de "hoje"), e isso virava um
  // losango desenhado EM CIMA DE HOJE — uma tarefa já feita não é um evento
  // de hoje, é um evento do passado (`updatedAt`). `done` SEMPRE usa o ponto
  // real de conclusão, dentro OU fora do CPM; só o que muda é `critico`/
  // `folga` (refletem o CPM de verdade quando a tarefa é ancestral do goal —
  // "crítica ou não", o conector que nasce desse ponto precisa saber) e
  // `foraDoCpm` (espelha se havia janela). Nunca fabrica uma barra a partir
  // de "hoje" quando nem `updatedAt` é uma data válida.
  if (t.status === "done") {
    const ponto = pontoDeConclusao(t);
    const ancora = ponto ?? hoje;
    const row: LinhaDoTempoTarefaRow = {
      ...base,
      inicio: ancora,
      fim: ancora,
      fimComFolga: ancora,
      critico: janela ? cpm.critico.has(t.id) : false,
      folga: janela ? janela.folga : null,
      semDuracao: false,
      estimativaDias: estimativaDigitada,
      foraDoCpm: !janela,
      marco: false,
      datasInconsistentes: false,
      semBarra: true,
      pontoConcluidoEm: ponto,
      inicioEstimado: false,
      atrasada: false,
    };
    return { row, es: janela ? janela.es : Number.POSITIVE_INFINITY };
  }

  if (janela) {
    const inicio = somaDias(hoje, janela.es);
    const fim = somaDias(hoje, janela.ef);
    const row: LinhaDoTempoTarefaRow = {
      ...base,
      inicio,
      fim,
      fimComFolga: somaDias(hoje, janela.lf),
      critico: cpm.critico.has(t.id),
      folga: janela.folga,
      semDuracao: cpm.semDuracao.includes(t.id),
      estimativaDias: estimativaDigitada,
      foraDoCpm: false,
      // P5c (achado BAIXO #11 do crítico hostil, rodada 2): duração zero de
      // VERDADE (`es === ef`, `done` no CPM tem duração 0 por construção) →
      // losango. Comparar as datas TRUNCADAS (`inicio === fim`) confundia isto
      // com qualquer duração sub-diária (0,5 dia também trunca pro mesmo dia de
      // calendário) — essa comparação foi para `es`/`ef` NUMÉRICOS, antes do
      // truncamento, que é o único jeito de distinguir "zero" de "menos de 1 dia".
      // `status === "done"` já saiu pelo ramo acima — este `marco` nunca mais
      // é um `done` disfarçado de losango em cima de hoje.
      marco: janela.es === janela.ef,
      datasInconsistentes: false,
      semBarra: false,
      pontoConcluidoEm: null,
      inicioEstimado: false,
      atrasada: estaAtrasada(t, dueDate, hoje),
    };
    return { row, es: janela.es };
  }

  // ── Fora do CPM (nunca `done` — esse ramo já saiu acima) ────────────────
  // P5d (achado MÉDIO #6, rodada 3): `folga: null` — 0 aqui lia-se como
  // "sem folga" (== tão urgente quanto o caminho crítico), quando o CPM
  // simplesmente não calculou folga nenhuma para quem está fora do subgrafo
  // do goal. `null` é "não calculada", nunca "zero".
  const estimativa = estimativaDigitada;
  const duracao = estimativa ?? DURACAO_PLACEHOLDER_FORA_CPM;
  // P5f (achado BAIXO A9, rodada 5): sem `iniciadoEm` válido, o início é
  // FABRICADO ("hoje") só para a barra ter onde nascer — a tela precisa saber
  // disso para não desenhar uma barra sólida afirmando uma data que ninguém
  // informou (o conector já dizia "indefinido"; a barra dizia o contrário).
  const temInicioReal = Boolean(t.iniciadoEm && paraEpoch(t.iniciadoEm) !== null);
  const inicio = temInicioReal ? diaNoCalendarioDoOperador(t.iniciadoEm as string) : hoje;
  const fim = somaDias(inicio, duracao);
  const row: LinhaDoTempoTarefaRow = {
    ...base,
    inicio,
    fim,
    fimComFolga: fim,
    critico: false,
    folga: null,
    semDuracao: estimativa === null,
    estimativaDias: estimativa,
    foraDoCpm: true,
    // P5c (achado BAIXO #11, rodada 2): FORA do CPM a duração nunca é zero de
    // verdade (`estimativaValida` exige > 0; zero de verdade é `done`, que sai
    // pelo ramo `semBarra` acima, antes de chegar aqui) — então isto NUNCA é
    // um marco. `estimativaDias` < 1 dia (ex.: 0,5) soma menos de 24h e
    // `somaDias` trunca pro MESMO dia de calendário (`inicio === fim` como
    // STRING), mas a duração real é positiva: antes isso virava diamante
    // (escondendo que a tarefa TEM duração); agora a VIEW desenha uma barra
    // curta com piso de 12px (`LARGURA_MINIMA_BARRA`) — nunca diamante, nunca
    // os 4px ilegíveis de antes.
    marco: false,
    datasInconsistentes: false,
    semBarra: false,
    pontoConcluidoEm: null,
    inicioEstimado: !temInicioReal,
    atrasada: estaAtrasada(t, dueDate, hoje),
  };
  // Fora do CPM ordena depois de tudo que tem ES real — nunca finge um ES.
  return { row, es: Number.POSITIVE_INFINITY };
}

export function montarLinhaDoTempo(
  tasks: readonly Task[],
  edges: readonly TaskEdge[],
  prs: readonly Pr[],
  cpm: ResultadoCPM,
  hoje: string,
  scores?: ReadonlyMap<string, number | null | undefined>,
): LinhaDoTempoProps {
  /**
   * P5h (achado MÉDIO 5, rodada 10): os ASSUNTOS não tinham ordem nenhuma —
   * saíam na ordem em que o repositório de frentes os devolveu. Medido na
   * tela, o `left` das 14 barras descia e subia cinco vezes
   * (377,85 · 377,85 · 299,38 · 256,61 · 342,14 · 171,06 · 0 · 42,77 · 0 · 0 ·
   * 0 · 128,30 · 213,84 · 299,38): um Gantt sem eixo vertical. As TAREFAS já
   * ordenavam (`es` → `rank` → `critico` → id); o grupo de cima é que não.
   *
   * A ordem escolhida é a única defensável sem inventar produto: **a data de
   * início da barra**, a mesma grandeza que o olho segue da esquerda para a
   * direita (é o default do Asana e do MS Project, e a P5 declara perseguir o
   * primeiro). Desempates, nesta ordem: fim mais cedo primeiro (barra mais
   * curta em cima quando dois assuntos começam no mesmo dia) e depois o id
   * (`repo#numero`), estável e único — a ordem nunca muda entre duas leituras
   * do mesmo quadro.
   *
   * Linha sem barra desenhável (`dataInvalida`) vai para o FIM: ela não tem
   * posição no eixo, e enfiá-la no meio pela data fabricada de "hoje"
   * misturaria "não sei quando" com "começa hoje". `datasInconsistentes` TEM
   * início real (o podre é o fim) e ordena por ele, como qualquer outra.
   *
   * O que NÃO entra aqui: um controle de ordenação para o operador (ordenar
   * por fim, por repositório, por estado). Isso é decisão de produto e está
   * PROPOSTO, não implementado — a régua desta rodada é "o Gantt tem UMA
   * ordem", não "o Gantt tem um seletor".
   */
  const linhasAssuntos: LinhaDoTempoRow[] = prs
    .map((pr) => montaAssunto(pr, hoje))
    .sort((a, b) => {
      if (a.dataInvalida !== b.dataInvalida) return a.dataInvalida ? 1 : -1;
      if (a.inicio !== b.inicio) return a.inicio < b.inicio ? -1 : 1;
      if (a.fim !== b.fim) return a.fim < b.fim ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

  const { predecessores, sucessores } = precedenciaDeclarada(tasks, edges);
  const ranks = calcularRanks(predecessores);

  const tarefasOrdenaveis = tasks.map((t) =>
    montaTarefa(t, cpm, predecessores, sucessores, scores, hoje),
  );
  tarefasOrdenaveis.sort((a, b) => {
    if (a.es !== b.es) return a.es - b.es;
    const rankA = ranks.get(a.row.id) ?? 0;
    const rankB = ranks.get(b.row.id) ?? 0;
    if (rankA !== rankB) return rankA - rankB;
    if (a.row.critico !== b.row.critico) return a.row.critico ? -1 : 1;
    return a.row.id.localeCompare(b.row.id);
  });

  const grupos: LinhaDoTempoGrupo[] = [
    { titulo: "Assuntos", linhas: linhasAssuntos },
    { titulo: "Tarefas", linhas: tarefasOrdenaveis.map((t) => t.row) },
  ];

  return {
    hoje: diaNoCalendarioDoOperador(hoje),
    grupos,
    goalId: cpm.goalId,
  };
}
