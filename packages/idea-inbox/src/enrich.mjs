// @ts-check
/**
 * Enriquecimento best-effort do registro de ideia com os sinais de
 * ASSIMETRIA/SINERGIA (packages/idea-forge/src/seeds/score.mjs) contra o
 * seed bank do operador (tabela `seeds`, ver
 * supabase/migrations/20260711_seeds.sql). So roda se SUPABASE_URL e
 * SUPABASE_SERVICE_KEY estiverem configurados; nunca lanca nem bloqueia a
 * resposta HTTP — mesma politica de src/store-remote.mjs (Constitution
 * "No LLM/no backend = no blocker").
 */
import { scoreAgainstSeeds } from "@aiox/idea-forge";

const FETCH_TIMEOUT_MS = 5_000;

/** @param {unknown} err */
function shortMsg(err) {
  const m = err instanceof Error ? err.message : String(err);
  return m.slice(0, 160);
}

/**
 * Busca os seeds cadastrados no Supabase (best-effort). Sem credenciais ou
 * em falha de rede, devolve lista vazia — nunca lanca.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function fetchSeeds() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return [];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/seeds?select=*`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    void shortMsg(err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Converte uma linha crua da tabela `seeds` para o shape `Seed` esperado por
 * `scoreAgainstSeeds` (ver packages/idea-forge/src/seeds/parse.mjs).
 * @param {Record<string, unknown>} row
 */
function rowToSeed(row) {
  return {
    id: String(row.id ?? ""),
    titulo: String(row.titulo ?? ""),
    body: String(row.body ?? ""),
    destrava: Array.isArray(row.destrava) ? row.destrava : [],
    compoeCom: Array.isArray(row.compoe_com) ? row.compoe_com : [],
    tipo: row.tipo ?? null,
    forjaTier: row.forja_tier ?? null,
    status: row.status ?? null,
    cluster: row.cluster ?? null,
  };
}

/** @returns {{asymmetry_score:null, synergy_score:null, cluster_reach:null, matched_seeds:null}} */
function emptyEnrichment() {
  return { asymmetry_score: null, synergy_score: null, cluster_reach: null, matched_seeds: null };
}

/**
 * Pontua o texto final da ideia contra o seed bank. Best-effort: sem
 * Supabase configurado, sem seeds cadastrados, ou em qualquer falha, devolve
 * campos nulos — nunca bloqueia o fluxo principal do webhook.
 * @param {string} text
 * @returns {Promise<{asymmetry_score:number|null, synergy_score:number|null, cluster_reach:number|null, matched_seeds:unknown[]|null}>}
 */
export async function enrichWithSeeds(text) {
  try {
    const rows = await fetchSeeds();
    if (!rows.length) return emptyEnrichment();
    const seeds = rows.map(rowToSeed).filter((s) => s.id);
    if (!seeds.length) return emptyEnrichment();
    const { asymmetry_score, synergy_score, cluster_reach, matched } = scoreAgainstSeeds(text || "", seeds);
    return { asymmetry_score, synergy_score, cluster_reach, matched_seeds: matched };
  } catch (err) {
    void shortMsg(err);
    return emptyEnrichment();
  }
}

export default { enrichWithSeeds };
