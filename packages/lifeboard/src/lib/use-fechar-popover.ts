"use client";
import { useEffect, type RefObject } from "react";

/**
 * OS-LIFEBOARD · P4d — hook compartilhado por `GraphLegend` e
 * `LayerTogglePanel` (achado BAIXO #11 do crítico hostil ROUND 3): nenhum dos
 * dois popovers fechava no ESC nem por clique fora — só pelo próprio botão de
 * toggle. `containerRef` é o elemento que ENVOLVE o pill + o painel (clique
 * DENTRO dele nunca fecha, só fora); `fechar` decide o que "fechar" faz
 * (inclui devolver o foco ao pill — ver cada chamador).
 */
export function useFecharPopover(
  aberto: boolean,
  containerRef: RefObject<HTMLElement>,
  fechar: () => void,
): void {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === "Escape") fechar();
    };
    const aoClicarFora = (e: PointerEvent): void => {
      const alvo = e.target;
      if (alvo instanceof Node && containerRef.current && !containerRef.current.contains(alvo)) {
        fechar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("pointerdown", aoClicarFora);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("pointerdown", aoClicarFora);
    };
  }, [aberto, containerRef, fechar]);
}
