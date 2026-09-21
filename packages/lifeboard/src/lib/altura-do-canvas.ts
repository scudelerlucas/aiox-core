"use client";
import { useEffect, useState, type RefObject } from "react";

/**
 * OS-LIFEBOARD · P4i — a altura do canvas do grafo, MEDIDA, não adivinhada
 * (achado ALTO #3 do crítico hostil ROUND 8: *a faixa "Hoje" tem 0 px
 * visíveis*, nas quatro larguras de desktop).
 *
 * A rodada 8 prometeu 43 px de "Hoje" acima da dobra e escreveu a promessa
 * assim: `altura da seção = 100dvh − 96px`, com 96 saindo de dois números
 * fixos no código (cabeçalho 53 + respiro). Medido no Chromium em 21/09:
 *
 * | largura × altura | topo real da seção | seção | fundo da seção | "Hoje" visível |
 * |---|---|---|---|---|
 * | 1024×800  | 151 | 704 | 855  | **0 px** |
 * | 1280×800  | 151 | 704 | 855  | **0 px** |
 * | 1440×900  | 151 | 804 | 955  | **0 px** |
 * | 1920×1080 | 151 | 984 | 1135 | **0 px** |
 *
 * Os 96 px eram três erros somados: o cabeçalho mede **65** px e não 53; o
 * `<nav>` global do `layout.tsx` (P5, `sticky top-0`) come **45** px que esta
 * conta nunca soube que existiam; e a linha de "fontes desatualizadas" come
 * mais **41** px — que aparecem ou não conforme o DADO do dia. Nenhum número
 * fixo poderia acertar isso, porque um dos três é dinâmico.
 *
 * Decisão da rodada 9: **a seção do grafo mede onde ela mesma começa.** O
 * componente lê `getBoundingClientRect().top` da própria seção e a altura vira
 * `janela − topo − TEASER`. Não sobra constante para errar: o que muda acima
 * da seção entra na conta sozinho.
 *
 * O teste de unidade aqui só pode provar a ARITMÉTICA. Quem prova o PIXEL é
 * `scripts/guarda-no-navegador.mjs`, que abre a página real no Chromium e
 * reprova se "Hoje" tiver menos que o teaser visível.
 */

/** Título "Grafo — como as tarefas se puxam" + borda. */
export const ALTURA_DO_TITULO_DO_GRAFO_PX = 45;

/**
 * A BARRA de controle do grafo (Legenda · Camadas · zoom · enquadrar · chip).
 *
 * Achado BAIXO #7 da rodada 8: a 390px o chip descia para uma segunda linha e
 * a barra engordava 50px — **o chip encolhia o canvas que ele mede**
 * (`pane=541` com chip, `591` sem). Altura FIXA aqui + o chip preso na mesma
 * linha (`basis-0`, ver `CLASSES_DO_CHIP_FORA_DA_TELA`) fecham a
 * realimentação.
 */
export const ALTURA_DA_BARRA_DO_GRAFO_PX = 52;

/** O cromo DENTRO da seção do grafo, acima do canvas. */
export const CROMO_DENTRO_DA_SECAO_PX =
  ALTURA_DO_TITULO_DO_GRAFO_PX + ALTURA_DA_BARRA_DO_GRAFO_PX;

/**
 * Quanto da faixa de baixo ("Fontes + Hoje") fica acima da dobra. É o sinal de
 * que há mais tela abaixo — sem ele o operador não tem por que rolar, e foi
 * exatamente isso que o crítico mediu em 0. 44 px é o alvo de toque da régua
 * da casa: menos que isso não é uma faixa, é uma sombra.
 */
export const TEASER_DA_FAIXA_DE_BAIXO_PX = 44;

/**
 * A borda de cima da faixa (`lg:border-t` em `CLASSES_DA_FAIXA_DE_BAIXO`) fica
 * ENTRE a seção do grafo e "Hoje" — mede 1px e não é "Hoje". Sem descontá-la a
 * medição no Chromium dá 43px onde o contrato pede 44.
 */
