/**
 * OS-LIFEBOARD · P5 — rodada 12. O QUE UM ITEM FORA DA JANELA DIZ EM PALAVRAS.
 *
 * ## O defeito que este módulo fecha (achado ALTO 3 da rodada 12)
 *
 * A lei já estava escrita neste repositório, em `periodo-da-tarefa.ts`:
 *
 *   > O que ela ganha em troca (NUNCA VIRA UMA LINHA MUDA): o motivo POR
 *   > EXTENSO na coluna de rótulos, o mesmo motivo no `aria-label` da linha, e
 *   > a frase inteira na gaveta. Cor não é sinal nenhum aqui — é texto.
 *
 * Só que ela foi aplicada às tarefas **sem dado** (`motivoForaDaGrade`) e não
 * às que estão **fora da janela** desenhada. Medido a 390×844, "Auto":
 * 6 de 18 itens (33%) viravam um "◀" de 9 px com `aria-hidden="true"`,
 * `tabIndex={-1}`, e a data existindo SÓ no atributo `title`.
 *
 * E o repositório já havia medido, na rodada 7 (achado MÉDIO #7, no mesmo
 * arquivo), que **`title` não existe no toque**. Então, para um terço do
 * quadro no celular, a data simplesmente não chegava.
 *
 * Pior no caso das **concluídas** fora da janela: `motivoForaDaGrade` devolve
 * `null` (porque `semBarra`), o `title` do rótulo virava só o nome e o
 * `aria-label` não dizia data nenhuma — nem toque, nem leitor de tela, nem
 * hover chegavam à data de conclusão sem abrir a gaveta.
 *
 * ## A lei, agora igual nos dois casos
 *
 * Item fora da janela recebe, na COLUNA DE RÓTULOS:
 *   - texto VISÍVEL com o lado (◀/▶) e a data-âncora COM ANO — chega ao toque;
 *   - a frase por extenso no `aria-label` — chega ao leitor de tela;
 *   - a mesma frase no `title` — continua chegando ao hover.
 *
 * Por que o texto visível leva UMA data e não o período inteiro: a linha tem
 * 42 px de altura (`ROW_H`, a MESMA constante que posiciona a barra no canvas
 * — mudá-la desalinharia rótulo e barra) e a coluna tem 140 px no celular.
 * "03/08/2026 → 08/08/2026" não cabe numa linha de 12 px em 140 px, e cortar
 * a data com reticências seria o mesmo defeito com outra roupa. A data-âncora
 * é a que decide o lado da janela — é a informação que o desenho está se
 * recusando a dar. O período COMPLETO continua no `aria-label`, no `title` e
 * na gaveta, e as três frases saem daqui, nunca de um `?:` escrito na view.
 *
 * PURO: sem DOM, sem `Date.now()`, nunca lança. A formatação de data entra
 * por parâmetro.
 */

/** De que lado da janela desenhada o item caiu. */
export type LadoDaJanela = "antes" | "depois";

/** O glifo que o canvas usa para cada lado — a MESMA letra dos dois lugares. */
export function glifoDoLado(lado: LadoDaJanela): string {
  return lado === "antes" ? "◀" : "▶";
}

/**
 * O texto VISÍVEL da coluna de rótulos: glifo + o que a data-âncora é + a
 * data com ano. `concluida` troca o verbo, porque para uma tarefa concluída
 * fora da janela a âncora é a data de CONCLUSÃO, não um começo.
 */
export function textoVisivelForaDaJanela(
  lado: LadoDaJanela,
  dataAncora: string,
  concluida: boolean,
  formatarData: (iso: string) => string,
): string {
  const verbo = concluida ? "concluída" : "começa";
  return `${glifoDoLado(lado)} ${verbo} ${formatarData(dataAncora)}`;
}

/**
 * Só a CLÁUSULA: que o desenho está fora da janela e de que lado. Para as
 * superfícies que JÁ dizem o período (o `aria-label` do assunto, que sai de
 * `rotuloAcessivelDoAssunto`) — repetir o período ali produzia a frase
 * "…; 01/09/2026 → em aberto; 01/09/2026 → em aberto — fora da janela…",
 * que é pior do que não dizer: quem ouve o rótulo num leitor de tela ouve a
 * mesma data duas vezes e para para entender se são duas.
 */
export function clausulaForaDaJanela(lado: LadoDaJanela): string {
  return `fora da janela do tempo (${
    lado === "antes" ? "antes do início" : "depois do fim"
  } da janela desenhada)`;
}

/**
 * A frase POR EXTENSO para as superfícies que NÃO dizem o período sozinhas —
 * o `title` da linha de tarefa (que era só o nome) e o `aria-label` da tarefa
 * CONCLUÍDA fora da janela (que não dizia data nenhuma). Período INTEIRO, já
 * formatado pela função pura do tipo da linha (`textoDoPeriodo` ou
 * `textoDoPeriodoDoAssunto`), mais a cláusula.
 */
export function fraseForaDaJanela(lado: LadoDaJanela, periodo: string): string {
  return `${periodo} — ${clausulaForaDaJanela(lado)}`;
}

/**
 * O que o canvas desenha de uma linha, reduzido ao mínimo de que este módulo
 * precisa. `desenhaBarra` chega JÁ DECIDIDO por quem sabe decidir
 * (`desenhaBarraDeDuracao` para tarefa; para assunto, "não é dado podre") —
 * assim a decisão de existir barra continua tendo uma única fonte.
 */
export interface ItemDaGrade {
  /** Tarefa concluída fora do CPM: o desenho é um PONTO, não uma barra. */
  semBarra: boolean;
  /** ISO do ponto de conclusão, quando `semBarra`. */
  pontoConcluidoEm: string | null;
  /** `true` = a linha tem barra com comprimento (ou, no assunto, tem desenho). */
  desenhaBarra: boolean;
  /** O início da barra — a data que decide de que lado da janela ela cai. */
  inicio: string;
}

/**
 * A DATA-ÂNCORA da linha: a data que o canvas usa para decidir se o desenho
 * cabe na janela. É a data que o "◀"/"▶" está se recusando a mostrar, e por
 * isso é ela que tem de chegar por escrito à coluna de rótulos.
 *
 * `null` quando a linha não desenha nada posicionado no eixo (dado podre, ou
 * tarefa sem início/duração) — esses casos já têm dono: `motivoForaDaGrade`.
 */
export function ancoraDaJanela(item: ItemDaGrade): { iso: string; concluida: boolean } | null {
  if (item.semBarra) {
    return item.pontoConcluidoEm === null
      ? null
      : { iso: item.pontoConcluidoEm, concluida: true };
  }
  if (!item.desenhaBarra) return null;
  return { iso: item.inicio, concluida: false };
}
