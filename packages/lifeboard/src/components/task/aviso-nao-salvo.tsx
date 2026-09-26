"use client";

/**
 * OS-LIFEBOARD · P6 — "isto ainda não está salvo", dito na tela.
 *
 * ═══════════════════════════════════════════════════════ MÉDIO #1, rodada 15 ═
 * DOIS CAMPOS DE DURAÇÃO LADO A LADO, COM COMPORTAMENTOS OPOSTOS E NENHUM
 * SINAL QUE OS DISTINGUISSE.
 *
 * A página tem dois campos com o mesmo desenho e quase o mesmo rótulo
 * ("Duração (dias, p80 …)" e "Duração (dias)"). Um guarda rascunho e volta
 * preenchido depois de uma navegação; o outro perde a edição em silêncio, por
 * decisão declarada da rodada 14 — e o operador não tinha como saber qual era
 * qual. Medido pelo crítico:
 *
 *   P3 gravado="3" · digitado=9.9 · algum aviso de 'não salvo' na tela: false
 *   P3 regiões vivas: []
 *   grep por "não salvo|sem salvar|alterações" em components/task/: zero
 *
 * A decisão da rodada 14 escolhia entre dois males ("perder é ruim; mentir é
 * pior") e não considerava o terceiro caminho. Ele é este, e é o padrão da
 * casa: **a tela diz o que vai acontecer com o que foi digitado.**
 *
 * O QUE ESTA RODADA ESCOLHEU, E POR QUÊ (divergência declarada do crítico, que
 * sugeria "guardar o rascunho E marcar não salvo"): a duração da TAREFA
 * continua SEM rascunho, e ganha o aviso. Dar-lhe rascunho faria a caixa
 * mostrar `9.9` com o banco em `3` depois de uma navegação — a página
 * afirmando um valor que o dado não tem, que é a família dos CRÍTICOs das
 * rodadas 10, 11 e 13, e é o que a medida G existe para impedir. O que o
 * crítico pediu de fato — "se mantiver a dispensa, a tela tem de dizer ao
 * operador que o que ele digitou não foi guardado" — é exatamente o que está
 * aqui, com DUAS frases diferentes, uma por comportamento.
 *
 * A régua que impede o quarto campo de nascer mudo é derivada, não uma lista:
 * `tests/unit/tarefa-escritas-varredura.test.ts` exige um `AvisoNaoSalvo` em
 * todo arquivo com `<CampoNumerico>`, e exige a frase CERTA para cada — a que
 * grava rascunho não pode usar a frase de quem perde, e vice-versa.
 */

/** Para o campo que NÃO guarda rascunho: sair da página perde o que está ali. */
export const AVISO_SEM_RASCUNHO =
  "Não salvo — se você sair desta página, o que está nesta caixa se perde.";

/** Para o campo que guarda rascunho: sair e voltar devolve o que foi digitado. */
export const AVISO_COM_RASCUNHO =
  "Não salvo — o que você digitou fica guardado nesta aba até você salvar.";

export interface AvisoNaoSalvoProps {
  /** O `id` que o `<input>` aponta em `aria-describedby`. */
  id: string;
  /** Há algo digitado que o servidor ainda não tem? */
  mostrar: boolean;
  /** `AVISO_SEM_RASCUNHO` ou `AVISO_COM_RASCUNHO` — nunca uma frase avulsa. */
  texto: typeof AVISO_SEM_RASCUNHO | typeof AVISO_COM_RASCUNHO;
}

/**
 * DESCRIÇÃO do campo, e NÃO região viva — a escolha é de propósito, e foi
 * medida: como `role="status"` este aviso quebrou a régua "cada formulário traz
 * UMA região viva" (`tarefa-componentes-render.test.ts`), que existe desde a
 * rodada 9 para o leitor de tela não receber duas frases coladas. Pior que a
 * régua: o texto muda a CADA TECLA, e uma região viva que fala a cada tecla é
 * exatamente o ruído que a página passou cinco rodadas removendo.
 *
 * Como descrição (`aria-describedby`), a frase é lida quando o campo recebe o
 * foco — que é quando ela importa — e fica visível o tempo todo para quem vê.
 * Nasce no DOM vazia, como as regiões vivas, para o `id` existir sempre.
 */
export function AvisoNaoSalvo({ id, mostrar, texto }: AvisoNaoSalvoProps): JSX.Element {
  return (
    <p
      id={id}
      className={
        mostrar
          ? "w-full text-xs font-medium text-state-warning"
          : "m-0 min-h-0 w-full text-xs text-state-warning"
      }
    >
      {mostrar ? texto : ""}
    </p>
  );
}
