/**
 * OS-LIFEBOARD · E5 — GET /api/sources  (camada E/C)
 *
 * [AUTO-DECISION] O dashboard precisa das fontes + estado de staleness para o
 * `SourceFilter` (contadores) e o `StaleSourceFlag` (§5/§6). Em vez de expor
 * `sync_log` cru ao cliente, este endpoint deriva um DTO seguro
 * (`SourceStatus[]`) server-side, reusando os MESMOS repositórios fixture de E4
 * (`FixtureSourcesRepository` + `FixtureTasksRepository`). Razão: mantém a
 * fronteira "UI fala só com /api/*" (arch §11) e a troca fixture→Supabase segue
 * mecânica. Alternativa rejeitada: hidratar tudo por props do server component
 * sem endpoint → escolhi o endpoint para o filtro poder revalidar contadores de
 * forma isolada (paridade com /api/today).
 *
 * Contrato: `{ sources: SourceStatus[] }`. Sem `sync_log` cru, sem credencial.
 * Estilo Web `Request`/`Response` (mesmo padrão de /api/today, sem `next/server`).
 */

import {
  FixtureSourcesRepository,
  type SourcesRepository,
} from "@/lib/repositories/sources.fixture";
import {
  FixtureTasksRepository,
  type TasksRepository,
} from "@/lib/repositories/tasks.fixture";
import { computeSourceStatuses } from "@/lib/source-status";

interface ApiError {
  error: {
    code: string;
    message: string;
    timestamp: string;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  const payload: ApiError = {
    error: { code, message, timestamp: new Date().toISOString() },
  };
  return jsonResponse(payload, status);
}

// Fixtures nesta rodada; troca mecânica pelos repos Supabase reais (arch §5.2).
const sourcesRepo: SourcesRepository = new FixtureSourcesRepository();
const tasksRepo: TasksRepository = new FixtureTasksRepository();

export async function GET(): Promise<Response> {
  try {
    const [sources, syncLogs, tasks] = await Promise.all([
      sourcesRepo.listAll(),
      sourcesRepo.listSyncLogs(),
      tasksRepo.listAll(),
    ]);
    const statuses = computeSourceStatuses(sources, syncLogs, tasks);
    return jsonResponse({ sources: statuses });
  } catch (error) {
    return errorResponse(
      "sources_failed",
      `Falha ao carregar fontes: ${
        error instanceof Error ? error.message : "desconhecido"
      }`,
      500,
    );
  }
}
