// @ts-check
/**
 * Memoria de falhas antifragil (T4.5): o pipeline GANHA com as proprias quebras
 * de simulacao em vez de descarta-las. O estagio SIMULATE detecta categorias de
 * quebra (breaks) a cada rodada de E2E; aqui persistimos essas categorias num
 * arquivo compartilhado, append-only, entre runs (o "banco de cicatrizes"). O
 * estagio ARCHITECT consulta essa memoria para blindar builds futuros contra os
 * modos de falha mais recorrentes (Antifragilidade — ganha com a desordem
 * passada, nao so resiste a ela).
 *
 * Zero-dep (node:fs), best-effort: nunca lanca. Historico ausente, vazio ou
 * corrompido -> no-op / lista vazia.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FILE_NAME = "failure-patterns.json";

/** @param {string} dir */
function filePath(dir) {
  return join(dir, FILE_NAME);
}

/**
 * Le o historico bruto do arquivo (array de entradas {id, desc, runId, ts}).
 * Nunca lanca: arquivo ausente/corrompido/formato inesperado -> [].
 * @param {string} dir
 * @returns {Array<{id:string, desc?:string, runId?:string, ts?:string}>}
 */
function readHistory(dir) {
  try {
    if (!dir) return [];
    const p = filePath(dir);
    if (!existsSync(p)) return [];
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Registra categorias de falha (append-only) no arquivo compartilhado do
 * diretorio do store. Best-effort: qualquer erro (FS, permissao, dir ausente)
 * e engolido — a simulacao nunca deve quebrar por causa da memoria.
 * @param {string} dir diretorio compartilhado (ex: Store#baseDir)
 * @param {Array<{id:string, desc?:string}>} categories
 * @param {{runId?:string}} [meta]
 * @returns {boolean} true se persistiu com sucesso
 */
export function recordFailures(dir, categories, meta = {}) {
  if (!dir || !Array.isArray(categories) || categories.length === 0) return false;
  try {
    mkdirSync(dir, { recursive: true });
    const history = readHistory(dir);
    const ts = new Date().toISOString();
    for (const c of categories) {
      if (!c || !c.id) continue;
      history.push({ id: String(c.id), desc: c.desc ? String(c.desc) : "", runId: meta.runId ? String(meta.runId) : "", ts });
    }
    writeFileSync(filePath(dir), JSON.stringify(history, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Top-N categorias de falha mais frequentes no historico (contagem
 * decrescente). Tolerante a ausencia/corrupcao do arquivo -> [].
 * @param {string} dir
 * @param {number} [n]
 * @returns {Array<{id:string, count:number, desc:string}>}
 */
export function topFailures(dir, n = 5) {
  try {
    const history = readHistory(dir);
    if (!history.length) return [];
    /** @type {Map<string, {id:string, count:number, desc:string}>} */
    const counts = new Map();
    for (const h of history) {
      if (!h || !h.id) continue;
      const cur = counts.get(h.id) || { id: h.id, count: 0, desc: h.desc || "" };
      cur.count++;
      if (!cur.desc && h.desc) cur.desc = h.desc;
      counts.set(h.id, cur);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, Math.max(0, n));
  } catch {
    return [];
  }
}

export default { recordFailures, topFailures };
