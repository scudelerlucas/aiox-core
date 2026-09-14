/**
 * OS-LIFEBOARD · P4f — Tipografia do cartão por ZOOM (D3 + achados BAIXO #9/#10).
 *
 * A régua que o crítico usa é uma só: **o menor texto do grafo, medido em px de
 * TELA (`font-size` computado × zoom), nunca fica abaixo de 11,4px** — em
 * qualquer zoom, inclusive depois de um zoom-out manual. Na rodada 4 ela
 * falhava dos dois lados: a 390px o menor texto dava 10,85px, e o zoom-out
 * manual chegava a 0,30 com fonte de 3,6px de tela.
 *
 * Duas faixas, uma régua:
 *
 * • **modo cartão** (zoom ≥ 0,85): o cartão inteiro, com base de 13px nos
 *   textos de dado e 14px no título (decisão #10 — subir a base em vez de
 *   subir o piso de zoom do enquadramento). Entre 0,85 e 0,877 nem 13px
 *   bastaria (13 × 0,85 = 11,05), então a mesma compensação do modo mapa entra
 *   como PISO: `max(base, 11,4 / zoom)`. Fora dessa fatia de 3% a conta não faz
 *   nada — é cinto de segurança, não regra nova.
 *
 * • **modo mapa** (zoom < 0,85): zoom semântico. O cartão vira pastilha
 *   (título em 1 linha + ponto de status + META, sem S/A/folga) e a fonte é
 *   compensada pelo zoom — `12 / zoom`, limitada a 2× (24px). O texto de tela
 *   fica constante em 12px enquanto o limite não morde.
 *
 * O limite de 2× é o que define o **piso de zoom do canvas**: abaixo de
 * `12 / 24 = 0,5` a compensação acaba e o texto voltaria a encolher — por isso
 * `ZOOM_MINIMO` (o `minZoom` do `<ReactFlow>`) é exatamente 0,5.
 */

/** Piso de texto em px de TELA (régua de UI/UX da casa). */
export const PISO_DE_TELA_PX = 11.4;
/** Abaixo deste zoom o cartão vira pastilha (zoom semântico). */
export const ZOOM_DO_MODO_MAPA = 0.85;
/** Base do modo cartão: textos de dado / título. */
export const BASE_DADO_PX = 13;
export const BASE_TITULO_PX = 14;
/** Base do modo mapa, antes da compensação por zoom. */
const BASE_MAPA_PX = 12;
/** Limite da compensação do modo mapa (decisão D3). */
const ESCALA_MAXIMA_DO_MAPA = 2;
/** Piso de zoom do canvas = onde a compensação do modo mapa satura. */
export const ZOOM_MINIMO = BASE_MAPA_PX / (BASE_MAPA_PX * ESCALA_MAXIMA_DO_MAPA);

export interface TipografiaDoCartao {
  modo: "cartao" | "mapa";
  /** `font-size` em px CSS dos textos de dado (folga, S, chip, badge). */
  dadoPx: number;
  /** `font-size` em px CSS do título. */
  tituloPx: number;
}

export function tipografiaDoCartao(zoom: number): TipografiaDoCartao {
  const z = zoom > 0 ? zoom : 1;
  if (z < ZOOM_DO_MODO_MAPA) {
    const px = Math.min(BASE_MAPA_PX * ESCALA_MAXIMA_DO_MAPA, BASE_MAPA_PX / z);
    return { modo: "mapa", dadoPx: px, tituloPx: px };
  }
  const piso = PISO_DE_TELA_PX / z;
  return {
    modo: "cartao",
    dadoPx: Math.max(BASE_DADO_PX, piso),
    tituloPx: Math.max(BASE_TITULO_PX, piso),
  };
}
