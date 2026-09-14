/**
 * OS-LIFEBOARD · P5 — rodada 6. Geometria do PAINEL da linha do tempo
 * (scroll horizontal, overflow e posição de rótulo colado na borda). PURA:
 * sem DOM, sem `window`, nunca lança — o navegador entra só como quem fornece
 * `scrollWidth`/`clientWidth` medidos.
 *
 * Existe porque os três defeitos da rodada 6 tinham a mesma forma: uma conta
 * de geometria feita EM LINHA dentro do componente, sem teste possível, e
 * portanto sem ninguém percebendo quando ela saía do que o navegador de fato
 * faz (o `scrollLeft` clampado, a rolagem que não cabe, o badge que estica o
 * `scrollWidth` além do fim do eixo).
 */

/**
 * O valor que o navegador REALMENTE assume depois de `el.scrollLeft = destino`.
 *
 * Achado ALTO A1 (rodada 6): `irParaHoje()` escrevia um destino NÃO clampado
 * em `el.scrollLeft` e sincronizava o cabeçalho com esse mesmo número. Quando
 * o destino passava do máximo (o caso do resize 390 → 1024: o conteúdo
 * encolhe de posição possível e o destino antigo vira impossível), o
 * navegador guardava o máximo, o evento `scroll` NÃO disparava (o valor já
 * estava lá) e o cabeçalho ficava 329,6px adiantado em relação às barras.
 * Régua: nunca menos que 0, nunca mais que `scrollWidth − clientWidth`, e
 * quando o conteúdo cabe inteiro o único valor possível é 0.
 */
export function clampScroll(destino: number, scrollWidth: number, clientWidth: number): number {
  const max = Math.max(0, (scrollWidth || 0) - (clientWidth || 0));
  if (!Number.isFinite(destino)) return 0;
  return Math.min(Math.max(destino, 0), max);
}

/**
 * Quantas TELAS de rolagem o conteúdo ocupa (achado MÉDIO A4): 11,3 significa
 * que o operador precisa rolar onze telas e um terço para ver a janela
 * inteira — e "Auto" dizia só "Auto". `1` quando tudo cabe (nunca menos que
 * 1, nunca `Infinity` com painel de largura 0 ainda não medida).
 */
export function fatorDeOverflow(totalWidth: number, clientWidth: number): number {
  if (!(clientWidth > 0) || !Number.isFinite(totalWidth) || totalWidth <= 0) return 1;
  return Math.max(1, totalWidth / clientWidth);
}

/** `11.3` → `"11,3"` — o número do chip/aviso de overflow, na vírgula do operador. */
export function formatarFator(fator: number): string {
  return fator.toFixed(1).replace(".", ",");
}

/**
 * Achado BAIXO A6 (rodada 6): o badge lateral ("sem data", "atrasada", "⚑")
 * é `position:absolute` e nasce DEPOIS do fim da barra — quando a barra
 * termina no fim do eixo, ele empurrava o `scrollWidth` do painel 44px além
 * de `totalWidth`, criando uma faixa de rolagem que não contém eixo nenhum.
 * Aqui o `x` absoluto do badge é preso dentro do eixo; a largura entra por
 * estimativa (a mesma heurística `larguraAproximada` do eixo, que
 * superestima de propósito).
 */
export function posicaoDoBadge(x: number, larguraBadge: number, totalWidth: number): number {
  const limite = Math.max(0, totalWidth - Math.max(0, larguraBadge));
  if (!Number.isFinite(x)) return 0;
  return Math.min(Math.max(x, 0), limite);
}

/**
 * Rodada 7 (mesmo pecado do achado MÉDIO #6, um aviso ao lado): o aviso de
 * overflow terminava SEMPRE em *"Use ← → ou escolha Trimestre"*. Medido a
 * 390px com janela de 900 dias: em "Auto" o conteúdo tem 2520px (11,6 telas) e
 * em "Trimestre" tem exatamente os MESMOS 2520px — porque "auto" já está no
 * piso de 6px/dia, que é a densidade do Trimestre. O conselho não encurta
 * nada; manda o operador trocar de zoom para chegar ao mesmo lugar.
 *
 * Aqui a frase só sugere Trimestre quando ele de fato deixaria o conteúdo mais
 * curto (densidade menor que a atual). Pura e testada, como o resto.
 */
export function avisoDeOverflow(params: {
  /** Telas de rolagem, já formatado com vírgula (`"11,6"`). */
  telas: string;
  /** `pxPorDia` que a tela está usando agora. */
  pxPorDiaAtual: number;
  /** `pxPorDia` do zoom Trimestre — o mais largo dos fixos. */
  pxPorDiaTrimestre: number;
}): string {
  const { telas, pxPorDiaAtual, pxPorDiaTrimestre } = params;
  const trimestreAjuda = pxPorDiaTrimestre < pxPorDiaAtual;
  return (
    `A janela é maior que a tela: ${telas} telas de rolagem. ` +
    (trimestreAjuda ? "Use ← → ou escolha Trimestre." : "Use ← → para percorrer.")
  );
}