export const BORDA_DA_FAIXA_DE_BAIXO_PX = 1;

/** Altura da faixa "Fontes + Hoje" no desktop — fixa, e logo abaixo da dobra. */
export const ALTURA_DA_FAIXA_DE_BAIXO_PX = 352;

/** Piso da seção do grafo: abaixo disto o canvas deixa de ser um grafo. */
export const ALTURA_MINIMA_DA_SECAO_DO_GRAFO_PX = 416;

export const LARGURA_DO_DESKTOP_PX = 1024;

/**
 * A altura da seção do grafo no desktop, a partir do que foi MEDIDO: a janela,
 * e onde a seção começa. O teaser é o que sobra para a faixa de baixo.
 */
export function alturaDaSecaoDoGrafo(params: {
  alturaDaJanela: number;
  topoDaSecao: number;
}): number {
  const disponivel =
    params.alturaDaJanela -
    params.topoDaSecao -
    TEASER_DA_FAIXA_DE_BAIXO_PX -
    BORDA_DA_FAIXA_DE_BAIXO_PX;
  // `floor`, nunca `round`: arredondar para cima devolve 43px de teaser onde
  // o contrato pede 44 (o topo da seção quase nunca é inteiro).
  return Math.max(ALTURA_MINIMA_DA_SECAO_DO_GRAFO_PX, Math.floor(disponivel));
}

/** Altura do CANVAS (o retângulo do ReactFlow) dentro de uma seção dada. */
export function alturaDoCanvasDoGrafo(params: { alturaDaSecao: number }): number {
  return params.alturaDaSecao - CROMO_DENTRO_DA_SECAO_PX;
}

/** As variáveis CSS que o corpo do painel publica para as classes lerem. */
export function estiloDasAlturasDoCorpo(): Record<string, string> {
  return { "--lb-altura-da-faixa": `${ALTURA_DA_FAIXA_DE_BAIXO_PX}px` };
}

/**
 * Mede o topo da seção do grafo e devolve a altura que ela deve ter para
 * deixar `TEASER_DA_FAIXA_DE_BAIXO_PX` de "Hoje" visível acima da dobra.
 * Devolve `null` fora do desktop (abaixo de 1024 a seção é `flex-1` e o
 * navegador já resolve) e antes da primeira medição.
 *
 * Não há realimentação: mudar a ALTURA da seção não muda o TOPO dela — ela
 * está no fluxo normal, abaixo de tudo o que a conta usa.
 */
export function useAlturaDaSecaoDoGrafo(
  ref: RefObject<HTMLElement>,
): number | null {
  const [altura, setAltura] = useState<number | null>(null);

  useEffect(() => {
    const medir = (): void => {
      const el = ref.current;
      if (!el) return;
      if (window.innerWidth < LARGURA_DO_DESKTOP_PX) {
        setAltura(null);
        return;
      }
      const topoNoDocumento = el.getBoundingClientRect().top + window.scrollY;
      const nova = alturaDaSecaoDoGrafo({
        alturaDaJanela: window.innerHeight,
        topoDaSecao: topoNoDocumento,
      });
      setAltura((anterior) => (anterior !== null && Math.abs(anterior - nova) <= 1 ? anterior : nova));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [ref]);

  return altura;
}

/**
 * Classes da SEÇÃO do grafo no desktop. A ALTURA não está aqui de propósito —
 * ela é medida em runtime (`useAlturaDaSecaoDoGrafo`) e entra por `style`,
 * porque depende de coisas que o CSS não sabe somar: o `<nav>` global e a
 * linha de fontes desatualizadas, que aparece conforme o dado do dia.
 */
export const CLASSES_DA_SECAO_DO_GRAFO =
  "lg:min-h-[26rem] lg:flex-none";

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
