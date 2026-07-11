// @ts-check
/**
 * Core do IdeaInbox — recebe um payload de canal, normaliza, cria um run do
 * idea-forge e dispara o pipeline OFFLINE (fire-and-forget, sem bloquear a
 * resposta HTTP). Constitution Artigo "No LLM = no blocker": se qualquer
 * coisa falhar antes/durante a criacao do run, a ideia crua e persistida em
 * fila (`inbox-queue.jsonl`) — nada se perde, o servidor nunca cai.
 */
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createRun, runAll } from "../../idea-forge/src/index.mjs";
import { resolve } from "./normalize.mjs";

/** Log simples, uma linha por evento, para stdout (Observability Second). */
export function log(msg) {
  console.log(`[idea-inbox] ${new Date().toISOString()} ${msg}`);
}

let seqCounter = 0;

/**
 * Gera um runId deterministico a partir de um timestamp + sequencia —
 * pura, testavel isoladamente (sem depender de Date.now/relogio real).
 * @param {number|string|Date} now
 * @param {number} seq
 */
export function buildRunId(now, seq) {
  const stamp = new Date(now).toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const suffix = String(seq % 10000).padStart(4, "0");
  return `ib-${stamp}-${suffix}`;
}

/**
 * runId "de producao" — timestamp real + contador de processo (colisao-safe
 * dentro do mesmo processo/millisegundo). Nao e um script de workflow, entao
 * usar Date real aqui e aceitavel (regra do orquestrador nao se aplica).
 */
export function newRunId() {
  seqCounter += 1;
  return buildRunId(Date.now(), seqCounter);
}

/**
 * Fallback deterministico: nunca perder uma ideia. Acrescenta uma linha JSON
 * em `<dir>/inbox-queue.jsonl` com o payload cru + canal + timestamp.
 * @param {string} dir
 * @param {string} channel
 * @param {unknown} payload
 */
export function enqueueRaw(dir, channel, payload) {
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ queuedAt: new Date().toISOString(), channel, payload }) + "\n";
  appendFileSync(join(dir, "inbox-queue.jsonl"), line);
}

/**
 * Ingesta um payload de canal: normaliza -> cria run idea-forge -> dispara
 * pipeline OFFLINE assincronamente. Retorna imediatamente (nao aguarda o
 * pipeline). Qualquer excecao sincrona (normalize/createRun) cai no fallback
 * de fila; o pipeline assincrono tambem tem seu proprio catch, por segurança.
 *
 * @param {Object} opts
 * @param {string} opts.channel
 * @param {unknown} opts.payload
 * @param {import("../../idea-forge/src/store.mjs").Store} opts.store
 * @param {string} opts.dir      base dir do idea-inbox (para a fila de fallback)
 * @returns {Promise<{runId:string|null, accepted:boolean, queued?:boolean}>}
 */
export async function handleIngest({ channel, payload, store, dir }) {
  try {
    const normalizer = resolve(channel);
    const normalized = normalizer(payload);
    const runId = newRunId();
    const state = createRun({
      runId,
      source: normalized.source,
      text: normalized.text,
      audioRef: normalized.audioRef,
      meta: normalized.meta,
    });
    store.save(state);

    // Fire-and-forget: dispara o pipeline sem aguardar. O `.catch` garante
    // que uma falha assincrona nunca vire unhandled rejection (processo cai).
    runAll(state, { store })
      .then(() => log(`pipeline concluido run=${runId} stage=${state.stage}`))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        log(`pipeline falhou run=${runId}: ${message}`);
        try {
          enqueueRaw(dir, channel, { runId, payload, error: message });
        } catch {
          /* best-effort: se ate a fila falhar, so resta o log acima */
        }
      });

    return { runId, accepted: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`normalize/createRun falhou (${channel}): ${message} — enfileirando ideia crua`);
    enqueueRaw(dir, channel, payload);
    return { runId: null, accepted: true, queued: true };
  }
}

export default { handleIngest, enqueueRaw, newRunId, buildRunId, log };
