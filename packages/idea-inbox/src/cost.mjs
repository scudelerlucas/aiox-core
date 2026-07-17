// @ts-check
/**
 * Governanca de custo (B.1): contador metrificado em memoria, fixed-window,
 * para observar o volume de operacoes CARAS (pipeline runs, disparos de CI e,
 * no futuro, chamadas de LLM) independente do rate-limit por IP (que so limita
 * requests, nao o custo agregado do sistema). Zero-dep, nunca lanca — mesmo
 * padrao dos buckets de rate-limit/dedup (api/_core.mjs, src/dedup.mjs).
 */

const WINDOW_MS = 60_000;

/** @type {Map<string, {start:number, count:number}>} nome -> janela fixa atual */
const windows = new Map();

/**
 * Incrementa o contador `name` na janela fixa atual (reinicia a janela se
 * expirada). Best-effort: nunca lanca.
 * @param {string} name
 */
export function meter(name) {
  try {
    const key = String(name || "unknown");
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now - w.start >= WINDOW_MS) {
      windows.set(key, { start: now, count: 1 });
      return;
    }
    w.count++;
  } catch {
    /* best-effort: contador nunca deve derrubar o caminho principal */
  }
}

/**
 * Snapshot dos contadores da janela atual (contadores de janelas expiradas
 * aparecem como 0). Nunca lanca.
 * @returns {Record<string, number>}
 */
export function snapshot() {
  try {
    const now = Date.now();
    /** @type {Record<string, number>} */
    const out = {};
    for (const [name, w] of windows) {
      out[name] = now - w.start < WINDOW_MS ? w.count : 0;
    }
    return out;
  } catch {
    return {};
  }
}

export default { meter, snapshot };
