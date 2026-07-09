/**
 * OS-LIFEBOARD · E5 — Derivação PURA do estado de staleness das fontes (spec §6).
 *
 * Regra (spec §6): a partir de `Source.lastSyncAt` + o último `SyncLog` da fonte:
 *   • severity 'error'   ⇐ a última sync FALHOU (sync_log.ok === false), OU
 *   • severity 'warning' ⇐ última sync OK porém ANTIGA (> 26h), ou nunca sincronizada,
 *   • severity null      ⇐ saudável.
 *
 * `referenceNow` é robusto a relógio: usa o MAIOR entre `now` e a sync OK mais
 * recente do dataset. Assim uma fonte muito mais velha que a mais fresca é sempre
 * 'warning', mesmo que o relógio do ambiente esteja fora de fase (determinístico
 * para o screenshot). Pura → sem I/O, testável.
 */

import type { Source, SyncLog, Task } from "@/types/canonical";
import type { SourceStatus, StaleSeverity } from "@/types/dashboard";

/** PRD promete sync ≤1×/dia; passou de ~1 dia (26h de folga) = desatualizado. */
const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000;

function latestLog(logs: SyncLog[], sourceId: string): SyncLog | null {
  let latest: SyncLog | null = null;
  for (const log of logs) {
    if (log.sourceId !== sourceId) continue;
    if (!latest || Date.parse(log.runAt) > Date.parse(latest.runAt)) latest = log;
  }
  return latest;
}

export function computeSourceStatuses(
  sources: Source[],
  syncLogs: SyncLog[],
  tasks: Task[],
  now: number = Date.now(),
): SourceStatus[] {
  // referenceNow robusto a relógio: máximo entre `now` e a sync OK mais recente.
  let freshestOk = 0;
  for (const log of syncLogs) {
    if (log.ok) freshestOk = Math.max(freshestOk, Date.parse(log.runAt));
  }
  const referenceNow = Math.max(now, freshestOk);

  const countBySource = new Map<string, number>();
  for (const t of tasks) {
    countBySource.set(t.sourceId, (countBySource.get(t.sourceId) ?? 0) + 1);
  }

  return sources.map((source) => {
    const log = latestLog(syncLogs, source.id);
    let severity: StaleSeverity | null = null;

    if (log && !log.ok) {
      severity = "error";
    } else if (!source.lastSyncAt) {
      severity = "warning";
    } else {
      const age = referenceNow - Date.parse(source.lastSyncAt);
      if (age > STALE_THRESHOLD_MS) severity = "warning";
    }

    return {
      kind: source.kind,
      label: source.label,
      lastSyncAt: source.lastSyncAt,
      lastError: log?.error ?? null,
      severity,
      taskCount: countBySource.get(source.id) ?? 0,
    };
  });
}
