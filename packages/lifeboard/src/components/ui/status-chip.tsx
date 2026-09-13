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
  /**
   * P4f (achado BAIXO #10 do crítico hostil ROUND 4): o chip nascia com
   * `text-xs` (12px) — a 0,85 de zoom isso dá 10,2px de TELA, abaixo do piso
   * de 11,4px da régua. Dentro do grafo quem manda no tamanho é
   * `tipografia-do-cartao.ts` (13px de base, compensado por zoom quando
   * preciso); fora do grafo o default de 12px continua valendo.
   */
  fontSizePx?: number;
}

export function StatusChip({ status, className, fontSizePx }: StatusChipProps): JSX.Element {
  const cfg = configDoEstado(status);
  const Icon = cfg.icon;
  return (
    // P4e (achado ALTO #2 + MÉDIO #6 do crítico hostil ROUND 4): o `truncate`
    // da rodada 3 era a cura errada do aperto — ele fazia o RÓTULO sumir
    // (largura medida: 0px em 2 dos 4 cartões do fixture) e com ele a única
    // informação que o chip carrega. A cura certa foi dar ao rodapé do cartão
    // uma SEGUNDA LINHA só para o chip (`task-node.tsx`), onde os 174px de
    // conteúdo sobram para qualquer um dos rótulos. Aqui, a consequência:
    // o rótulo NUNCA encolhe nem corta (`whitespace-nowrap`, sem `truncate`) —
    // quem cede espaço, quando faltar, é a folga na linha de cima.
    <span
      style={fontSizePx ? { fontSize: fontSizePx, lineHeight: 1.25 } : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.border} ${cfg.bg} ${cfg.text} ${className ?? ""}`}
    >
      <Icon size={13} aria-hidden="true" className="shrink-0" />
      <span>{cfg.label}</span>
    </span>
  );
}
