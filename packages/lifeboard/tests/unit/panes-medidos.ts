import tabela from "./panes-medidos.json";

/**
 * OS-LIFEBOARD · P4i — o tamanho do canvas do grafo, MEDIDO no Chromium.
 *
 * Achado ALTO #1 da rodada 8: a suíte inventava o pane a partir de constantes
 * que ninguém tinha conferido contra o DOM (e que estavam erradas — o
 * cabeçalho media 65px e não 53, e o `<nav>` global de 45px nem existia na
 * conta). Estes números não são calculados: são o `getBoundingClientRect()` do
 * `.react-flow` na página real, nas cinco larguras.
 *
 * Quem os mantém honestos é `scripts/guarda-no-navegador.mjs`: ele lê ESTE
 * MESMO arquivo e reprova se o DOM vivo divergir mais que `toleranciaPx`. Uma
 * tabela que apodrece em silêncio seria o achado #1 outra vez.
 */
export interface PaneMedido {
  largura: number;
  altura: number;
}

export const MEDIDO_EM: string = tabela.medidoEm;
export const TOLERANCIA_DO_PANE_PX: number = tabela.toleranciaPx;
export const PANES_MEDIDOS: Readonly<Record<string, PaneMedido | undefined>> = tabela.panes;
