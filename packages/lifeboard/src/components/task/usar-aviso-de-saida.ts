"use client";

import { useEffect } from "react";

/**
 * OS-LIFEBOARD · P6 — [BAIXO #7, rodada 6 do crítico] sair da página com uma
 * gravação em voo.
 *
 * Medido pelo crítico: com o POST segurado, `F5`/digitar outra URL levava a
 * gravação embora SEM UMA PALAVRA — a nota simplesmente não existia depois.
 * (Navegação interna do App Router não sofre disso: a Server Action já saiu
 * do cliente e o `router.refresh()` acontece na volta; o caso perdido é a
 * navegação DURA, que mata o documento inteiro.)
 *
 * A única ferramenta que o navegador dá para isso é `beforeunload` com
 * `returnValue` — que mostra o diálogo PADRÃO do navegador ("sair do site?"),
 * sem texto customizável (Chrome ignora textos próprios desde 2016). O
 * listener só existe ENQUANTO há gravação em voo: uma página parada nunca
 * pergunta nada.
 *
 * Decisão anterior registrada em `notas-painel.tsx` ("nada de `beforeunload`")
 * valia para o RASCUNHO da nota — texto digitado e não enviado, que hoje vive
 * em `sessionStorage` e volta sozinho. Isto aqui é outra coisa: dado JÁ
 * enviado, a caminho do banco, que some se a aba morrer no meio.
 */

/** O mínimo do `window` que este aviso usa — injetável no teste (sem jsdom aqui). */
export interface JanelaComAviso {
  addEventListener: (tipo: "beforeunload", ouvinte: (e: EventoDeSaida) => void) => void;
  removeEventListener: (tipo: "beforeunload", ouvinte: (e: EventoDeSaida) => void) => void;
}

export interface EventoDeSaida {
  preventDefault: () => void;
  returnValue: unknown;
}

/**
 * O CORPO do efeito, sem React — é o que o teste roda (montar um hook exigiria
 * DOM, que este repositório não tem).
 *
 * Devolve a função de limpeza (o mesmo contrato de `useEffect`): `undefined`
 * quando não há nada a vigiar, e uma função que remove EXATAMENTE o ouvinte
 * registrado quando há.
 */
export function registrarAvisoDeSaida(
  janela: JanelaComAviso | null,
  pendente: boolean,
): (() => void) | undefined {
  if (janela === null || !pendente) return undefined;
  const aoSair = (e: EventoDeSaida): void => {
    // Os dois, porque os navegadores discordam sobre qual basta: Chrome/Edge
    // olham `returnValue`, Firefox/Safari modernos aceitam `preventDefault()`.
    e.preventDefault();
    e.returnValue = "";
  };
  janela.addEventListener("beforeunload", aoSair);
  return () => janela.removeEventListener("beforeunload", aoSair);
}

/** O hook em si: liga o aviso enquanto `pendente`, desliga ao terminar. */
export function useAvisoDeSaida(pendente: boolean): void {
  useEffect(() => {
    const janela: JanelaComAviso | null =
      typeof window === "undefined" ? null : (window as unknown as JanelaComAviso);
    return registrarAvisoDeSaida(janela, pendente);
  }, [pendente]);
}
