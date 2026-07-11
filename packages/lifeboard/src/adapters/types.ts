/**
 * OS-LIFEBOARD — Ports & Adapters da ingestão (architecture.md §5.2, a decisão-chave).
 *
 * Duas camadas:
 *   1. `SourceClient<Raw>` — a PORT de I/O. Só busca dados crus (read-only). Duas
 *      implementações intercambiáveis por fonte: `client.fixture.ts` (ativa nesta
 *      rodada) e `client.mcp.ts` (PROD, PAUSADA). O flip é mecânico via `factory.ts`.
 *   2. `SourceAdapter<Raw>` — normalização PURA: `Raw[]` → `{ projects, tasks }`.
 *      Sem I/O, 100% testável, idêntica para fixture e live.
 */

import type { Project, SourceKind, Task } from "@/types/canonical";

export type DataMode = "fixture" | "live";

/** Port: busca dados crus de uma fonte. NÃO normaliza. Read-only, zero escrita. */
export interface SourceClient<Raw> {
  readonly kind: SourceKind;
  readonly mode: DataMode;
  fetchRaw(): Promise<Raw[]>;
}

/** Normalização pura: crua → canônica. Sem I/O, 100% testável. */
export interface SourceAdapter<Raw> {
  readonly kind: SourceKind;
  normalize(raw: Raw[]): { projects: Project[]; tasks: Task[] };
}
