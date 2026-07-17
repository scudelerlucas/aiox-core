// @ts-check
/**
 * Idempotencia/dedup (T4.2): Telegram/WhatsApp reenviam o MESMO webhook em
 * timeout (retry de entrega) — sem isso, cada retry roda o pipeline de novo
 * e dispara persist/CI duplicados. Aqui: uma chave estavel por delivery
 * (id nativo do canal, com fallback em hash do conteudo) + um runId
 * deterministico derivado dela (mesma chave -> mesmo runId, sempre) + uma
 * janela "ja vi isso" em memoria (mesmo padrao do bucket de rate-limit em
 * api/_core.mjs). Zero-dep (node:crypto), nunca lanca.
 */
import { createHash } from "node:crypto";

/** TTL da janela de dedup — reenvios costumam ocorrer em segundos/minutos. */
const SEEN_TTL_MS = 5 * 60_000;
/** Teto anti-crescimento de memoria (mesmo valor do BUCKET_CAP do rate-limit). */
const SEEN_CAP = 10_000;

/** @type {Map<string, number>} chave -> timestamp (ms) da primeira vez vista */
const seen = new Map();

/**
 * Chave estavel de um delivery de webhook. Prioriza o id nativo do canal
 * (nao muda entre retries do MESMO evento); sem id nativo, cai num hash do
 * conteudo normalizado (texto ou referencia de audio). Nunca lanca — payload
 * malformado/parcial sempre produz uma chave nao-vazia.
 * @param {string} channel
 * @param {unknown} payload
 * @param {{text?:string|null, audioRef?:string|null}} [normalized]
 * @returns {string}
 */
export function dedupKey(channel, payload, normalized) {
  try {
    if (channel === "telegram") {
      const p = /** @type {any} */ (payload) || {};
      const msg = p.message || p.edited_message || p;
      const msgId = msg?.message_id;
      const chatId = msg?.chat?.id;
      if ((typeof msgId === "number" || typeof msgId === "string") && (typeof chatId === "number" || typeof chatId === "string")) {
        return `telegram:${chatId}:${msgId}`;
      }
    } else if (channel === "whatsapp") {
      const p = /** @type {any} */ (payload) || {};
      const entry = p?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const id = entry?.id;
      if (typeof id === "string" && id) return `whatsapp:${id}`;
    }
  } catch {
    /* cai no fallback abaixo — hash sempre funciona */
  }
  const text = String((normalized && (normalized.text || normalized.audioRef)) || "");
  const hash = createHash("sha256").update(`${channel}|${text}`).digest("hex");
  return `${channel}:hash:${hash}`;
}

/**
 * runId deterministico a partir de uma dedupKey — a MESMA chave sempre
 * produz o MESMO runId (para inbox e downstream/CI usarem um id so por
 * delivery, mesmo em retries). Nunca lanca.
 * @param {string} key
 * @returns {string}
 */
export function stableRunId(key) {
  const hash = createHash("sha256").update(String(key ?? "")).digest("hex");
  return `ib-${hash.slice(0, 16)}`;
}

/**
 * `true` se `key` ja foi vista dentro da janela TTL (retry de webhook) —
 * caso contrario, registra `key` como vista agora e devolve `false`.
 * Mapa em memoria com teto de tamanho (best-effort, por instancia no
 * serverless — mesmo padrao dos buckets de rate-limit). Nunca lanca.
 * @param {string} key
 * @returns {boolean}
 */
export function seenRecently(key) {
  try {
    const now = Date.now();
    const k = String(key ?? "");
    const ts = seen.get(k);
    if (ts !== undefined && now - ts < SEEN_TTL_MS) return true;
    if (seen.size >= SEEN_CAP) pruneSeen(now);
    seen.set(k, now);
    return false;
  } catch {
    return false;
  }
}

/** Remove entradas expiradas; se ainda cheio (flood ativo), zera para nao vazar memoria. */
function pruneSeen(now) {
  for (const [k, ts] of seen) if (now - ts >= SEEN_TTL_MS) seen.delete(k);
  if (seen.size >= SEEN_CAP) seen.clear();
}

export default { dedupKey, stableRunId, seenRecently };
