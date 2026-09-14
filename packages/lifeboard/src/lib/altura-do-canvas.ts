import type { CSSProperties } from "react";

/**
 * OS-LIFEBOARD · P4h — a altura do canvas do grafo, em números (achados MÉDIO
 * #4 e BAIXO #7 do crítico hostil ROUND 8).
 *
 * O que ele mediu: `1280×800 → canvas 1280×354` (44% da janela) contra
 * `768×800 → canvas 768×534` (67%). O TABLET mostrava **12 cartões a mais** que
 * o desktop com 200 nós (32/200 contra 20/200) e 2 a mais com 40. Um painel
 * que encolhe quando a tela CRESCE é um defeito de layout, não uma escolha.
 *
 * A causa: no desktop a faixa de baixo ("Fontes" + "Hoje") levava `lg:h-[38%]`
 * da altura do corpo — 284px numa janela de 800 — e o grafo ficava com o
 * resto. No tablet a faixa de baixo está `hidden` quando a aba "Grafo" está
 * aberta: o grafo fica com o corpo INTEIRO, menos as abas.
 *
 * Decisão fixa da rodada 8: **o canvas do desktop nunca é proporcionalmente
 * menor que o do tablet.** Como no desktop os três painéis existem ao mesmo
 * tempo, o único jeito de honrar isso sem espremer "Hoje" é o que o próprio
 * comentário do arquivo já prometia — o grafo fica com a dobra, e "Hoje"
 * continua a UM ROLAR de distância (a página rola a partir de 1024px).
 *
 * Todo número abaixo é px de CSS e mora só aqui; `dashboard-client.tsx` lê
 * daqui, inclusive as classes. `tests/unit/altura-do-canvas.test.ts` mede a
 * desigualdade nas três larguras.
 */

/** Cabeçalho (ALMA PETRA + ações), `py-2.5` + conteúdo. */
export const ALTURA_DO_CABECALHO_PX = 53;
/** Abas "Hoje/Grafo/Fontes" — existem só abaixo de 1024px (`lg:hidden`). */
export const ALTURA_DAS_ABAS_PX = 49;
/** Título "Grafo — como as tarefas se puxam" + borda. */
export const ALTURA_DO_TITULO_DO_GRAFO_PX = 45;

/**
 * A BARRA de controle do grafo (Legenda · Camadas · zoom · enquadrar · chip).
 *
 * Achado BAIXO #7: a 390px o chip descia para uma segunda linha e a barra
 * engordava 50px — **o chip encolhia o canvas que ele mede** (`pane=541` com
 * chip, `591` sem). Altura FIXA aqui + o chip preso na mesma linha
 * (`basis-0`, ver `CLASSES_DO_CHIP_FORA_DA_TELA`) fecham a realimentação: o
 * canvas não muda de tamanho por causa do que a barra tem dentro.
 */
export const ALTURA_DA_BARRA_DO_GRAFO_PX = 52;

/**
 * O que o desktop cede ACIMA do canvas — o cabeçalho e um respiro. Tem de
 * ficar ABAIXO de `ALTURA_DO_CABECALHO_PX + ALTURA_DAS_ABAS_PX` (102px), que é
 * o que o tablet gasta antes do grafo: é essa diferença que faz o canvas do
 * desktop empatar ou ganhar do tablet.
 */
export const RESERVA_DO_GRAFO_PX = 96;

/** Altura da faixa "Fontes + Hoje" no desktop — fixa, e logo abaixo da dobra. */
export const ALTURA_DA_FAIXA_DE_BAIXO_PX = 352;

export const LARGURA_DO_DESKTOP_PX = 1024;

/** `height` da seção do grafo no desktop, como CSS. */
export function alturaDaSecaoDoGrafoCss(): string {
  return `calc(100dvh - ${RESERVA_DO_GRAFO_PX}px)`;
}

/** Altura do CANVAS (o retângulo do ReactFlow) na largura e janela dadas. */
export function alturaDoCanvasDoGrafo(params: {
  larguraDaJanela: number;
  alturaDaJanela: number;
}): number {
  const cromo = ALTURA_DO_TITULO_DO_GRAFO_PX + ALTURA_DA_BARRA_DO_GRAFO_PX;
  if (params.larguraDaJanela >= LARGURA_DO_DESKTOP_PX) {
    return params.alturaDaJanela - RESERVA_DO_GRAFO_PX - cromo;
  }
  // Abaixo de 1024 a aba "Grafo" deixa a faixa de baixo `hidden` e sem
  // `flex-1` — o corpo inteiro, menos as abas, é do grafo.
  return (
    params.alturaDaJanela - ALTURA_DO_CABECALHO_PX - ALTURA_DAS_ABAS_PX - cromo
  );
}

/** As variáveis CSS que o corpo do painel publica para as classes lerem. */
export function estiloDasAlturasDoCorpo(): CSSProperties {
  return {
    "--lb-altura-do-grafo": alturaDaSecaoDoGrafoCss(),
    "--lb-altura-da-faixa": `${ALTURA_DA_FAIXA_DE_BAIXO_PX}px`,
  } as CSSProperties;
}

/**
 * Classes da SEÇÃO do grafo no desktop. `lg:h-[var(--lb-altura-do-grafo)]` é
 * string literal de propósito: o JIT do Tailwind só compila classe que aparece
 * escrita no código-fonte (o mesmo motivo de `ALTURA_DO_CARTAO` ir por
 * `style`), e `tailwind.config.ts` varre `./src/**` — este arquivo incluso.
 */
export const CLASSES_DA_SECAO_DO_GRAFO =
  "lg:h-[var(--lb-altura-do-grafo)] lg:min-h-[26rem] lg:flex-none";

/** Classes da faixa "Fontes + Hoje" no desktop — altura fixa, abaixo da dobra. */
export const CLASSES_DA_FAIXA_DE_BAIXO =
  "lg:h-[var(--lb-altura-da-faixa)] lg:flex-none lg:border-t lg:border-navy-700";

/**
 * Classes do chip de fora-da-tela. `min-w-0 flex-1 basis-0` é o conserto do
 * achado BAIXO #7: com base 0 o chip não empurra linha nenhuma — ele encolhe e
 * trunca (o número fica na frente, o texto inteiro continua no `title`), e a
 * barra mantém `ALTURA_DA_BARRA_DO_GRAFO_PX` em qualquer largura.
 */
export const CLASSES_DO_CHIP_FORA_DA_TELA =
  "flex min-h-[44px] min-w-0 flex-1 basis-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-gold-500/60 bg-navy-850/95 px-3 text-xs font-medium text-gold-300 shadow-panel";

/** Classes da BARRA de controle — altura fixa, nunca em função do conteúdo. */
export const CLASSES_DA_BARRA_DO_GRAFO =
  "flex h-[52px] shrink-0 items-center gap-1.5 overflow-hidden border-b border-navy-700 bg-navy-900/60 px-2";
