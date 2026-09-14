/**
 * OS-LIFEBOARD · P5 — rodada 7. A SINCRONIZAÇÃO entre o painel que rola e o
 * cabeçalho que a acompanha, como módulo PURO com o elemento INJETADO.
 *
 * Por que existe (achado ALTO #1 da rodada 7, medido por mutação pelo crítico
 * hostil): a correção-carro-chefe da rodada 6 — "o cabeçalho só se sincroniza
 * com o `scrollLeft` que o navegador de fato assumiu, nunca com o destino
 * calculado" — não tinha UM teste que a protegesse. O crítico reverteu o
 * corpo de `rolarPara` para `el.scrollLeft = destino` + cabeçalho pelo destino
 * cru (o bug LITERAL dos 329,6px) e a suíte ficou VERDE 879/879; removeu a
 * re-sincronização do `ResizeObserver` e ficou VERDE 879/879. Os 4 testes de
 * `clampScroll` provavam que a função pura clampa — nenhum provava que alguém
 * a CHAMA. O mesmo defeito já tinha voltado entre as rodadas 4→5 e 5→6.
 *
 * A guarda agora é mecânica, em duas camadas:
 *
 * 1. **Este módulo.** O componente virou casca: ele não escreve mais em
 *    `.scrollLeft` — passa o elemento aqui. `rolarESincronizar` escreve o
 *    destino JÁ clampado e **lê de volta** `elemento.scrollLeft`; o
 *    `transformDoCabecalho` sai desse valor lido, nunca do destino. Um
 *    elemento falso que CLAMPA como o navegador (setter que satura em
 *    `scrollWidth − clientWidth`) faz o teste distinguir as duas coisas: com
 *    a leitura de volta, `transformDoCabecalho === −scrollLeftAplicado`; com
 *    o destino cru, os dois divergem exatamente nos 329,6px medidos.
 * 2. **A varredura de fonte** (`tests/unit/linha-do-tempo-sincronizacao.test.ts`,
 *    a mesma disciplina da peça P6 em `components/task/escrita.ts`): um teste
 *    lê `components/timeline/linha-do-tempo.tsx` e falha se houver atribuição
 *    direta a `.scrollLeft` fora deste módulo, ou se o `ResizeObserver` do
 *    painel não chamar `aoRedimensionar`.
 *
 * PURO: sem DOM, sem `window`, nunca lança. O navegador entra só como quem
 * fornece um objeto com `scrollLeft` (lê e escreve), `scrollWidth` e
 * `clientWidth` — a interface mínima abaixo, que um `HTMLDivElement` satisfaz.
 */

import { clampScroll } from "@/core/timeline/geometria-painel";

/** A interface MÍNIMA do elemento que rola — nada de DOM real. */
export interface ElementoRolavel {
  scrollLeft: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

/** Tolerância de arredondamento de subpixel ao decidir se ainda há para onde rolar. */
export const FOLGA_AFORDANCIA_PX = 1;

export interface Sincronizacao {
  /** O `scrollLeft` que o elemento REALMENTE assumiu — lido de volta, nunca o destino pedido. */
  scrollLeftAplicado: number;
  /** O `translateX`, em px, do conteúdo do cabeçalho. Sempre `−scrollLeftAplicado`. */
  transformDoCabecalho: number;
  /** Há mais conteúdo para cada lado? (afordância dos degradês de borda) */
  afordancia: { esquerda: boolean; direita: boolean };
}

function numero(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/**
 * Lê o estado ATUAL do elemento e devolve o par sincronizado. Não escreve
 * nada — é o que o evento `scroll` e o `ResizeObserver` precisam.
 */
export function lerSincronizacao(elemento: ElementoRolavel): Sincronizacao {
  const aplicado = numero(elemento.scrollLeft);
  const scrollWidth = numero(elemento.scrollWidth);
  const clientWidth = numero(elemento.clientWidth);
  return {
    scrollLeftAplicado: aplicado,
    transformDoCabecalho: -aplicado,
    afordancia: {
      esquerda: aplicado > FOLGA_AFORDANCIA_PX,
      direita: aplicado + clientWidth < scrollWidth - FOLGA_AFORDANCIA_PX,
    },
  };
}

/**
 * Vai para `destino` e devolve o que o elemento REALMENTE assumiu.
 *
 * As duas metades importam e são uma só operação:
 * (a) o destino passa por `clampScroll` antes de ser escrito (nunca um valor
 *     impossível), e
 * (b) o retorno vem de uma LEITURA de `elemento.scrollLeft` DEPOIS da escrita
 *     — porque mesmo um destino clampado por nós pode ser ajustado pelo
 *     navegador (subpixel, RTL, `scroll-snap`), e porque é justamente esta
 *     leitura que impede o cabeçalho de acreditar num número que a tela não tem.
 */
export function rolarESincronizar(elemento: ElementoRolavel, destino: number): Sincronizacao {
  elemento.scrollLeft = clampScroll(destino, elemento.scrollWidth, elemento.clientWidth);
  return lerSincronizacao(elemento);
}

/**
 * O caminho do `ResizeObserver`: o painel mudou de tamanho, o navegador pode
 * ter clampado o `scrollLeft` SOZINHO (o máximo diminuiu, ou o conteúdo passou
 * a caber) e, por já estar no valor novo, nunca dispara `scroll`. Sem esta
 * chamada o cabeçalho fica parado no valor antigo — os 329,6px do crítico.
 * Não escreve: só relê e devolve o par.
 */
export function aoRedimensionar(elemento: ElementoRolavel): Sincronizacao {
  return lerSincronizacao(elemento);
}

/**
 * Onde o painel precisa estar para que o intervalo `[inicio, fim]` do
 * conteúdo fique INTEIRO dentro da janela visível, mexendo o mínimo possível.
 *
 * Rodada 7, decisão D2: quando o painel de detalhe passa a COMPRIMIR o gráfico
 * (coluna própria a partir de 768px), a largura visível encolhe — e a barra da
 * tarefa que o operador acabou de selecionar pode ficar fora dela. Já visível
 * → devolve `scrollLeftAtual` (nunca mexe à toa); à esquerda → alinha pelo
 * início; à direita → alinha pelo fim. Item mais largo que a janela: o início
 * ganha (é onde a barra começa).
 */
export function scrollParaRevelar(params: {
  inicio: number;
  fim: number;
  scrollLeftAtual: number;
  larguraVisivel: number;
  margem?: number;
}): number {
  const { inicio, fim, scrollLeftAtual, larguraVisivel } = params;
  const margem = Math.max(0, params.margem ?? 0);
  if (!(larguraVisivel > 0) || !Number.isFinite(inicio) || !Number.isFinite(fim)) {
    return numero(scrollLeftAtual);
  }
  const esquerda = Math.min(inicio, fim) - margem;
  const direita = Math.max(inicio, fim) + margem;
  const atual = numero(scrollLeftAtual);
  if (direita - esquerda >= larguraVisivel) return Math.max(0, esquerda);
  if (esquerda < atual) return Math.max(0, esquerda);
  if (direita > atual + larguraVisivel) return Math.max(0, direita - larguraVisivel);
  return atual;
}
