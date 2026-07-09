/**
 * OS-LIFEBOARD · E5 — Círculo numerado de rank (spec §4.1 / §8.6 `RankBadge`).
 * Reforça a "prioridade de hoje": fundo gold-700, texto bone-100.
 */
export interface RankBadgeProps {
  /** Posição 0-based; exibe 1-based. */
  rank: number;
  className?: string;
}

export function RankBadge({
  rank,
  className,
}: RankBadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-700 font-mono text-xs font-medium text-bone-100 ${className ?? ""}`}
      aria-hidden="true"
    >
      {rank + 1}
    </span>
  );
}
