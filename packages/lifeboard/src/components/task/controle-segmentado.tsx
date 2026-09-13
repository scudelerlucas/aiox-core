"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * OS-LIFEBOARD · P6 — controle segmentado genérico (radiogroup de botões).
 * Reusado por status, opcionalidade, esforço, custo e tipo de aresta — a
 * régua de UI/UX pede uma ação primária por tela; isto aqui é seleção, não
 * ação, então múltiplos cabem lado a lado sem violar a régua.
 *
 * v2 (achado MÉDIO #8, crítico 13/09): `role="radiogroup"` sem roving
 * tabindex — Tab visitava CADA botão (20 paradas de Tab na página inteira
 * antes de chegar na textarea da nota), e as setas não faziam nada, ao
 * contrário de todo `radiogroup` nativo. Agora só o botão SELECIONADO tem
 * `tabIndex=0` (o resto é `-1`, fora do fluxo de Tab); ArrowLeft/Up move
 * para a opção anterior, ArrowRight/Down para a próxima (com wrap), e o
 * foco segue a seleção — mesmo padrão de um `<input type=radio">` nativo.
 *
 * v3 (achado MÉDIO #3, crítico 13/09, rodada 2): as setas moviam o foco E
 * COMITAVAM (chamavam `aoMudar`) a cada tecla — em `StatusForm`, que dispara
 * a mutação assim que `aoMudar` roda, isso mandava uma chamada de rede por
 * tecla ao navegar as 4 opções. Setas (e Home/End) agora só movem o FOCO do
 * navegador entre os botões — `aoMudar` só roda por clique, ou por Enter/
 * Espaço no botão focado (comportamento NATIVO do `<button>`, que já
 * dispara `onClick`; por isso o teclado não precisa de um caso especial
 * para essas duas teclas).
 */
export interface OpcaoSegmentada<T extends string | number> {
  valor: T;
  rotulo: string;
}

/**
 * PURA — para uma tecla de navegação, devolve o índice que deve RECEBER O
 * FOCO (nunca o que deve ser comitado): `null` quando a tecla não é de
 * navegação (inclui Enter/Espaço, que continuam sendo o clique nativo do
 * `<button>` — não passam por aqui). A assinatura em si é a prova do achado
 * MÉDIO #3 (rodada 2): esta função não recebe `aoMudar`, então não existe
 * chamada de commit que ela possa fazer — exportada só para o teste, que
 * roda sem DOM/jsdom (o repo não tem nenhum dos dois).
 */
export function indiceDeFocoParaTecla(
  key: string,
  indiceAtual: number,
  totalOpcoes: number,
): number | null {
  if (totalOpcoes === 0) return null;
  const ultimo = totalOpcoes - 1;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return indiceAtual === ultimo ? 0 : indiceAtual + 1;
    case "ArrowLeft":
    case "ArrowUp":
      return indiceAtual === 0 ? ultimo : indiceAtual - 1;
    case "Home":
      return 0;
    case "End":
      return ultimo;
    default:
      return null;
  }
}

export interface ControleSegmentadoProps<T extends string | number> {
  rotuloGrupo: string;
  opcoes: readonly OpcaoSegmentada<T>[];
  valorAtual: T;
  aoMudar: (valor: T) => void;
  desabilitado?: boolean;
  className?: string;
}

export function ControleSegmentado<T extends string | number>({
  rotuloGrupo,
  opcoes,
  valorAtual,
  aoMudar,
  desabilitado = false,
  className,
}: ControleSegmentadoProps<T>): JSX.Element {
  const botoesRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const indiceAtual = opcoes.findIndex((op) => op.valor === valorAtual);

  /**
   * Só move o FOCO do navegador para o botão alvo — nunca chama `aoMudar`.
   * Esta é a correção do achado MÉDIO #3: a versão anterior (`moverPara`)
   * comitava a cada tecla de seta; esta função, por contrato, não tem como
   * comitar nada — não recebe nem chama o callback de mudança.
   */
  function moverFoco(indiceAlvo: number): void {
    botoesRef.current.get(indiceAlvo)?.focus();
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    if (desabilitado) return;
    // Enter/Espaço não passam por `indiceDeFocoParaTecla` (devolve `null`) —
    // sem `e.preventDefault()`, o comportamento nativo do `<button>` já
    // dispara `onClick` (que comita via `aoMudar`), então não duplicamos o
    // commit aqui.
    const alvo = indiceDeFocoParaTecla(e.key, indice, opcoes.length);
    if (alvo === null) return;
    e.preventDefault();
    moverFoco(alvo);
  }

  return (
    <div
      role="radiogroup"
      aria-label={rotuloGrupo}
      className={`inline-flex flex-wrap gap-1.5 ${className ?? ""}`}
    >
      {opcoes.map((op, indice) => {
        const selecionado = op.valor === valorAtual;
        // Roving tabindex: só a opção selecionada entra no fluxo de Tab da
        // página — nenhuma outra (achado #8). Sem seleção nenhuma (não
        // deveria acontecer, mas defensivo), o primeiro item vira o parado.
        const ehParadaDoTab = selecionado || (indiceAtual === -1 && indice === 0);
        return (
          <button
            key={String(op.valor)}
            ref={(el) => {
              if (el) botoesRef.current.set(indice, el);
              else botoesRef.current.delete(indice);
            }}
            type="button"
            role="radio"
            aria-checked={selecionado}
            tabIndex={ehParadaDoTab ? 0 : -1}
            disabled={desabilitado}
            onClick={() => aoMudar(op.valor)}
            onKeyDown={(e) => aoTeclar(e, indice)}
            className={`min-h-[36px] rounded-lg border px-3 text-sm font-semibold transition duration-150 ease-almapetra disabled:opacity-50 ${
              selecionado
                ? "border-gold-500 bg-navy-800 text-gold-300"
                : "border-navy-700 bg-navy-850 text-bone-300 hover:border-navy-600 hover:text-bone-100"
            }`}
          >
            {op.rotulo}
          </button>
        );
      })}
    </div>
  );
}
