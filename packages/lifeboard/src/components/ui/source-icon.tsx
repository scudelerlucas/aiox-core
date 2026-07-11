import {
  CalendarDays,
  FolderOpen,
  Mail,
  MessagesSquare,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

import type { SourceKind } from "@/types/canonical";

/**
 * OS-LIFEBOARD · E5 — Ícone da fonte (spec §1.5 / §8.6 `SourceIcon`).
 * Mapa 1:1 `SourceKind` → ícone lucide-react. Nenhum ícone inventado (Artigo IV).
 */
const ICON_BY_KIND: Record<SourceKind, LucideIcon> = {
  calendar: CalendarDays,
  gmail: Mail,
  drive: FolderOpen,
  notes: NotebookPen,
  claude_chat: MessagesSquare,
};

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
  const Icon = ICON_BY_KIND[kind];
  return (
    <Icon
      size={size}
      className={className ?? "text-bone-400"}
      aria-label={`fonte: ${label}`}
      role="img"
    />
  );
}
