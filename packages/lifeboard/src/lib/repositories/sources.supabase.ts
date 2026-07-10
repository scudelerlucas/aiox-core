/**
 * OS-LIFEBOARD — Repositório LIVE de sources + sync_log (Supabase, server-only).
 *
 * Implementa a MESMA `SourcesRepository` do fixture (arch §5.2), backed pela RPC
 * secret-gated `lifeboard_load`. Alimenta `computeSourceStatuses` (filtro + flags
 * de fonte desatualizada) igual ao fixture — só a origem dos dados muda.
 */

import "server-only";

import { loadLifeboardState } from "@/lib/supabase/live-client";
import type { SourcesRepository } from "@/lib/repositories/sources.fixture";
import type { Source, SyncLog } from "@/types/canonical";

export class SupabaseSourcesRepository implements SourcesRepository {
  async listAll(): Promise<Source[]> {
    const { sources } = await loadLifeboardState();
    return sources;
  }

  async listSyncLogs(): Promise<SyncLog[]> {
    const { syncLogs } = await loadLifeboardState();
    return syncLogs;
  }
}
