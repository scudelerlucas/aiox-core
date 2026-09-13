import { Ban, CheckCircle2, Clock, Loader, WifiOff, XCircle, type LucideIcon } from "lucide-react";

import type { EstadoFila } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — chip de estado do item da fila. Mesmo padrão de
 * `status-chip.tsx` (cor + ícone + texto — daltônico-safe), reusando os
 * MESMOS tokens de estado já verificados (nenhum par novo de contraste).
 */
interface Config {
  label: string;
  icon: LucideIcon;
  text: string;
  border: string;
  bg: string;
}

const ESTADOS: Record<EstadoFila, Config> = {
  na_fila: {
    label: "na fila",
    icon: Clock,
    text: "text-state-open",
    border: "border-state-open/45",
    bg: "bg-state-open/10",
  },
  pega: {
    label: "em execução",
    icon: Loader,
    text: "text-state-progress",
    border: "border-state-progress/50",
    bg: "bg-state-progress/12",
  },
  concluida: {
    label: "concluída",
    icon: CheckCircle2,
    text: "text-state-done",
    border: "border-state-done/45",
    bg: "bg-state-done/10",
  },
  falhou: {
    label: "falhou",
    icon: XCircle,
    text: "text-state-blocked",
    border: "border-state-blocked/50",
    bg: "bg-state-blocked/12",
  },
  cancelada: {
    label: "cancelada",
    icon: Ban,
    text: "text-state-neutral",
    border: "border-state-neutral/45",
    bg: "bg-state-neutral/10",
  },
};

/**
 * D7 (rodada 3): `semSinal` é um estado VISÍVEL, não um detalhe de banco. Um
 * item `pega` cujo worker não dá sinal há mais de 45 min deixa de ser "em
 * execução" e passa a ser "sem sinal" — a cor muda para a de bloqueio e o
 * ícone para o de desconexão (cor nunca é o único sinal; o texto também muda).
 */
const SEM_SINAL: Config = {
  label: "sem sinal",
  icon: WifiOff,
  text: "text-state-blocked",
  border: "border-state-blocked/50",
  bg: "bg-state-blocked/12",
};

export function EstadoFilaChip({
  estado,
  semSinal = false,
}: {
  estado: EstadoFila;
  semSinal?: boolean;
}): JSX.Element {
  const cfg = estado === "pega" && semSinal ? SEM_SINAL : ESTADOS[estado];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.border} ${cfg.bg} ${cfg.text}`}
    >
      <Icon size={13} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
