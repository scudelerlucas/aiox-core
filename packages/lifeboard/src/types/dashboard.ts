/**
 * OS-LIFEBOARD · E5 — DTOs de VIEW do dashboard (camada E).
 *
 * ADITIVO: NÃO redefine o modelo canônico (`@/types/canonical`) — só compõe
 * formas de transporte para a UI (spec §8). Cliente jamais importa tipos
 * server-only (`core/prioritize/today.ts`); replicamos a forma mínima aqui,
 * exatamente como o contrato de `TodayListItem` da spec §8.3.
 */

import type { SourceKind, Task } from "@/types/canonical";

/** Severidade de staleness de uma fonte (spec §6). `null` = saudável. */
export type StaleSeverity = "warning" | "error";

/**
 * Estado consolidado de uma fonte para o dashboard (filtro + flags).
 * Produzido por `GET /api/sources` a partir de `sources` + `sync_log` + `tasks`.
 */
export interface SourceStatus {
  kind: SourceKind;
  label: string;
  /** Source.lastSyncAt (ISO) — null = nunca sincronizada. */
  lastSyncAt: string | null;
  /** Último SyncLog.error da fonte (tooltip do flag). */
  lastError: string | null;
  /** 'error' = última sync falhou; 'warning' = OK porém antiga; null = saudável. */
  severity: StaleSeverity | null;
  /** Nº de tarefas dessa fonte (badge do filtro). */
  taskCount: number;
}

/** Item da lista "hoje" — espelha `{ task, reason }` de `GET /api/today`. */
export interface TodayItemDTO {
  task: Task;
  reason: string;
}

/** Resposta literal de `GET /api/today` (arch §7 + campo aditivo `excludedCycles`). */
export interface TodayResponse {
  items: TodayItemDTO[];
  /** IDs de tarefas fora da fila por ciclo de dependência (degradação graciosa). */
  excludedCycles: string[];
}

/** Resposta de `GET /api/sources`. */
export interface SourcesResponse {
  sources: SourceStatus[];
}
