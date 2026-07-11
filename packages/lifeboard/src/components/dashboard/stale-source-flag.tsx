"use client";
import { CloudOff } from "lucide-react";

import { formatRelativeTime } from "@/lib/format-relative-time";
import type { SourceKind } from "@/types/canonical";

export interface StaleSourceFlagProps {
  sourceLabel: string;
  sourceKind: SourceKind;
  /** Source.lastSyncAt (ISO) — null = nunca sincronizada. */
  lastSyncAt: string | null;
  /** Último SyncLog.error da fonte (tooltip). */
  lastError?: string | null;
  /** 'error' = última sync falhou (sync_log.ok=false); 'warning' = OK porém antiga. */
  severity?: "warning" | "error";
  /** Tamanho: 'sm' inline no filtro, 'md' no header. */
  size?: "sm" | "md";
}

/**
 * OS-LIFEBOARD · E5 — Flag "fonte desatualizada" (spec §6, PRD §9/stress-4).
 * Informativo, nunca bloqueia. role=status + aria-live=polite (a11y §7).
 */
export function StaleSourceFlag({
  sourceLabel,
  lastSyncAt,
  lastError,
  severity = "warning",
  size = "md",
}: StaleSourceFlagProps): JSX.Element {
  const isError = severity === "error";
  const colorText = isError ? "text-state-error-fg" : "text-state-warning";
  const colorBorder = isError ? "border-state-error/50" : "border-state-warning/50";
  const iconSize = size === "sm" ? 12 : 14;
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";

  const tooltip = [
    lastSyncAt ? `Última sync: ${lastSyncAt}` : "Nunca sincronizada",
    lastError ? `Erro: ${lastError}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      role="status"
      aria-live="polite"
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full border ${colorBorder} bg-gold-700/25 px-2 py-0.5 ${textSize} font-medium ${colorText}`}
    >
      <CloudOff size={iconSize} aria-hidden="true" />
      <span>
        {sourceLabel} desatualizada — última sync {formatRelativeTime(lastSyncAt)}
      </span>
    </span>
  );
}
