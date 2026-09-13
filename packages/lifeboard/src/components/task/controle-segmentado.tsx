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
 */
export interface OpcaoSegmentada<T extends string | number> {
  valor: T;
  rotulo: string;
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

  function moverPara(indiceAlvo: number): void {
    const opcao = opcoes[indiceAlvo];
    if (!opcao) return;
    aoMudar(opcao.valor);
    botoesRef.current.get(indiceAlvo)?.focus();
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    if (desabilitado || opcoes.length === 0) return;
    const ultimo = opcoes.length - 1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moverPara(indice === ultimo ? 0 : indice + 1);
        return;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moverPara(indice === 0 ? ultimo : indice - 1);
        return;
      case "Home":
        e.preventDefault();
        moverPara(0);
        return;
      case "End":
        e.preventDefault();
        moverPara(ultimo);
        return;
      default:
        return;
    }
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
