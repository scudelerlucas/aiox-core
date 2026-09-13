"use client";

/**
 * OS-LIFEBOARD · P6 — controle segmentado genérico (radiogroup de botões).
 * Reusado por status, opcionalidade, esforço, custo e tipo de aresta — a
 * régua de UI/UX pede uma ação primária por tela; isto aqui é seleção, não
 * ação, então múltiplos cabem lado a lado sem violar a régua.
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
  return (
    <div
      role="radiogroup"
      aria-label={rotuloGrupo}
      className={`inline-flex flex-wrap gap-1.5 ${className ?? ""}`}
    >
      {opcoes.map((op) => {
        const selecionado = op.valor === valorAtual;
        return (
          <button
            key={String(op.valor)}
            type="button"
            role="radio"
            aria-checked={selecionado}
            disabled={desabilitado}
            onClick={() => aoMudar(op.valor)}
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
