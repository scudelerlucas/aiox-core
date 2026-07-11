// @ts-check
/**
 * Voz -> texto (STT), best-effort. Sem dependencia npm: usa `fetch`/`FormData`/
 * `Blob` globais (Node >=20). Nunca lanca — Constitution "No LLM = no blocker":
 * se a transcricao falhar ou nao estiver configurada, o chamador recebe texto
 * vazio + o motivo em `via`, e decide o proximo passo (ex: 202 sem pipeline).
 */

const FETCH_TIMEOUT_MS = 8_000;

/** @param {unknown} err */
function shortMsg(err) {
  const m = err instanceof Error ? err.message : String(err);
  return m.slice(0, 160);
}

/**
 * fetch com timeout via AbortController — best-effort, nunca deixa a chamada
 * pendurada indefinidamente no ambiente serverless.
 * @param {string} url @param {RequestInit} [opts] @param {number} [ms]
 */
async function fetchWithTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia bytes de audio para um servico de STT (Whisper-compativel) e devolve
 * o texto transcrito. Lanca em caso de falha/config ausente — o chamador
 * (`transcribe`) captura e converte em fallback nao-lancante.
 * @param {ArrayBuffer|Uint8Array} bytes
 * @param {string} filename
 * @returns {Promise<string>}
 */
export async function sttTranscribe(bytes, filename) {
  const blob = new Blob([bytes]);
  const model = process.env.STT_MODEL || "whisper-1";

  if (process.env.STT_URL) {
    const form = new FormData();
    form.set("file", blob, filename);
    form.set("model", model);
    const res = await fetchWithTimeout(process.env.STT_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.STT_KEY || ""}` },
      body: form,
    });
    if (!res.ok) throw new Error(`stt-url-http-${res.status}`);
    const json = await res.json();
    return json?.text || json?.transcript || "";
  }

  if (process.env.OPENAI_API_KEY) {
    const form = new FormData();
    form.set("file", blob, filename);
    form.set("model", model);
    const res = await fetchWithTimeout("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!res.ok) throw new Error(`openai-stt-http-${res.status}`);
    const json = await res.json();
    return json?.text || "";
  }

  throw new Error("stt-nao-configurado");
}

/**
 * Resolve o texto final de uma mensagem: texto direto (passthrough, sem rede)
 * ou audio buscado do canal + transcrito via `sttTranscribe`. Best-effort e
 * nunca lanca — qualquer falha vira `{ text: "", via: "stt-falhou:..." }`.
 * @param {{source?:string|null, audioRef?:string|null, text?:string|null}} input
 * @returns {Promise<{text:string, via:string}>}
 */
export async function transcribe({ source, audioRef, text }) {
  try {
    const trimmed = (text || "").trim();
    if (trimmed) return { text: trimmed, via: "passthrough" };

    if (!audioRef) return { text: "", via: "sem-stt" };

    if (source === "telegram" && process.env.TELEGRAM_BOT_TOKEN) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const metaRes = await fetchWithTimeout(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(audioRef)}`);
      if (!metaRes.ok) throw new Error(`telegram-getfile-http-${metaRes.status}`);
      const meta = await metaRes.json();
      const filePath = meta?.result?.file_path;
      if (!filePath) throw new Error("telegram-file-path-ausente");
      const fileRes = await fetchWithTimeout(`https://api.telegram.org/file/bot${token}/${filePath}`);
      if (!fileRes.ok) throw new Error(`telegram-file-http-${fileRes.status}`);
      const bytes = await fileRes.arrayBuffer();
      const out = await sttTranscribe(bytes, "audio.ogg");
      return { text: out, via: "telegram+stt" };
    }

    if (source === "whatsapp" && process.env.WHATSAPP_TOKEN) {
      const wToken = process.env.WHATSAPP_TOKEN;
      const metaRes = await fetchWithTimeout(`https://graph.facebook.com/v20.0/${encodeURIComponent(audioRef)}`, {
        headers: { authorization: `Bearer ${wToken}` },
      });
      if (!metaRes.ok) throw new Error(`whatsapp-meta-http-${metaRes.status}`);
      const meta = await metaRes.json();
      const mediaUrl = meta?.url;
      if (!mediaUrl) throw new Error("whatsapp-media-url-ausente");
      const fileRes = await fetchWithTimeout(mediaUrl, { headers: { authorization: `Bearer ${wToken}` } });
      if (!fileRes.ok) throw new Error(`whatsapp-file-http-${fileRes.status}`);
      const bytes = await fileRes.arrayBuffer();
      const out = await sttTranscribe(bytes, "audio.ogg");
      return { text: out, via: "whatsapp+stt" };
    }

    return { text: "", via: "sem-stt" };
  } catch (err) {
    return { text: "", via: `stt-falhou:${shortMsg(err)}` };
  }
}

export default transcribe;
