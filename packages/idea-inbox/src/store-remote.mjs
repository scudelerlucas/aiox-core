// @ts-check
/**
 * Memoria permanente (Supabase), best-effort. O store local (`src/pipeline-sync.mjs`)
 * usa `/tmp` (efemero na Vercel); esta camada e opcional e so grava se as
 * credenciais estiverem configuradas. Nunca lanca — Constitution "No LLM/no
 * backend = no blocker": falha de rede/config nunca derruba a resposta HTTP.
 */

const FETCH_TIMEOUT_MS = 5_000;

/** @param {unknown} err */
function shortMsg(err) {
  const m = err instanceof Error ? err.message : String(err);
  return m.slice(0, 160);
}

/**
 * Persiste um registro de ideia na tabela `ideas` via Supabase REST (PostgREST).
 * Sem `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`, retorna desligado sem tentar rede.
 * @param {Record<string, unknown>} record
 * @returns {Promise<{ok:boolean, via:string}>}
 */
export async function persistIdea(record) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { ok: false, via: "memoria-desligada" };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/ideas`, {
        method: "POST",
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(record),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { ok: false, via: `supabase-http-${res.status}` };
    return { ok: true, via: "supabase" };
  } catch (err) {
    return { ok: false, via: `supabase-falhou:${shortMsg(err)}` };
  }
}

export default persistIdea;
