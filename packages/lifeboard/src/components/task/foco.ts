"use client";

/**
 * OS-LIFEBOARD · P6 — para onde o foco vai quando o controle focado SOME.
 *
 * [MÉDIO #2, rodada 5 do crítico] Medido em 5 de 5 operações da página: o
 * foco caía no `<body>` — depois de "Desfazer", "Limpar átomos", "confirmar
 * exclusão" de nota, Enter no segmentado de status e troca de mãe. Duas
 * causas, as duas tratadas:
 *
 *  (a) `disabled={pendente}` no controle QUE ESTÁ FOCADO: o navegador tira o
 *      foco de um elemento desabilitado e devolve ao documento. A correção
 *      é não usar `disabled` durante a transição — `aria-busy` +
 *      `aria-disabled` + um `if (pendente) return` no handler dão a mesma
 *      proteção contra duplo envio sem mexer no foco (ver
 *      `usar-acao-tarefa.ts` e `controle-segmentado.tsx`).
 *
 *  (b) controle que SOME do DOM no sucesso (o "Desfazer", o "Limpar átomos"
 *      quando não há mais átomos, o botão "excluir" da nota apagada): aí não
 *      há foco a preservar — há foco a ENTREGAR, e antes de o nó sair da
 *      árvore. É o que as funções abaixo decidem.
 *
 * Quem chama: `relacoes-painel.tsx`, `atomos-form.tsx`, `notas-painel.tsx`.
 */

/**
 * Qualquer coisa que aceite foco. Estrutural de propósito: `HTMLElement`,
 * `HTMLButtonElement` e `HTMLSelectElement` satisfazem, e o teste passa um
 * objeto falso sem precisar de DOM (o repositório não tem jsdom).
 */
export interface Focavel {
  focus: () => void;
}

/** O que `focarComAlternativa` precisa saber do documento — só quem está focado. */
export interface DocumentoComFoco {
  readonly activeElement: unknown;
}

/** O documento real quando existe (navegador); `null` no servidor e no teste. */
export function documentoAtual(): DocumentoComFoco | null {
  return typeof document === "undefined" ? null : document;
}

/** `focus()` sem estourar quando o nó já saiu da árvore (ou nunca entrou). */
export function focar(alvo: Focavel | null | undefined): void {
  alvo?.focus();
}

/**
 * Foco com alternativa — para o caso em que o alvo LÓGICO existe mas não
 * aceita foco.
 *
 * Foi assim que o caso nasceu, na rodada 5: ao desfazer a criação de uma
 * relação o alvo é o botão "Adicionar relação", que naquele momento estava
 * `disabled` (nenhum destino escolhido). Elemento `disabled` não recebe foco:
 * `.focus()` nele é um no-op silencioso, o foco fica onde estava — no
 * "Desfazer", que sai do DOM no instante seguinte. Resultado medido: `<body>`.
 *
 * [ALTO #1, rodada 6] Nenhum controle desta página usa mais `disabled` (nem
 * por validade — ver `escrita.ts`), então essa causa específica acabou. A
 * alternativa continua valendo para o que sobra: um nó que JÁ saiu da árvore
 * entre o clique e o `router.refresh()` também não aceita foco, e aí o plano
 * B é o primeiro controle do mesmo formulário.
 *
 * A alternativa é o primeiro controle do MESMO formulário (o `<select>` de
 * destino): o foco continua onde o trabalho continua, nunca no documento.
 * `documento` é injetável só para o teste (sem jsdom aqui).
 */
export function focarComAlternativa(
  alvo: Focavel | null | undefined,
  alternativa: Focavel | null | undefined,
  documento: DocumentoComFoco | null = documentoAtual(),
): void {
  focar(alvo);
  if (documento === null) return;
  if (alvo && documento.activeElement === alvo) return;
  focar(alternativa);
}

/**
 * Alvo lógico depois de excluir a nota de índice `indice` numa lista com
 * `total` notas (contando a que está sendo excluída). Regra do operador:
 * **a nota seguinte** — e, quando a excluída é a última da lista, **a
 * textarea da nota nova** (o lugar de onde o trabalho continua).
 *
 * PURA de propósito: é a parte da correção (b) que dá para provar sem DOM
 * (o repo não tem jsdom — ver `controle-segmentado.test.tsx`); o `.focus()`
 * em si é medido no navegador, com Playwright.
 */
export type AlvoAposExclusaoDeNota =
  | { tipo: "nota"; indice: number }
  | { tipo: "textarea" };

export function alvoAposExclusaoDeNota(indice: number, total: number): AlvoAposExclusaoDeNota {
  const seguinte = indice + 1;
  if (Number.isInteger(seguinte) && seguinte >= 0 && seguinte < total) {
    return { tipo: "nota", indice: seguinte };
  }
  return { tipo: "textarea" };
}
