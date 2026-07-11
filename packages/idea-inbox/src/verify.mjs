// @ts-check
/**
 * Verificacao de assinatura de webhook por canal. Fallback deterministico
 * documentado: se o secret do canal NAO estiver configurado, a verificacao
 * e pulada (modo dev) — nunca bloqueia a captura por falta de config.
 *
 * Telegram : header `x-telegram-bot-api-secret-token` === TELEGRAM_WEBHOOK_SECRET
 * WhatsApp : header `x-hub-signature-256` === "sha256=" + HMAC-SHA256(body, WHATSAPP_APP_SECRET)
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Compara duas strings em tempo constante (tamanhos diferentes -> false, sem lancar). */
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

/**
 * @param {string} channel "telegram" | "whatsapp" | outro
 * @param {import("node:http").IncomingMessage} req
 * @param {Buffer} rawBody
 * @returns {boolean}
 */
export function verifySignature(channel, req, rawBody) {
  const headers = req?.headers || {};

  if (channel === "telegram") {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) return true; // fallback dev: secret nao configurado, pula verificacao
    const token = headers["x-telegram-bot-api-secret-token"];
    return safeEqual(token, secret);
  }

  if (channel === "whatsapp") {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return true; // fallback dev
    const signature = headers["x-hub-signature-256"];
    if (typeof signature !== "string" || !signature.startsWith("sha256=")) return false;
    const expected = "sha256=" + createHmac("sha256", secret).update(rawBody || Buffer.alloc(0)).digest("hex");
    return safeEqual(signature, expected);
  }

  // canais sem esquema de assinatura definido (ex: /ingest generico): sempre permitido.
  return true;
}

export default { verifySignature };
