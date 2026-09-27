/**
 * OS-LIFEBOARD · P5 — rodada 11. O QUE UM ASSUNTO (PR) DIZ EM PALAVRAS.
 *
 * ## O defeito que este módulo fecha (achado MÉDIO 4 da rodada 11)
 *
 * O `aria-label` da linha de assunto era, inteiro:
 *
 *     `${titulo} — assunto em ${repo}`
 *
 * e as 28 barras do canvas são `aria-hidden`. Medido com PRs hostis:
 * mergeado, aberto, com data podre e com datas invertidas chegavam a um
 * leitor de tela **com exatamente a mesma frase**. Cor (a bolinha de estado)
 * e forma (losango, traço, borda tracejada) eram o único sinal — o que a
 * régua de UI/UX da casa proíbe ("cor nunca é o único sinal").
 *
 * Não era limitação da tela: na MESMA tela, a linha de TAREFA já carregava
 * "sem data", "atrasada", predecessores e sucessores por nome. A
 * inconsistência era entre dois grupos do mesmo quadro.
 *
 * ## A lei
 *
 * O estado e o período do assunto saem de UMA função pura cada, e as três
 * superfícies que falam dele — `aria-label` da linha, `title` da barra e o
 * campo "Período"/"Estado" da gaveta — bebem da mesma fonte. Nunca mais uma
 * delas sabendo de algo que a outra não diz.
 *
 * PURO: sem DOM, sem `Date.now()`, nunca lança. A formatação de data entra
 * por parâmetro.
 */

/** O que este módulo precisa saber de uma linha de assunto — nada além disto. */
export interface AssuntoEmPalavras {
  inicio: string;
  fim: string;
  aberto: boolean;
  estado: string;
  dataInvalida: boolean;
  datasInconsistentes: boolean;
  marco: boolean;
}

/** "mergeado" · "fechado sem merge" · "aberto" — o estado por extenso, nunca a cor. */
export function estadoDoAssunto(row: AssuntoEmPalavras): string {
  if (row.estado === "mergeado") return "mergeado";
  if (row.estado === "fechado") return "fechado sem merge";
  return "aberto";
}

/**
 * A frase do período do assunto — a MESMA na gaveta, no `title` da barra e no
 * `aria-label` da linha. Os três estados de dado podre têm frase própria:
 * data que não parseia, fim antes do início, e o PR do mesmo dia.
 */
export function textoDoPeriodoDoAssunto(
  row: AssuntoEmPalavras,
  formatarData: (iso: string) => string,
): string {
  if (row.dataInvalida) return "data inválida";
  if (row.datasInconsistentes) return "datas inconsistentes";
  if (row.marco) return `${formatarData(row.inicio)} (mesmo dia)`;
  return `${formatarData(row.inicio)} → ${row.aberto ? "em aberto" : formatarData(row.fim)}`;
}

/**
 * O `aria-label` inteiro da linha de assunto. Não é cosmético: é a única
 * forma pela qual estado e datas de um PR chegam a quem não vê a barra.
 */
export function rotuloAcessivelDoAssunto(
  row: AssuntoEmPalavras & { titulo: string; repo: string },
  formatarData: (iso: string) => string,
): string {
  return (
    `${row.titulo} — assunto em ${row.repo}; ${estadoDoAssunto(row)}; ` +
    textoDoPeriodoDoAssunto(row, formatarData)
  );
}
