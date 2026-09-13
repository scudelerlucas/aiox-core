/**
 * OS-LIFEBOARD — Círculo numerado de rank.
 *
 * v2 (13/09/2026): antes todos os lugares tinham o mesmo peso visual, então a
 * fila não comunicava prioridade — só numerava. Agora o **1º lugar** é dourado
 * sólido e maior, o 2º e o 3º ficam num degrau abaixo, e o resto é discreto.
 * Hierarquia visual: o olho cai onde a decisão está.
 */
export interface RankBadgeProps {
  /** Posição 0-based; exibe 1-based. */
  rank: number;
  className?: string;
}

export function RankBadge({ rank, className }: RankBadgeProps): JSX.Element {
  const primeiro = rank === 0;
  const podio = rank > 0 && rank < 3;

  const estilo = primeiro
    ? "h-8 w-8 bg-gradient-to-b from-gold-300 to-gold-500 text-navy-950 text-sm font-bold shadow-card"
    : podio
      ? "h-7 w-7 bg-gold-700/70 text-gold-300 text-xs font-semibold ring-1 ring-gold-600/60"
      : "h-7 w-7 bg-navy-800 text-bone-300 text-xs font-medium ring-1 ring-navy-700";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-mono ${estilo} ${className ?? ""}`}
      aria-hidden="true"
    >
      {rank + 1}
    </span>
  );
}
