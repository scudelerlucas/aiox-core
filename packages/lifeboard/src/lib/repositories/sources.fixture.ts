/**
 * OS-LIFEBOARD · E5 — Repositório FIXTURE de sources + sync_log (in-memory).
 *
 * Espelha o padrão de `tasks.fixture.ts` (E4): fake read-only que serve o
 * dashboard e `GET /api/sources` sem tocar o Supabase real (Nota de execução
 * autônoma). A troca para produção é MECÂNICA — implementar `SourcesRepository`
 * com o server client Supabase e injetar no lugar deste fake.
 *
 * `sourceId = deterministicId("source", kind)` — MESMA convenção dos adapters
 * (os `adapters/<fonte>/normalize.ts` usam `deterministicId("source", KIND)`), então os
 * `Task.sourceId` da fixture de tasks casam com estas linhas de `sources`.
 *
 * Dataset de demonstração (spec §6 / PRD §9 stress-4): 5 fontes canônicas, com
 * DUAS desatualizadas para exercitar `StaleSourceFlag`:
 *   • drive       — última sync FALHOU (sync_log.ok=false) → severity 'error'
 *   • claude_chat — última sync OK porém ANTIGA               → severity 'warning'
 */

import { deterministicId } from "@/adapters/id";
import type { Source, SourceKind, SyncLog } from "@/types/canonical";

export interface SourcesRepository {
  listAll(): Promise<Source[]>;
  listSyncLogs(): Promise<SyncLog[]>;
}

/** sourceId estável por fonte — idêntico ao usado pelos adapters (camada R). */
export function sourceIdFor(kind: SourceKind): string {
  return deterministicId("source", kind);
}

const FIXTURE_SOURCES: readonly Source[] = [
  {
    id: sourceIdFor("calendar"),
    kind: "calendar",
    label: "Agenda Lucas",
    authMode: "api",
    lastSyncAt: "2026-07-09T06:00:00.000Z",
  },
  {
    id: sourceIdFor("gmail"),
    kind: "gmail",
    label: "Gmail Projetos",
    authMode: "api",
    lastSyncAt: "2026-07-09T05:30:00.000Z",
  },
  {
    id: sourceIdFor("drive"),
    kind: "drive",
    label: "Drive Projetos",
    authMode: "api",
    lastSyncAt: "2026-07-07T04:00:00.000Z", // sync mais recente FALHOU (ver sync_log)
  },
  {
    id: sourceIdFor("notes"),
    kind: "notes",
    label: "Notas iPhone",
    authMode: "manual",
    lastSyncAt: "2026-07-09T03:00:00.000Z",
  },
  {
    id: sourceIdFor("claude_chat"),
    kind: "claude_chat",
    label: "Chats Claude",
    authMode: "manual",
    lastSyncAt: "2026-07-05T10:00:00.000Z", // OK porém antiga → warning
  },
];

const FIXTURE_SYNC_LOGS: readonly SyncLog[] = [
  {
    id: "sync-cal-1",
    sourceId: sourceIdFor("calendar"),
    runAt: "2026-07-09T06:00:00.000Z",
    itemsIngested: 12,
    ok: true,
    error: null,
  },
  {
    id: "sync-gml-1",
    sourceId: sourceIdFor("gmail"),
    runAt: "2026-07-09T05:30:00.000Z",
    itemsIngested: 3,
    ok: true,
    error: null,
  },
  {
    id: "sync-drv-1",
    sourceId: sourceIdFor("drive"),
    runAt: "2026-07-09T06:05:00.000Z", // tentativa mais recente...
    itemsIngested: 0,
    ok: false, // ...FALHOU → StaleSourceFlag severity 'error'
    error: "Drive MCP timeout após 30s (conector indisponível)",
  },
  {
    id: "sync-not-1",
    sourceId: sourceIdFor("notes"),
    runAt: "2026-07-09T03:00:00.000Z",
    itemsIngested: 2,
    ok: true,
    error: null,
  },
  {
    id: "sync-cht-1",
    sourceId: sourceIdFor("claude_chat"),
    runAt: "2026-07-05T10:00:00.000Z",
    itemsIngested: 4,
    ok: true,
    error: null,
  },
];

export class FixtureSourcesRepository implements SourcesRepository {
  async listAll(): Promise<Source[]> {
    return FIXTURE_SOURCES.map((s) => ({ ...s }));
  }

  async listSyncLogs(): Promise<SyncLog[]> {
    return FIXTURE_SYNC_LOGS.map((s) => ({ ...s }));
  }
}
