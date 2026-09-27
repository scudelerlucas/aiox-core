"use client";
import { useEffect, useRef } from "react";

/**
 * OS-LIFEBOARD · P4i — quando o reenquadramento automático pode rodar.
 *
 * **Rodada 8** (achado CRÍTICO #1): a lista de dependências do efeito tinha
 * `enquadrar` dentro. `enquadrar` nasce de novo a cada troca de MODO do cartão,
 * que depende do zoom vivo — então todo zoom do operador que cruzava 0,85 era
 * desfeito em menos de 400 ms. A lista saiu para uma função pura e o gesto
 * virou soberano.
 *
 * **Rodada 9** (achado ALTO #2 do crítico hostil): a correção acima resolvia
 * o zoom, e abria a porta ao lado. Medido no Chromium em 21/09, nas quatro
 * larguras: seis cliques levavam o zoom ao teto (1,8) e ele ficava lá — até o
 * painel mudar **2 px de largura**, e o zoom voltar para 0,849. Dois pixels.
 * Uma barra de rolagem que aparece, um `dvh` que se acerta quando o teclado do
 * sistema some, a própria faixa "Hoje" ganhando altura: qualquer um desses
 * apagava o gesto. E a suíte da rodada 8 **afirmava isso como desejado** — o
 * teste "redimensionar o painel reenquadra" media um resize de 1280→390.
 *
 * Decisão da rodada 9: **o reenquadramento automático só responde a mudança
 * MATERIAL de tamanho** — a que muda o número de colunas do layout, ou que
 * passa de `LIMIAR_DE_REENQUADRAMENTO_PX` em qualquer eixo. A régua é contra o
 * último tamanho que DISPAROU (não contra o render anterior), então uma
 * sucessão de 2 px acumulada até 48 px ainda dispara — o que não dispara é
 * ruído.
 *
 * A lista de dependências e a régua de materialidade são funções PURAS e
 * exportadas, e o hook é chamado no teste com os hooks falsos de
 * `tests/unit/hooks-falsos.ts`: o que o teste lê é o array que este arquivo
 * entrega ao `useEffect` de verdade, não uma cópia. Pôr `enquadrar` de volta
 * — na função pura OU direto no `useEffect` — deixa
 * `tests/unit/reenquadramento-gatilho.test.ts` vermelho.
 */

export interface TamanhoDoPane {
  largura: number;
  altura: number;
  /** Quantas colunas o layout usa nessa largura (D2). */
  colunas: number;
}

/**
 * Abaixo disto, mudar o tamanho do painel não muda o desenho o bastante para
 * justificar desfazer o que o operador fez com as próprias mãos. 48 px é
 * maior que qualquer barra de rolagem (≈15), que o acerto de `100dvh` no
 * celular (≈0–4) e que o teaser da faixa de baixo (44).
 */
export const LIMIAR_DE_REENQUADRAMENTO_PX = 48;

/** A mudança de tamanho muda o DESENHO — ou é ruído? */
export function mudancaMaterialDeTamanho(
  anterior: TamanhoDoPane,
  atual: TamanhoDoPane,
): boolean {
  if (anterior.colunas !== atual.colunas) return true;
  if (Math.abs(anterior.largura - atual.largura) >= LIMIAR_DE_REENQUADRAMENTO_PX) return true;
  return Math.abs(anterior.altura - atual.altura) >= LIMIAR_DE_REENQUADRAMENTO_PX;
}

/**
 * O tamanho que vale como gatilho: o atual quando a mudança é material, senão
 * o último que já disparou. É o que trava o efeito contra ruído de sub-pixel
 * e de barra de rolagem sem travá-lo contra um resize de verdade.
 */
export function tamanhoQueDisparou(
  anterior: TamanhoDoPane | null,
  atual: TamanhoDoPane,
): TamanhoDoPane {
  if (anterior === null) return atual;
  return mudancaMaterialDeTamanho(anterior, atual) ? atual : anterior;
}

export interface GatilhoDoReenquadramento<Alvo> {
  /** O ReactFlow já mediu os nós? Antes disso não há o que enquadrar. */
  nodesInitialized: boolean;
  /** Fontes marcadas no filtro, ordenadas e juntas — muda o conjunto de nós. */
  assinaturaDoFiltro: string;
  larguraDoPane: number;
  alturaDoPane: number;
  /** Colunas do layout nessa largura — o que a largura de fato decide. */
  colunasDoLayout: number;
  /**
   * A função que aplica o enquadramento. Entra AQUI de propósito, e de
   * propósito NÃO sai em `dependenciasDoReenquadramento`: a identidade dela
   * muda a cada troca de modo, e é exatamente isso que não pode disparar nada.
   */
  enquadrar: (alvo: Alvo, duracaoMs?: number) => void;
  /** O alvo que o operador escolheu por último ("critico" | "tudo"). */
  alvo: Alvo;
}

/**
 * A lista de dependências do efeito de reenquadramento. Só gatilhos do MUNDO
 * (filtro, tamanho material do painel) — nunca funções, que nascem novas a
 * cada render, e nunca o tamanho cru, que treme sozinho.
 */
export function dependenciasDoReenquadramento<Alvo>(
  gatilho: GatilhoDoReenquadramento<Alvo>,
  tamanho: TamanhoDoPane,
): readonly unknown[] {
  return [
    gatilho.nodesInitialized,
    gatilho.assinaturaDoFiltro,
    tamanho.largura,
    tamanho.altura,
    tamanho.colunas,
  ];
}

/** Atraso antes de enquadrar: o ReactFlow ainda está medindo no mesmo frame. */
export const ATRASO_DO_REENQUADRAMENTO_MS = 60;
export const DURACAO_DO_REENQUADRAMENTO_MS = 200;

/** O corpo do efeito. */
export function aplicarReenquadramentoAutomatico<Alvo>(
  gatilho: GatilhoDoReenquadramento<Alvo>,
): void {
  if (!gatilho.nodesInitialized) return;
  gatilho.enquadrar(gatilho.alvo, DURACAO_DO_REENQUADRAMENTO_MS);
}

/**
 * Reenquadra quando — e só quando — o filtro muda ou o painel muda de tamanho
 * de forma material. O alvo e a função vivem num ref: são lidos na hora de
 * aplicar, nunca disparam.
 */
export function useReenquadramentoAutomatico<Alvo>(
  gatilho: GatilhoDoReenquadramento<Alvo>,
): void {
  const vivo = useRef(gatilho);
  vivo.current = gatilho;

  const ultimoTamanho = useRef<TamanhoDoPane | null>(null);
  const tamanho = tamanhoQueDisparou(ultimoTamanho.current, {
    largura: gatilho.larguraDoPane,
    altura: gatilho.alturaDoPane,
    colunas: gatilho.colunasDoLayout,
  });
  ultimoTamanho.current = tamanho;

  useEffect(() => {
    const id = window.setTimeout(
      () => aplicarReenquadramentoAutomatico(vivo.current),
      ATRASO_DO_REENQUADRAMENTO_MS,
    );
    return () => window.clearTimeout(id);
    // A lista é a decisão inteira deste arquivo — ver o cabeçalho.
  }, dependenciasDoReenquadramento(gatilho, tamanho));
}
