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
    /**
     * P4e (achado BAIXO #8 do crítico hostil ROUND 4): o popover de desktop
     * prometia `role="dialog"` e não continha o foco — medido a 1280px, o 6º
     * Tab saía do painel "Camadas" ABERTO direto para os links da navegação
     * (`A[Painel]`, `A[Assuntos]`), deixando um diálogo aberto atrás de um
     * foco que já estava em outro lugar da página. A folha mobile já tinha
     * armadilha de foco própria (`layer-toggle-panel.tsx`); este hook cobre o
     * caso de desktop pela outra ponta: assim que o foco ENTRA em algo fora do
     * container, o popover fecha e `fechar()` devolve o foco ao pill que o
     * abriu (cada chamador faz isso) — nunca fica um diálogo aberto sem foco
     * dentro. `focusin` (e não `focusout`) porque ele já chega com o destino
     * real do foco em `event.target`, sem depender de `relatedTarget`, que
     * vem `null` em vários caminhos de navegação.
     */
    const aoFocarFora = (e: FocusEvent): void => {
      const alvo = e.target;
      if (alvo instanceof Node && containerRef.current && !containerRef.current.contains(alvo)) {
        fechar();
      }
    };
    /**
     * Os dois eventos, não um: `focusin` pega o foco POUSANDO fora (Tab para um
     * link da navegação, clique num campo), mas quando o Tab leva o foco para o
     * `body` — o que acontece depois do último elemento do painel — nenhum
     * `focusin` dispara, e o diálogo ficava aberto por mais um passo com o foco
     * já fora dele. `focusout` fecha esse vão: ele dispara SAINDO, e
     * `relatedTarget` nulo (foco indo para o `body`/fora do documento) conta
     * como "foi para fora".
     */
    const aoSairOFoco = (e: FocusEvent): void => {
      const container = containerRef.current;
      if (!container) return;
      const origem = e.target;
      if (!(origem instanceof Node) || !container.contains(origem)) return;
      const destino = e.relatedTarget;
      if (destino instanceof Node && container.contains(destino)) return;
      fechar();
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("pointerdown", aoClicarFora);
    document.addEventListener("focusin", aoFocarFora);
    document.addEventListener("focusout", aoSairOFoco);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("pointerdown", aoClicarFora);
      document.removeEventListener("focusin", aoFocarFora);
      document.removeEventListener("focusout", aoSairOFoco);
    };
  }, [aberto, containerRef, fechar]);
}
