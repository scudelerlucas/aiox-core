// @ts-check
/**
 * Endpoint de status por run (T1.3): consulta a memoria permanente (Supabase)
 * e devolve um JSON compacto do resultado de uma ideia processada. Publico
 * por desenho — leitura, sem dado sensivel, sem escrita, sem auth (mesmo
 * espirito do /dashboard). GET-only.
 */
import { fetchIdea, pickRunId } from "../src/read-remote.mjs";

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(obj));
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "method not allowed" });

    const { searchParams } = new URL(req.url || "", "http://x");
    const runId = pickRunId(searchParams);
    if (!runId) return sendJson(res, 400, { error: "run id ausente" });

    const idea = await fetchIdea(runId);
    if (!idea) {
      return sendJson(res, 404, { error: "run nao encontrado (ou memoria desligada)", runId });
    }

    return sendJson(res, 200, {
      runId,
      score: idea.score ?? null,
      project: idea.project ?? null,
      branch: idea.branch ?? null,
      blocked: idea.blocked ?? null,
      asymmetry_score: idea.asymmetry_score ?? null,
      synergy_score: idea.synergy_score ?? null,
      cluster_reach: idea.cluster_reach ?? null,
      matched_seeds_count: Array.isArray(idea.matched_seeds) ? idea.matched_seeds.length : 0,
      created_at: idea.created_at ?? null,
    });
  } catch (err) {
    // Nunca vaza a mensagem interna (F5); loga server-side com um id de correlacao.
    const errorId = Math.random().toString(36).slice(2, 10);
    // eslint-disable-next-line no-console
    console.error(`[idea-inbox:runs] errorId=${errorId}`, err instanceof Error ? err.stack : err);
    return sendJson(res, 500, { error: "falha interna", errorId });
  }
}
