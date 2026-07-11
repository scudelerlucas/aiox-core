// @ts-check
/**
 * Adaptadores de canal. Cada canal entrega um payload diferente; o adaptador
 * normaliza para `{ text, audioRef, meta }`. O audio pode ser gravado no
 * Telegram, WhatsApp, Claude app, Claude Code ou Cowork.
 *
 * Contrato do adaptador:
 *   (payload) => { text?:string, audioRef?:string|null, meta:Record<string,unknown> }
 * Aceita tanto o formato ja-normalizado (`{text, audioRef}`) quanto o payload
 * cru do canal (ex: update do Bot API do Telegram).
 */

/** Telegram Bot API update (voice message ou texto). */
export function telegram(p) {
  const msg = p.message || p;
  const audioRef =
    p.audioRef ?? msg?.voice?.file_id ?? msg?.audio?.file_id ?? null;
  const text = p.text ?? msg?.text ?? msg?.caption ?? "";
  return { text, audioRef, meta: { chatId: msg?.chat?.id, from: msg?.from?.username } };
}

/** WhatsApp Cloud API webhook (audio ou texto). */
export function whatsapp(p) {
  const entry = p?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || p;
  const audioRef = p.audioRef ?? entry?.audio?.id ?? entry?.voice?.id ?? null;
  const text = p.text ?? entry?.text?.body ?? "";
  return { text, audioRef, meta: { waId: entry?.from, type: entry?.type } };
}

/** Claude app / claude.ai — nota de voz ou texto colado. */
export function claudeApp(p) {
  return {
    text: p.text ?? p.transcript ?? "",
    audioRef: p.audioRef ?? p.audio ?? null,
    meta: { surface: "claude-app", conversationId: p.conversationId },
  };
}

/** Claude Code — normalmente texto (prompt) ou anexo de audio. */
export function claudeCode(p) {
  return {
    text: p.text ?? p.prompt ?? "",
    audioRef: p.audioRef ?? null,
    meta: { surface: "claude-code", cwd: p.cwd },
  };
}

/** Cowork — captura de voz/texto no cliente Cowork. */
export function cowork(p) {
  return {
    text: p.text ?? p.transcript ?? "",
    audioRef: p.audioRef ?? p.audio ?? null,
    meta: { surface: "cowork", workspace: p.workspace },
  };
}

/** Arquivo de audio avulso (path/url). */
export function audioFile(p) {
  return {
    text: p.text ?? "",
    audioRef: p.audioRef ?? p.path ?? p.url ?? null,
    meta: { surface: "audio-file" },
  };
}

/** Texto puro. */
export function text(p) {
  return { text: typeof p === "string" ? p : p.text ?? "", audioRef: null, meta: { surface: "text" } };
}

/** @type {Record<string, (p:any)=>{text?:string,audioRef?:string|null,meta:Record<string,unknown>}>} */
export const ADAPTERS = {
  telegram,
  whatsapp,
  "claude-app": claudeApp,
  "claude-code": claudeCode,
  cowork,
  "audio-file": audioFile,
  text,
};

/** Resolve o adaptador de um canal, com fallback para texto. */
export function resolveAdapter(source) {
  return ADAPTERS[source] || ADAPTERS.text;
}

export default { ADAPTERS, resolveAdapter };
