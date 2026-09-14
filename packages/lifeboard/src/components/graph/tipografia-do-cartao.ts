/**
 * OS-LIFEBOARD · P4f — Tipografia do cartão por ZOOM (D3 + achados BAIXO #9/#10).
 *
 * A régua que o crítico usa é uma só: **o menor texto do grafo, medido em px de
 * TELA (`font-size` computado × zoom), nunca fica abaixo de 12,0px** — em
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
 *   como PISO: `max(base, 12 / zoom)`. Abaixo de 12/13 ≈ 0,923 ela é que manda —
 *   e é ela que garante os 12,0px de tela no piso do modo cartão.
 *
 * • **modo mapa** (zoom < 0,85): zoom semântico. O cartão vira pastilha
 *   (título em 1 linha + ponto de status + META, sem S/A/folga), a ALTURA cai
 *   para `ALTURA_DA_PASTILHA` (achado MÉDIO #6 da rodada 6: a pastilha
 *   escondia o conteúdo e mantinha os 180px — 40 tarefas pediam 1.764px de
 *   mundo que nenhum zoom legível enquadra) e a fonte é compensada pelo
 *   zoom — `12 / zoom`, limitada a 2× (24px). O texto de tela fica constante
 *   em 12px enquanto o limite não morde.
 *
 * O limite de 2× é o que define o **piso de zoom do canvas**: abaixo de
 * `12 / 24 = 0,5` a compensação acaba e o texto voltaria a encolher — por isso
 * `ZOOM_MINIMO` (o `minZoom` do `<ReactFlow>`) é exatamente 0,5.
 */

/**
 * Piso de texto em px de TELA (régua de UI/UX da casa).
 *
 * Achado MÉDIO #11 do crítico hostil ROUND 6: o cabeçalho desta régua dizia
 * "menor fonte de tela 12,0px" e o número era 11,4 — no estado PADRÃO (zoom
 * 0,85) o menor texto media 11,40px, porque `max(13, 11,4/0,85) × 0,85` dá
 * exatamente 11,4. O piso agora é 12,0 e a conta fecha: `max(13, 12/0,85) =
 * 14,12`, que a 0,85 de zoom dá 12,00px de tela.
 */
export const PISO_DE_TELA_PX = 12;
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

/**
 * P4h (achado MÉDIO #5 do crítico hostil ROUND 8): quantos caracteres do
 * título cabem no cartão, por estimativa — e se o título vai ser CORTADO.
 *
 * O que ele mediu: a 390px os 40 cartões mostravam ~11 caracteres — "Revisar o
 * …", "Gravar a …", "Publicar a…", "Fechar co…", doze cartões impossíveis de
 * distinguir; a 1280 com 11 tarefas, ~18 caracteres, e a META do CPM aparecia
 * como "META Deplo…". O `title` do SVG só chega ao MOUSE.
 *
 * Corrigido o #1, o zoom volta a ser um caminho de leitura. O que sobra — e é
 * isto que esta função serve — é o caminho SEM MOUSE: `task-node.tsx` mostra o
 * nome inteiro num painel quando o cartão está SELECIONADO (Tab até o cartão,
 * Espaço para marcar), e só quando o nome de fato não coube.
 *
 * Não existe medição de fonte fora do navegador: 0,5 em por caractere é a
 * régua conservadora da fonte do cartão (a mesma família de estimativa de
 * `caixaEstimadaDoTexto`, que usa 0,62 para dígitos, mais largos que a média).
 */
export const LARGURA_UTIL_DO_TITULO_PX = 174;
const EM_POR_CARACTERE = 0.5;

export function caracteresQueCabemNoTitulo(params: {
  modo: "cartao" | "mapa";
  tituloPx: number;
  dadoPx: number;
  /** O cartão da META gasta largura com o selo na MESMA linha, no modo mapa. */
  temMeta?: boolean;
}): number {
  let largura = LARGURA_UTIL_DO_TITULO_PX;
  if (params.modo === "mapa") {
    // ponto de estado (0,7 em) + o gap de 8px que o separa do título.
    largura -= Math.round(params.dadoPx * 0.7) + 8;
    if (params.temMeta) largura -= Math.round(params.dadoPx * 4.2) + 8;
  }
  return Math.max(0, Math.floor(largura / (params.tituloPx * EM_POR_CARACTERE)));
}

/** `true` quando o título não cabe inteiro no cartão e vai ser truncado. */
export function tituloSeraCortado(titulo: string, params: {
  modo: "cartao" | "mapa";
  tituloPx: number;
  dadoPx: number;
  temMeta?: boolean;
}): boolean {
  // No modo cartão a META usa 2 linhas (`line-clamp-2`) — o dobro do espaço.
  const linhas = params.modo === "cartao" && params.temMeta ? 2 : 1;
  return titulo.length > caracteresQueCabemNoTitulo(params) * linhas;
}
