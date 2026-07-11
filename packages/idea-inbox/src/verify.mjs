// @ts-check
/**
 * Verificacao de assinatura de webhook por canal. Retorna boolean (aceitar?).
 *
 * Politica de seguranca (endurecida pos-auditoria):
 *  - Telegram : header `x-telegram-bot-api-secret-token` === TELEGRAM_WEBHOOK_SECRET
 *  - WhatsApp : `x-hub-signature-256` === "sha256=" + HMAC-SHA256(rawBody, WHATSAPP_APP_SECRET)
 *  - Generico (/ingest): `Authorization: Bearer <INGEST_TOKEN>`
 *
 * FAIL-CLOSED EM PRODUCAO (F1/F2): se o secret/token do canal nao estiver
 * configurado, aceita APENAS em dev. Em producao (VERCEL=1 ou NODE_ENV=production)
 * rejeita, a menos que IDEAINBOX_ALLOW_UNSIGNED=1 seja explicitamente setado.
 *
 * HMAC exige o corpo CRU fiel (F4): se o corpo so existe reconstruido (re-stringify
 * de um objeto ja parseado), a verificacao do WhatsApp falha em vez de gerar um
 * HMAC incorreto silenciosamente.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Compara em tempo constante (tamanhos diferentes -> false, sem lancar). */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function isProd() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}
function allowUnsigned() {
  return process.env.IDEAINBOX_ALLOW_UNSIGNED === "1";
}
/** Decisao quando nao ha secret configurado: dev aceita, producao rejeita. */
function unsignedOk() {
  return !(isProd() && !allowUnsigned());
}

/**
 * @param {string} channel "telegram" | "whatsapp" | outro (generico)
 * @param {import("node:http").IncomingMessage} req
 * @param {Buffer|string} rawBody corpo CRU (bytes originais)
 * @param {{reconstructed?:boolean}} [opts] reconstructed=true se rawBody veio de re-stringify
 * @returns {boolean}
 */
export function verifySignature(channel, req, rawBody, opts = {}) {
  const headers = req?.headers || {};

  if (channel === "telegram") {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) return unsignedOk();
    return safeEqual(headers["x-telegram-bot-api-secret-token"], secret);
  }

  if (channel === "whatsapp") {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return unsignedOk();
    // HMAC precisa dos bytes originais; corpo reconstruido nao serve.
    if (opts.reconstructed) return false;
    const signature = headers["x-hub-signature-256"];
    if (typeof signature !== "string" || !signature.startsWith("sha256=")) return false;
    const expected = "sha256=" + createHmac("sha256", secret).update(rawBody ?? Buffer.alloc(0)).digest("hex");
    return safeEqual(signature, expected);
  }

  // canal generico (/ingest): exige bearer token se configurado; fail-closed em prod.
  const token = process.env.INGEST_TOKEN;
  if (!token) return unsignedOk();
  const auth = headers["authorization"];
  const provided = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return safeEqual(provided, token);
}

export default { verifySignature };
