/**
 * OS-LIFEBOARD · P5 — rodada 10. O QUE A TELA PODE DIZER SOBRE O PERÍODO DE
 * UMA TAREFA — e o que ela NÃO pode.
 *
 * ## O defeito que este módulo fecha (CRÍTICO 1 + ALTO 3 da rodada 10)
 *
 * A gaveta imprimia, para "Revisar PR do time" (uma tarefa sem `iniciadoEm` e
 * sem `estimativaDias`):
 *
 *     Período: 21/09/2026 → 22/09/2026 | Folga: 2 d | ... | sem estimativa
 *
 * Os dois dias eram `hoje + DURACAO_PLACEHOLDER`. O sistema SABIA que não
 * havia duração (a tarefa está em `ResultadoCPM.semDuracao`, e a própria
 * gaveta escrevia "sem estimativa" três linhas abaixo, em cinza) — e mesmo
 * assim estampava duas datas concretas no campo que o operador lê como fato.
 *
 * E onde havia estimativa de verdade, a tela reinventava o número: o texto
 * chamava de "estimativa" o resultado de `Math.max(1, diffDias(inicio, fim))`
 * — as DATAS TRUNCADAS da barra, não o que alguém digitou. Uma tarefa de
 * `estimativaDias: 0,5` virava "estimativa de 1 dia" ao lado de uma barra de
 * 12px onde um dia real mede 42,77px: o texto e o desenho se contradiziam na
 * mesma tela.
 *
 * ## A lei
 *
 * **Nenhum número sai daqui que não tenha sido digitado por alguém ou
 * calculado por um motor que declara o que calculou.** Em concreto:
 *
 * | o que o dado é | o que a tela diz |
 * |---|---|
 * | duração ausente (`semDuracao`) | "duração não estimada" — NUNCA uma data de fim |
 * | início ausente (`inicioEstimado`) | "início não registrado" — NUNCA uma data de início |
 * | início vindo do CPM (`foraDoCpm: false`) | "início previsto" — é projeção do motor, não um fato do cadastro |
 * | duração presente | o número de `estimativaDias`, como foi digitado (0,5 é "0,5 dia") |
 *
 * PURO: sem DOM, sem `Date.now()`, nunca lança. A formatação de data entra
 * por parâmetro (a tela usa `dd/MM/aaaa`; um teste pode usar a ISO crua).
 */

/** O que este módulo precisa saber de uma linha de tarefa — nada além disto. */
export interface PeriodoDeTarefa {
  inicio: string;
  fim: string;
  /** `true` = ninguém estimou a duração; o fim da barra é placeholder. */
  semDuracao: boolean;
  /** `true` = ninguém registrou o início; o começo da barra é fabricado. */
  inicioEstimado: boolean;
  /** O número que alguém digitou, em dias. `null` = ninguém digitou. */
  estimativaDias: number | null;
  /** `true` = a tarefa está fora do subgrafo do goal; o início não é projeção do CPM. */
  foraDoCpm: boolean;
  /** `true` = tarefa concluída sem barra (só o ponto). */
  semBarra: boolean;
  /** ISO do ponto de conclusão, quando `semBarra` e há data válida. */
  pontoConcluidoEm: string | null;
}

/**
 * "0,5 dia" · "1 dia" · "1,5 dias" · "3 dias". Vírgula decimal (pt-BR) e sem
 * casas à toa (`3` nunca vira "3,0"). Singular até 1 dia inclusive — "0,5
 * dias" é o tipo de frase que faz o leitor parar para reler.
 */
export function formatarDias(dias: number): string {
  if (!Number.isFinite(dias)) return "duração inválida";
  const arredondado = Math.round(dias * 100) / 100;
  const texto = String(arredondado).replace(".", ",");
  return `${texto} ${arredondado <= 1 ? "dia" : "dias"}`;
}

/**
 * A frase do campo "Período" — a MESMA no tooltip da barra e na gaveta, para
 * que as duas superfícies nunca mais digam coisas diferentes sobre a mesma
 * tarefa (era o que acontecia: o tooltip dizia "sem data" e a gaveta,
 * "21/09/2026 → 22/09/2026").
 */
export function textoDoPeriodo(
  row: PeriodoDeTarefa,
  formatarData: (iso: string) => string,
): string {
  if (row.semBarra) {
    return row.pontoConcluidoEm
      ? `concluída em ${formatarData(row.pontoConcluidoEm)}`
      : "sem data registrada";
  }
  // O início vindo do CPM é uma PROJEÇÃO do motor (hoje + ES), não uma data
  // que alguém informou — e a tela diz isso por extenso.
  const rotuloInicio = row.foraDoCpm ? "início" : "início previsto";
  if (row.semDuracao) {
    return row.inicioEstimado
      ? "sem início nem duração registrados"
      : `${rotuloInicio} ${formatarData(row.inicio)} — duração não estimada`;
  }
  // Início fabricado, mas com estimativa DIGITADA: a frase de sempre ("início
  // não definido — estimativa de N"), agora com o N que alguém escreveu.
  // `0,5` sai "0,5 dia", não o "1 dia" que contradizia a barra de 12px.
  if (row.inicioEstimado) {
    return row.estimativaDias === null
      ? "início não definido — duração não estimada"
      : `início não definido — estimativa de ${formatarDias(row.estimativaDias)}`;
  }
  return `${formatarData(row.inicio)} → ${formatarData(row.fim)}`;
}

/**
 * `true` quando a tela NÃO pode imprimir um intervalo de datas para esta
 * tarefa — o teste de uma linha que a gaveta e o tooltip compartilham, e que
 * a guarda de comportamento consegue afirmar sem conhecer o texto.
 */
export function periodoEhIncerto(row: PeriodoDeTarefa): boolean {
  return row.semBarra || row.semDuracao || row.inicioEstimado;
}
