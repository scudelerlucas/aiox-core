/**
 * OS-LIFEBOARD · GET /api/health  (infra — PRD §12 Definition of Done)
 *
 * Health-check exigido pelo PRD §12: valida (1) que a camada de dados responde
 * e (2) o resultado do último `sync_log` por fonte. É a sonda que o Vercel /
 * uptime-check bate após um deploy e a base do rollback automático (kill-switch
 * nº 6: health-check falha 2× → rollback).
 *
 * [AUTO-DECISION] Nesta rodada os repositórios ainda são os fixture de E4/E5
 * (troca fixture→Supabase é mecânica, arch §5.2). Quando `LIFEBOARD_DATA_MODE`
 * virar `live`, este handler passa a refletir o estado real do Supabase sem
 * mudar o contrato. Não expõe credencial nem linha crua de `sync_log` — só o
 * DTO derivado (ok/desatualizada + timestamp).
 *
 * Contrato de resposta:
 *   200 { status: 'ok'|'degraded', checkedAt, data: { reachable, sources: [...] } }
 *   503 { status: 'down', checkedAt, error }
 * `degraded` (não `down`) quando a base responde mas ao menos uma fonte está
 * stale/failed — o dashboard segue de pé (PRD §9 degradação graciosa), então
 * não é motivo de rollback; só `down` (base inacessível) é.
 */

import {
  getSourcesRepository,
  getTasksRepository,
} from "@/lib/repositories/factory";
import { computeSourceStatuses } from "@/lib/source-status";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(): Promise<Response> {
  const checkedAt = new Date().toISOString();
  try {
    // Origem (fixture | Supabase live) decidida pelo factory via LIFEBOARD_DATA_MODE.
    const sourcesRepo = getSourcesRepository();
    const tasksRepo = getTasksRepository();
    const [sources, syncLogs, tasks] = await Promise.all([
      sourcesRepo.listAll(),
      sourcesRepo.listSyncLogs(),
      tasksRepo.listAll(),
    ]);
    const statuses = computeSourceStatuses(sources, syncLogs, tasks);

    // Uma fonte com sync falho ('error') ou antigo ('warning') degrada, mas não
    // derruba (severity != null). Só base inacessível é 'down'.
    const anyUnhealthy = statuses.some((s) => s.severity !== null);
    const status = anyUnhealthy ? "degraded" : "ok";

    return jsonResponse({
      status,
      checkedAt,
      data: {
        reachable: true,
        sources: statuses.map((s) => ({
          kind: s.kind,
          label: s.label,
          severity: s.severity,
          lastSyncAt: s.lastSyncAt,
        })),
      },
    });
  } catch (error) {
    // Base inacessível → 'down' (é o que dispara o rollback, kill-switch nº 6).
    return jsonResponse(
      {
        status: "down",
        checkedAt,
        error: error instanceof Error ? error.message : "unknown",
      },
      503,
    );
  }
}
