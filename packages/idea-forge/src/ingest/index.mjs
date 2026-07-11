// @ts-check
/**
 * Estagio INGEST: canal -> payload normalizado -> transcricao -> RawIdea.
 * Primeiro estagio do pipeline. Multi-canal (Telegram, WhatsApp, Claude app,
 * Claude Code, Cowork, arquivo de audio, texto).
 */
import { resolveAdapter } from "./adapters.mjs";
import { transcribe } from "./transcribe.mjs";
import { CHANNELS } from "../types.mjs";

/**
 * @param {import("../types.mjs").PipelineState & {input?:any}} state
 * @returns {Promise<Partial<import("../types.mjs").PipelineState>>}
 */
export async function ingest(state) {
  const input = state.input || {};
  const source = CHANNELS.includes(input.source) ? input.source : "text";
  const adapter = resolveAdapter(source);
  const normalized = adapter(input.raw ?? input);
  const t = await transcribe({ text: input.text ?? normalized.text, audioRef: input.audioRef ?? normalized.audioRef, source });

  /** @type {import("../types.mjs").RawIdea} */
  const raw = {
    id: state.runId,
    source,
    transcript: t.transcript,
    audioRef: input.audioRef ?? normalized.audioRef ?? null,
    capturedAt: state.createdAt,
    meta: { ...normalized.meta, ...(input.meta || {}), transcription: t.note },
  };

  if (!raw.transcript || raw.transcript.startsWith("[AUDIO")) {
    // registra, mas nao bloqueia: estagios seguintes tratam transcript vazio
    state.log.push(`[ingest] aviso: transcript ausente/pendente (${t.note})`);
  }
  return { raw };
}

export default { ingest };
