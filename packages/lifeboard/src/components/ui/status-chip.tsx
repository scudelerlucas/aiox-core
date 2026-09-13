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
 * OS-LIFEBOARD — Chip de estado da tarefa.
 *
 * Cor + ÍCONE + TEXTO sempre juntos (daltônico-safe: cor nunca é o único
 * sinal). v2 (13/09/2026): os quatro estados ganharam matizes próprios e
 * fundo tênue — na v1 eram quase o mesmo cinza-azulado e não se distinguiam
 * de relance. Todos verificados ≥ 4,5:1 por `scripts/checar-contraste.mjs`.
 */
interface StatusConfig {
  label: string;
  icon: LucideIcon;
  /** classes utilitárias (texto/borda/fundo) do token de estado. */
  text: string;
  border: string;
  bg: string;
}

const STATUS: Record<string, StatusConfig> = {
  open: {
    label: "aberta",
    icon: Circle,
    text: "text-state-open",
    border: "border-state-open/45",
    bg: "bg-state-open/10",
  },
  in_progress: {
    label: "em progresso",
    icon: Loader,
    text: "text-state-progress",
    border: "border-state-progress/50",
    bg: "bg-state-progress/12",
  },
  blocked: {
    label: "bloqueada",
    icon: Ban,
    text: "text-state-blocked",
    border: "border-state-blocked/50",
    bg: "bg-state-blocked/12",
  },
  done: {
    label: "concluída",
    icon: CheckCircle2,
    text: "text-state-done",
    border: "border-state-done/45",
    bg: "bg-state-done/10",
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
  border: "border-state-neutral/45",
  bg: "bg-state-neutral/10",
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

export function StatusChip({ status, className }: StatusChipProps): JSX.Element {
  const cfg = configDoEstado(status);
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.border} ${cfg.bg} ${cfg.text} ${className ?? ""}`}
    >
      <Icon size={13} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
