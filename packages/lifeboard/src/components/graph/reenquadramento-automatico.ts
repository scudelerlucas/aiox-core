"use client";
import { useEffect, useRef } from "react";

/**
 * OS-LIFEBOARD · P4h — quando o reenquadramento automático pode rodar (achado
 * CRÍTICO #1 do crítico hostil ROUND 8).
 *
 * O que ele mediu na rota real: a 1440×900 o zoom inicial era 0,7997; cada
 * clique em "Aumentar zoom" subia para 0,9597 e **2 segundos depois estava de
 * volta em 0,7997** — seis cliques, seis vezes, `tx/ty` idênticos até a décima.
 * A roda do mouse (o mesmo caminho do pinch) idem. Consequência: em 7 de 7
 * sondagens o modo era SEMPRE mapa, e o modo CARTÃO inteiro (os 180px, o S, o
 * A, a folga, o chip de estado) **nunca aparecia, sem nenhum caminho até ele**.
 *
 * A causa cabia numa lista de dependências:
 *
 * ```ts
 * }, [nodesInitialized, assinaturaDoFiltro, larguraDoPane, alturaDoPane, enquadrar]);
 * ```
 *
 * `enquadrar` nasce de `useEnquadramentos`, que depende de `caixaParaAltura`,
 * que depende do `layout`, que depende de `nodeHEfetivo`, que depende do
 * `modo`, que depende do ZOOM VIVO. Cruzar 0,85 trocava o modo → novo layout →
 * nova identidade de `enquadrar` → **o efeito refiring e `setViewport`
 * desfazendo o gesto do operador**. O comentário dizia que o efeito existia
 * para "filtro ou tamanho do pane"; a lista o fazia competir com o dedo.
 *
 * Decisão fixa da rodada 8: **o gesto do operador é soberano.** O
 * reenquadramento automático roda quando muda o FILTRO ou o TAMANHO do painel,
 * nunca por mudança de modo ou de zoom.
 *
 * Por isso as dependências saem de uma função PURA e EXPORTADA: é ela que o
 * simulador de `tests/unit/zoom-do-operador.test.ts` consome para medir o zoom
 * depois de N cliques. Devolver `enquadrar` à lista (a mutação) deixa aquele
 * teste vermelho — que é a única prova que vale.
 */

export interface GatilhoDoReenquadramento<Alvo> {
  /** O ReactFlow já mediu os nós? Antes disso não há o que enquadrar. */
  nodesInitialized: boolean;
  /** Fontes marcadas no filtro, ordenadas e juntas — muda o conjunto de nós. */
  assinaturaDoFiltro: string;
  larguraDoPane: number;
  alturaDoPane: number;
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
 * (filtro, tamanho do painel) — nunca funções, que nascem novas a cada render.
 */
export function dependenciasDoReenquadramento<Alvo>(
  gatilho: GatilhoDoReenquadramento<Alvo>,
): readonly unknown[] {
  return [
    gatilho.nodesInitialized,
    gatilho.assinaturaDoFiltro,
    gatilho.larguraDoPane,
    gatilho.alturaDoPane,
  ];
}

/** Atraso antes de enquadrar: o ReactFlow ainda está medindo no mesmo frame. */
export const ATRASO_DO_REENQUADRAMENTO_MS = 60;
export const DURACAO_DO_REENQUADRAMENTO_MS = 200;

/** O corpo do efeito — puro o bastante para o simulador chamar o MESMO código. */
export function aplicarReenquadramentoAutomatico<Alvo>(
  gatilho: GatilhoDoReenquadramento<Alvo>,
): void {
  if (!gatilho.nodesInitialized) return;
  gatilho.enquadrar(gatilho.alvo, DURACAO_DO_REENQUADRAMENTO_MS);
}

/**
 * Reenquadra quando — e só quando — o filtro ou o tamanho do painel mudam.
 * O alvo e a função vivem num ref: são lidos na hora de aplicar, nunca
 * disparam.
 */
export function useReenquadramentoAutomatico<Alvo>(
  gatilho: GatilhoDoReenquadramento<Alvo>,
): void {
  const vivo = useRef(gatilho);
  vivo.current = gatilho;
  useEffect(() => {
    const id = window.setTimeout(
      () => aplicarReenquadramentoAutomatico(vivo.current),
      ATRASO_DO_REENQUADRAMENTO_MS,
    );
    return () => window.clearTimeout(id);
    // A lista é a decisão inteira deste arquivo — ver o cabeçalho.
  }, dependenciasDoReenquadramento(gatilho));
}
