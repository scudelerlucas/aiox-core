/**
 * OS-LIFEBOARD — Port do adapter de Gmail (architecture.md §5.2).
 * Busca `RawGmailThread[]` (read-only). Impl fixture (ativa) + mcp (PROD, PAUSADA).
 */

import type { SourceClient } from "@/adapters/types";
import type { RawGmailThread } from "@/types/raw";

export type GmailClient = SourceClient<RawGmailThread>;

/**
 * Convenção de "label de projeto": labels aninhadas sob `Projeto/` (padrão Gmail
 * de sub-label). Só threads com pelo menos uma label desse prefixo viram task.
 */
export const PROJECT_LABEL_PREFIX = "Projeto/";

/** Primeira label de projeto da thread (ou null se nenhuma). */
export function projectLabelOf(labels: string[]): string | null {
  return labels.find((l) => l.startsWith(PROJECT_LABEL_PREFIX)) ?? null;
}
