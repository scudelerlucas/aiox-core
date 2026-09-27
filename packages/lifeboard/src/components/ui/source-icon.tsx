import {
  CalendarDays,
  CircleDot,
  FolderOpen,
  GitPullRequestArrow,
  GraduationCap,
  Mail,
  MessagesSquare,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

import type { SourceKind } from "@/types/canonical";

/**
 * OS-LIFEBOARD · E5 — Ícone da fonte (spec §1.5 / §8.6 `SourceIcon`).
 * Mapa `kind` → ícone lucide-react. Nenhum ícone inventado (Artigo IV).
 *
 * O mapa é indexado por STRING, não por `SourceKind`, de propósito: o tipo é uma
 * promessa que o banco não cumpre. A tabela `public.sources` tem, desde 12/08/2026,
 * uma fonte `kind = "lms"` (Cativa) que não está na união — e um `kind` fora do mapa
 * fazia `<Icon/>` renderizar `undefined`, derrubando a home inteira com
 * "Element type is invalid… got: undefined" (HTTP 500, medido em produção em
 * 13/09/2026 e reproduzido localmente). Fonte desconhecida agora vira ícone neutro.
 */
const ICONE_PADRAO: LucideIcon = CircleDot;

const ICON_BY_KIND: Record<string, LucideIcon> = {
  calendar: CalendarDays,
  gmail: Mail,
  drive: FolderOpen,
  notes: NotebookPen,
  claude_chat: MessagesSquare,
  lms: GraduationCap,
  github: GitPullRequestArrow,
};

/** Ícone de uma fonte; nunca devolve `undefined`, mesmo com `kind` novo no banco. */
export function iconeDaFonte(kind: string): LucideIcon {
  return ICON_BY_KIND[kind] ?? ICONE_PADRAO;
}

export interface SourceIconProps {
  kind: SourceKind;
  label: string;
  size?: number;
  className?: string;
}

export function SourceIcon({
  kind,
  label,
  size = 16,
  className,
}: SourceIconProps): JSX.Element {
  const Icon = iconeDaFonte(kind);
  return (
    <Icon
      size={size}
      className={className ?? "text-bone-400"}
      aria-label={`fonte: ${label}`}
      role="img"
    />
  );
}
