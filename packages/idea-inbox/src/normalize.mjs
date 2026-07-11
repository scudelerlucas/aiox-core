// @ts-check
/**
 * Normalizadores por canal — webhook cru (Telegram/WhatsApp/generico) ->
 * `{ source, text, audioRef, meta }`. Espelha o contrato dos adaptadores do
 * idea-forge (src/ingest/adapters.mjs), mas roda na fronteira HTTP, antes do
 * pipeline. Nunca lanca: payload malformado vira campos vazios/null.
 */

/** Telegram Bot API update (voice message, audio ou texto/caption). */
export function telegram(payload) {
  const p = payload || {};
  const msg = p.message || p.edited_message || p;
  const text = msg?.text ?? msg?.caption ?? "";
  const audioRef = msg?.voice?.file_id ?? msg?.audio?.file_id ?? null;
  return {
    source: "telegram",
    text: typeof text === "string" ? text : "",
    audioRef: audioRef ?? null,
    meta: {
      chatId: msg?.chat?.id ?? null,
      from: msg?.from?.username ?? msg?.from?.id ?? null,
      messageId: msg?.message_id ?? null,
    },
  };
}

/** WhatsApp Cloud API webhook (audio ou texto). */
export function whatsapp(payload) {
  const p = payload || {};
  const entry = p?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || p;
  const text = entry?.text?.body ?? "";
  const audioRef = entry?.audio?.id ?? entry?.voice?.id ?? null;
  return {
    source: "whatsapp",
    text: typeof text === "string" ? text : "",
    audioRef: audioRef ?? null,
    meta: {
      waId: entry?.from ?? null,
      type: entry?.type ?? null,
      messageId: entry?.id ?? null,
    },
  };
}

/** Canal generico — payload ja normalizado ou proximo disso: `{text, audioRef, source}`. */
export function generic(payload) {
  const p = payload || {};
  const text = typeof p === "string" ? p : p.text ?? "";
  return {
    source: typeof p.source === "string" && p.source ? p.source : "text",
    text: typeof text === "string" ? text : "",
    audioRef: p.audioRef ?? null,
    meta: p.meta && typeof p.meta === "object" ? p.meta : {},
  };
}

/** @type {Record<string, (payload:any)=>{source:string,text:string,audioRef:string|null,meta:Record<string,unknown>}>} */
export const NORMALIZERS = { telegram, whatsapp, generic };

/** Resolve o normalizador de um canal, com fallback para generico. */
export function resolve(channel) {
  return NORMALIZERS[channel] || generic;
}

export default { telegram, whatsapp, generic, NORMALIZERS, resolve };
