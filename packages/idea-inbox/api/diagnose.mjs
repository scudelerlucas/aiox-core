// @ts-check
/**
 * Endpoint de diagnostico (T3.2): roda o pipeline IdeaForge COMPLETO (ate
 * 'canonize' — simulacao E2E p99.9 + RETROFORJA-P + relatorio) e devolve o
 * RELATORIO.html grafico pronto (due-diligence: VC/aceleradora paga por
 * este score). Nota do roadmap: relatorio inline por request aqui; um link
 * duravel/persistente fica para o T1.3 (quando Supabase entrar).
 *
 * Gate de auth IDENTICO ao /ingest generico (Bearer INGEST_TOKEN,
 * fail-closed em producao) — reaproveita os guardas de api/_core.mjs
 * (corpo cru + teto de tamanho, prototype pollution, rate limit por IP).
 */
import { readRawBody, hasDangerousKeys, rateLimited, clientIp } from "./_core.mjs";
import { verifySignature } from "../src/verify.mjs";
import { runSyncFull } from "../src/pipeline-sync.mjs";
import { generateReportHtml } from "@aiox/idea-forge";

const DIAGNOSE_TIMEOUT_MS = 5_000;

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(obj));
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
}

/** Corre uma promise com teto de tempo — nunca deixa o request pendurado (F3/F7). */
function withTimeout(promise, ms) {
  return new Promise((resolveP, rejectP) => {
    const timer = setTimeout(() => rejectP(new Error("diagnose timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolveP(v);
      },
      (err) => {
        clearTimeout(timer);
        rejectP(err);
      }
    );
  });
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });

    if (rateLimited(clientIp(req))) return sendJson(res, 429, { error: "rate limit excedido" });

    const { raw, reconstructed, truncated } = await readRawBody(req);
    if (truncated) return sendJson(res, 413, { error: "payload muito grande" });

    // mesma politica do /ingest generico: Bearer INGEST_TOKEN, fail-closed em prod.
    if (!verifySignature("generic", req, raw, { reconstructed })) return sendJson(res, 401, { error: "nao autorizado" });

    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: "json invalido" });
    }
    if (hasDangerousKeys(payload)) return sendJson(res, 400, { error: "payload rejeitado" });

    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) return sendJson(res, 422, { error: "campo 'text' obrigatorio" });

    const { state } = await withTimeout(runSyncFull({ source: "diagnose", text }), DIAGNOSE_TIMEOUT_MS);
    const html = generateReportHtml(state);
    return sendHtml(res, 200, html);
  } catch (err) {
    // Nunca vaza a mensagem interna (F5); loga server-side com um id de correlacao.
    const errorId = Math.random().toString(36).slice(2, 10);
    // eslint-disable-next-line no-console
    console.error(`[idea-inbox:diagnose] errorId=${errorId}`, err instanceof Error ? err.stack : err);
    return sendJson(res, 500, { error: "falha interna", errorId });
  }
}
