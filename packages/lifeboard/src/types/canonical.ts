/**
 * OS-LIFEBOARD — Modelo canônico (camelCase) — architecture.md §5.1.
 *
 * É a coluna vertebral: adapters (camada R) ESCREVEM aqui; HIERARQ (camada O)
 * e o dashboard (camada E) LEEM só daqui. A fronteira crua com o Postgres
 * (snake_case) vive em `@/types/database`.
 *
 * NOTA DE COORDENAÇÃO (E2 ‖ E3): este arquivo é compartilhado. Ele espelha
 * literalmente architecture.md §5.1 — qualquer adapter (calendar/gmail/drive/
 * manual) importa daqui e NUNCA redefine estes tipos (coding standard §11).
 */

export type SourceKind = "calendar" | "gmail" | "drive" | "notes" | "claude_chat";

export type AuthMode = "api" | "manual";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";

export interface Source {
  id: string; // uuid
  kind: SourceKind;
  label: string;
  authMode: AuthMode;
  lastSyncAt: string | null; // ISO
}

export interface Project {
  id: string;
  sourceId: string;
  externalRef: string; // id lógico na fonte (idempotência do sync)
  title: string;
  status: string;
  updatedAt: string;
}

/** priority_hierarq jsonb {s1,s2,s3} — insumo do motor HIERARQ (camada O). */
export interface HierarqScore {
  s1: number;
  s2: number;
  s3: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priorityHierarq: HierarqScore;
  predecessorIds: string[]; // uuid[]
  successorIds: string[]; // uuid[]
  sourceId: string;
  externalRef: string;
  updatedAt: string;
}

export interface SyncLog {
  id: string;
  sourceId: string;
  runAt: string;
  itemsIngested: number;
  ok: boolean;
  error: string | null;
}

/** Score default neutro (1×1×1) para itens sem priorização declarada ainda. */
export const DEFAULT_HIERARQ: HierarqScore = { s1: 1, s2: 1, s3: 1 };
