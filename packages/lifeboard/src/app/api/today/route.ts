/**
 * OS-LIFEBOARD · E4 — GET /api/today  (camada O)
 *
 * Roda o motor HIERARQ (server-only) sobre as tasks e devolve a lista "hoje"
 * ordenada + justificativa por item, OMITINDO tarefas com predecessor aberto e
 * EXCLUINDO ciclos (flag de erro logada aqui, no shell — Pure Core/Impure Shell,
 * architecture.md §2.5).
 *
 * Import do motor pelo BARRIL server-only (`@/core/prioritize/server-only`):
 * garante em tempo de build que a camada O nunca vaza pro client (kill-switch nº 3).
 *
 * Fonte de dados: `FixtureTasksRepository` in-memory. O repositório Supabase real
 * é para depois (Nota de execução autônoma). Contrato de resposta (arch §7):
 * `{ items: [{ task, reason }] }` (+ `excludedCycles` aditivo p/ degradação graciosa).
 *
 * Usa os tipos Web padrão (`Request`/`Response`), compatíveis com Next.js App
 * Router Route Handlers sem acoplar a `next/server` (mesmo estilo do handler E3).
 */

import { buildTodayList } from "@/core/prioritize/server-only";
import { getTasksRepository } from "@/lib/repositories/factory";

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

export async function GET(): Promise<Response> {
  try {
    // Origem (fixture | Supabase live) decidida pelo factory via LIFEBOARD_DATA_MODE.
    const tasks = await getTasksRepository().listAll();
    const { items, excludedCycles } = buildTodayList(tasks);

    if (excludedCycles.length > 0) {
      // Degradação graciosa (PRD §9): loga a flag de erro, serviço segue de pé.
      console.warn(
        `[today] ${excludedCycles.length} tarefa(s) excluída(s) por ciclo de ` +
          `dependência: ${excludedCycles.map((t) => t.id).join(", ")}`,
      );
    }

    return jsonResponse({
      items: items.map(({ task, reason }) => ({ task, reason })),
      excludedCycles: excludedCycles.map((t) => t.id),
    });
  } catch (error) {
    return errorResponse(
      "today_failed",
      `Falha ao montar a lista "hoje": ${
        error instanceof Error ? error.message : "desconhecido"
      }`,
      500,
    );
  }
}
