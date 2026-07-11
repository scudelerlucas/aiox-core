// @ts-check
/**
 * Interface de transcricao (STT) com fallback passthrough.
 * O audio pode vir de qualquer canal; aqui ele vira texto.
 *
 * - Se o payload ja traz `text` (ex: transcricao feita pelo cliente Telegram/WhatsApp,
 *   ou digitado no Claude Code), usamos direto (passthrough).
 * - Se ha apenas `audioRef` e um provedor STT esta configurado (IDEAFORGE_STT_URL),
 *   chamamos o provedor. Caso contrario, retornamos um marcador explicito — o
 *   pipeline nunca trava por falta de STT (No LLM/No STT = no blocker).
 *
 * @param {{text?:string, audioRef?:string|null, source:string}} input
 * @returns {Promise<{transcript:string, transcribed:boolean, note:string}>}
 */
export async function transcribe(input) {
  const text = (input.text || "").trim();
  if (text) return { transcript: text, transcribed: false, note: "passthrough:texto-fornecido" };

  if (input.audioRef && process.env.IDEAFORGE_STT_URL) {
    try {
      const res = await fetch(process.env.IDEAFORGE_STT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio: input.audioRef, source: input.source }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const t = String(data?.transcript || "").trim();
      if (t) return { transcript: t, transcribed: true, note: "stt:remoto" };
      throw new Error("stt vazio");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      return {
        transcript: `[AUDIO NAO TRANSCRITO: ${input.audioRef}]`,
        transcribed: false,
        note: `stt-falhou:${msg}`,
      };
    }
  }

  return {
    transcript: input.audioRef ? `[AUDIO PENDENTE DE TRANSCRICAO: ${input.audioRef}]` : "",
    transcribed: false,
    note: "sem-texto-sem-stt",
  };
}

export default { transcribe };
