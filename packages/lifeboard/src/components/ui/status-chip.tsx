import { Ban, CheckCircle2, Circle, Loader, type LucideIcon } from "lucide-react";

import type { TaskStatus } from "@/types/canonical";

/**
 * OS-LIFEBOARD · E5 — Chip de status (spec §1.1 mapa canônico / §8.6 `StatusChip`).
 *
 * Cor + ÍCONE + TEXTO sempre juntos (spec §7: "cor nunca é o único sinal";
 * daltônico-safe). Zero hex hardcoded — só utilitários dos tokens da §1.
 */
interface StatusConfig {
  label: string;
  icon: LucideIcon;
  /** classes utilitárias (texto/borda) do token de estado. */
  text: string;
  border: string;
}

const STATUS: Record<TaskStatus, StatusConfig> = {
  open: {
    label: "aberta",
    icon: Circle,
    text: "text-state-neutral",
    border: "border-state-neutral/60",
  },
  in_progress: {
    label: "em progresso",
    icon: Loader,
    text: "text-gold-500",
    border: "border-gold-500/70",
  },
  blocked: {
    label: "bloqueada",
    icon: Ban,
    text: "text-state-error-fg",
    border: "border-state-error/70",
  },
  done: {
    label: "concluída",
    icon: CheckCircle2,
    text: "text-state-success-fg",
    border: "border-state-success/60",
  },
};

export interface StatusChipProps {
  status: TaskStatus;
  className?: string;
}

export function StatusChip({
  status,
  className,
}: StatusChipProps): JSX.Element {
  const cfg = STATUS[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${cfg.border} bg-navy-850 px-2 py-0.5 text-xs font-medium ${cfg.text} ${className ?? ""}`}
    >
      <Icon size={12} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
