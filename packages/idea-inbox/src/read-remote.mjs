// @ts-check
/**
 * Leitura da memoria permanente (Supabase), best-effort — irma de leitura do
 * `store-remote.mjs` (que so grava). Usada pelos endpoints /runs e /report
 * (T1.3: link duravel/persistente por run). Nunca lanca — Constitution
 * "No LLM/no backend = no blocker": falha de rede/config nunca derruba a
 * resposta HTTP; so faz o chamador tratar `null` como "sem dado".
 */

const FETCH_TIMEOUT_MS = 5_000;

/** @param {unknown} err */
function shortMsg(err) {
  const m = err instanceof Error ? err.message : String(err);
  return m.slice(0, 160);
}

/**
 * Busca o registro mais recente de uma ideia na tabela `ideas` (Supabase REST
 * / PostgREST) pelo `run_id`. Sem `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`,
 * retorna `null` sem tentar rede (memoria desligada). Qualquer falha de rede,
 * HTTP nao-ok, ou resposta vazia tambem retorna `null` — NUNCA lanca.
 * @param {string} runId
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function fetchIdea(runId) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  if (!runId) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      const qs = `run_id=eq.${encodeURIComponent(runId)}&select=*&order=created_at.desc&limit=1`;
      res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/ideas?${qs}`, {
        method: "GET",
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
        },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0];
  } catch (err) {
    // best-effort: loga server-side, mas nunca lanca (F3/F7).
    // eslint-disable-next-line no-console
    console.error(`[idea-inbox:read-remote] falha:${shortMsg(err)}`);
    return null;
  }
}

/**
 * Le um run id de um objeto de query ja parseado (ex: `URLSearchParams`
 * convertido em objeto, ou o proprio `URLSearchParams`). Aceita as chaves
 * `runId` ou `id`. Pura — nunca lanca. Retorna string trimada ou "".
 * @param {Record<string, unknown>|URLSearchParams|null|undefined} query
 * @returns {string}
 */
export function pickRunId(query) {
  if (!query) return "";
  const get = (k) => {
    if (typeof URLSearchParams !== "undefined" && query instanceof URLSearchParams) return query.get(k);
    // @ts-ignore - acesso defensivo a objeto simples
    return query[k];
  };
  const raw = get("runId") ?? get("id");
  return typeof raw === "string" ? raw.trim() : "";
}

export default fetchIdea;
