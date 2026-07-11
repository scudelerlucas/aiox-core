// @ts-check
/**
 * Servidor HTTP do IdeaInbox — front-door de captura (Telegram/WhatsApp/
 * generico). Zero-dep: `node:http` puro. Nunca lanca por payload invalido;
 * pior caso responde 400/401 e segue vivo.
 */
import { createServer as createHttpServer } from "node:http";
import { Store } from "../../idea-forge/src/index.mjs";
import { verifySignature } from "./verify.mjs";
import { telegram, whatsapp, generic } from "./normalize.mjs";
import { handleIngest, log } from "./inbox.mjs";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB — payload de webhook nunca deveria chegar perto disso

/**
 * Le o corpo completo da requisicao como Buffer, com limite de tamanho.
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new Error("payload excede o limite maximo"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks)));
    req.on("error", rejectPromise);
  });
}

/** Parse JSON seguro: nunca lanca, retorna `null` em caso de body invalido/vazio. */
function safeJsonParse(buf) {
  if (!buf || buf.length === 0) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {Record<string, unknown>} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

/**
 * Cria o servidor HTTP do IdeaInbox.
 * @param {Object} opts
 * @param {string} opts.dir base dir para o store idea-forge + fila de fallback
 * @returns {import("node:http").Server}
 */
export function createServer({ dir }) {
  const store = new Store(dir);

  return createHttpServer((req, res) => {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", "http://localhost");
    const path = url.pathname;

    const finish = (status, body, extra = "") => {
      sendJson(res, status, body);
      const runId = typeof body?.runId === "string" ? body.runId : "-";
      log(`${method} ${path} -> ${status} runId=${runId}${extra}`);
    };

    (async () => {
      try {
        if (method === "GET" && path === "/health") {
          finish(200, { ok: true });
          return;
        }

        if (method === "POST" && path === "/webhook/telegram") {
          const raw = await readBody(req);
          const ok = verifySignature("telegram", req, raw);
          if (!ok) return finish(401, { error: "assinatura invalida" }, " channel=telegram");
          const json = safeJsonParse(raw);
          if (json === null) return finish(400, { error: "JSON invalido" }, " channel=telegram");
          const normalized = telegram(json);
          const result = await handleIngest({ channel: "telegram", payload: json, store, dir });
          return finish(202, result, ` channel=telegram source=${normalized.source}`);
        }

        if (method === "POST" && path === "/webhook/whatsapp") {
          const raw = await readBody(req);
          const ok = verifySignature("whatsapp", req, raw);
          if (!ok) return finish(401, { error: "assinatura invalida" }, " channel=whatsapp");
          const json = safeJsonParse(raw);
          if (json === null) return finish(400, { error: "JSON invalido" }, " channel=whatsapp");
          const normalized = whatsapp(json);
          const result = await handleIngest({ channel: "whatsapp", payload: json, store, dir });
          return finish(202, result, ` channel=whatsapp source=${normalized.source}`);
        }

        if (method === "POST" && path === "/ingest") {
          const raw = await readBody(req);
          const json = safeJsonParse(raw);
          if (json === null) return finish(400, { error: "JSON invalido" }, " channel=generic");
          const normalized = generic(json);
          const result = await handleIngest({ channel: normalized.source || "generic", payload: json, store, dir });
          return finish(202, result, " channel=generic");
        }

        finish(404, { error: "rota nao encontrada" });
      } catch (err) {
        // Ultima linha de defesa: qualquer erro inesperado vira 400/500, nunca derruba o processo.
        const message = err instanceof Error ? err.message : String(err);
        log(`erro nao tratado em ${method} ${path}: ${message}`);
        if (!res.headersSent) sendJson(res, 500, { error: "erro interno" });
      }
    })();
  });
}

export default { createServer };
