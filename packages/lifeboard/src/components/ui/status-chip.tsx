import {
  Ban,
  CheckCircle2,
  Circle,
  HelpCircle,
  Loader,
  type LucideIcon,
} from "lucide-react";

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

const STATUS: Record<string, StatusConfig> = {
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

/**
 * Estado que veio do banco e não está na união `TaskStatus`. Mesmo caso de
 * `iconeDaFonte`: o tipo não protege, porque o valor chega do Postgres como
 * texto. Sem este fallback, `STATUS[status]` devolve `undefined` e o `.icon`
 * derruba a árvore inteira (a home caiu assim em 13/09/2026 pela fonte `lms`).
 */
const ESTADO_PADRAO: StatusConfig = {
  label: "sem estado",
  icon: HelpCircle,
  text: "text-state-neutral",
  border: "border-state-neutral/60",
};

/** Config de um estado; nunca devolve `undefined`, mesmo com estado novo no banco. */
export function configDoEstado(status: string): StatusConfig {
  return STATUS[status] ?? ESTADO_PADRAO;
}

export interface StatusChipProps {
  /** Vem do banco como texto: aceitar `string` é o que impede a queda. */
  status: TaskStatus | string;
  className?: string;
}

export function StatusChip({
  status,
  className,
}: StatusChipProps): JSX.Element {
  const cfg = configDoEstado(status);
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
