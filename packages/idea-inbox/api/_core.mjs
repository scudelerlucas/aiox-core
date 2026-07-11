// @ts-check
/**
 * Nucleo compartilhado dos handlers serverless (Vercel Node functions).
 * Endurecido pos-auditoria de seguranca (F1-F8):
 *  - assinatura fail-closed em producao (verify.mjs)
 *  - rate limit por IP (F3), request cost limitado (pipeline ate 'dispatch', F3/F7)
 *  - corpo cru fiel p/ HMAC + rejeicao de body grande (F4)
 *  - guarda de prototype pollution (F8)
 *  - erro 500 sem vazar mensagem interna (F5)
 */
import { resolve } from "../src/normalize.mjs";
import { verifySignature } from "../src/verify.mjs";
import { runSync } from "../src/pipeline-sync.mjs";

const MAX_BODY = 256 * 1024; // 256KB — teto anti-DoS
const RATE_LIMIT = Number(process.env.IDEAINBOX_RATE_LIMIT || 30); // req/janela/IP
const RATE_WINDOW_MS = 60_000;

/** Rate limiter fixed-window em memoria (best-effort; por instancia no serverless). */
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.start >= RATE_WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return false;
  }
  b.count++;
  return b.count > RATE_LIMIT;
}
function clientIp(req) {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Le o corpo cru com teto de tamanho, sinalizando se foi reconstruido/truncado.
 * @returns {Promise<{raw:string, reconstructed:boolean, truncated:boolean}>}
 */
export async function readRawBody(req) {
  if (typeof req.body === "string") return { raw: req.body, reconstructed: false, truncated: req.body.length > MAX_BODY };
  if (req.body && Buffer.isBuffer(req.body)) {
    const s = req.body.toString("utf8");
    return { raw: s, reconstructed: false, truncated: s.length > MAX_BODY };
  }
  if (req.body && typeof req.body === "object") {
    // corpo ja parseado pela plataforma: bytes originais perdidos -> reconstruido.
    return { raw: JSON.stringify(req.body), reconstructed: true, truncated: false };
  }
  return await new Promise((resolveP) => {
    let data = "";
    let truncated = false;
    req.on("data", (c) => {
      if (truncated) return;
      data += c;
      if (data.length > MAX_BODY) {
        truncated = true;
      }
    });
    req.on("end", () => resolveP({ raw: data, reconstructed: false, truncated }));
    req.on("error", () => resolveP({ raw: data, reconstructed: false, truncated }));
  });
}

/** Rejeita chaves perigosas antes de qualquer manuseio do objeto (F8). */
function hasPollutionKeys(raw) {
  return /"(?:__proto__|constructor|prototype)"\s*:/.test(raw);
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(obj));
  // eslint-disable-next-line no-console
  console.log(`[idea-inbox:serverless] ${new Date().toISOString()} -> ${status} runId=${obj.runId || "-"}`);
}

/**
 * Handler generico para um canal.
 * @param {"telegram"|"whatsapp"|"generic"} channel
 */
export function makeHandler(channel) {
  return async function handler(req, res) {
    try {
      if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

      if (rateLimited(clientIp(req))) return send(res, 429, { error: "rate limit excedido" });

      const { raw, reconstructed, truncated } = await readRawBody(req);
      if (truncated) return send(res, 413, { error: "payload muito grande" });
      if (hasPollutionKeys(raw)) return send(res, 400, { error: "payload rejeitado" });

      // 1) verificacao de assinatura (fail-closed em prod; HMAC exige corpo fiel)
      if (!verifySignature(channel, req, raw, { reconstructed })) return send(res, 401, { error: "nao autorizado" });

      // 2) parse seguro
      let payload;
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        return send(res, 400, { error: "json invalido" });
      }

      // 3) normaliza
      const norm = resolve(channel)(payload);
      const text = (norm.text || "").trim();
      if (!text && !norm.audioRef) return send(res, 422, { accepted: false, reason: "sem texto nem audio" });

      // 4) roda o pipeline BOUNDED (ingest..dispatch) — captura + validacao rapida.
      //    A simulacao E2E pesada (99.9%) + RETROFORJA rodam no laco assincrono
      //    (idea-forge realize / CI), nao no endpoint publico. (F3/F7)
      const result = await runSync({ source: norm.source || channel, text, audioRef: norm.audioRef });
      return send(res, 202, { accepted: true, ...result });
    } catch (err) {
      // Nunca vaza a mensagem interna (F5); loga server-side com um id de correlacao.
      const errorId = Math.random().toString(36).slice(2, 10);
      // eslint-disable-next-line no-console
      console.error(`[idea-inbox:serverless] errorId=${errorId}`, err instanceof Error ? err.stack : err);
      return send(res, 500, { error: "falha interna", errorId });
    }
  };
}

export function healthHandler(_req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, service: "idea-inbox", ts: new Date().toISOString() }));
}

export default { makeHandler, healthHandler, readRawBody };
