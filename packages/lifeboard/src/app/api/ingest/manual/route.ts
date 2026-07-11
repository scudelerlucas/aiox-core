/**
 * OS-LIFEBOARD · E3 — POST /api/ingest/manual
 *
 * Recebe texto colado (Notas iPhone / export de chat Claude) e devolve o que
 * seria gravado no modelo canônico (`{ projects, tasks }`), passando por
 * parser estrutural (zero token) + normalização com GUARDA INVIOLÁVEL (PRD §10).
 *
 * Handler server-side (camada R). Usa os tipos Web padrão (`Request`/`Response`),
 * compatíveis com Next.js App Router Route Handlers sem acoplar a `next/server`.
 *
 * NOTA: a persistência real (upsert append-only em Supabase) é responsabilidade
 * do repository (`lib/repositories/tasks.ts`), ainda inexistente nesta rodada —
 * ver `mergeAppendOnly` em `normalize.ts` para a semântica append-only garantida.
 */

import {
  normalizeManual,
  type ManualSourceKind,
} from "@/adapters/manual/normalize";

interface IngestManualBody {
  text: string;
  sourceKind?: ManualSourceKind;
  sourceId?: string;
}

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

export async function POST(request: Request): Promise<Response> {
  let body: IngestManualBody;
  try {
    body = (await request.json()) as IngestManualBody;
  } catch {
    return errorResponse("invalid_json", "Corpo da requisição não é JSON válido.", 400);
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return errorResponse(
      "missing_text",
      "Campo obrigatório `text` (string não-vazia) ausente.",
      400,
    );
  }

  const sourceKind: ManualSourceKind = body.sourceKind ?? "notes";
  const result = normalizeManual(body.text, {
    sourceKind,
    sourceId: body.sourceId,
  });

  return jsonResponse({
    ingested: result.tasks.length,
    projects: result.projects,
    tasks: result.tasks,
    strategy: result.strategy,
    rescuedByGuard: result.rescuedByGuard,
  });
}
