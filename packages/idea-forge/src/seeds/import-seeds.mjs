// @ts-check
/**
 * Importa (parse + upsert) o seed bank para a tabela `seeds` no Supabase via
 * REST/PostgREST. Best-effort, mesma politica do resto do IdeaForge/IdeaInbox
 * (ver packages/idea-inbox/src/store-remote.mjs): sem credenciais, so
 * parseia (parse-only) e nunca lanca.
 */
import { parseSeedBank } from "./parse.mjs";

const FETCH_TIMEOUT_MS = 8_000;
const BATCH_SIZE = 100;

/** @param {unknown} err */
function shortMsg(err) {
  const m = err instanceof Error ? err.message : String(err);
  return m.slice(0, 160);
}

/**
 * @param {import("./parse.mjs").Seed} seed
 */
function seedToRow(seed) {
  return {
    id: seed.id,
    titulo: seed.titulo,
    body: seed.body,
    destrava: seed.destrava,
    compoe_com: seed.compoeCom,
    tipo: seed.tipo,
    forja_tier: seed.forjaTier,
    status: seed.status,
    cluster: seed.cluster,
  };
}

/**
 * @param {string} url
 * @param {string} serviceKey
 * @param {ReturnType<typeof seedToRow>[]} batch
 * @returns {Promise<boolean>}
 */
async function upsertBatch(url, serviceKey, batch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/seeds`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(batch),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parseia o seed bank e faz upsert em lotes de 100 no Supabase. Sem
 * `supabaseUrl`/`serviceKey`, faz so o parse (parse-only) e retorna
 * `via:"sem-supabase"` — nunca lanca.
 * @param {{md:string, supabaseUrl?:string|null, serviceKey?:string|null}} input
 * @returns {Promise<{parsed:number, upserted:number, via:string}>}
 */
export async function importSeeds({ md, supabaseUrl, serviceKey }) {
  let seeds = [];
  try {
    seeds = parseSeedBank(md);
  } catch {
    seeds = [];
  }

  if (!supabaseUrl || !serviceKey) {
    return { parsed: seeds.length, upserted: 0, via: "sem-supabase" };
  }

  let upserted = 0;
  let failures = 0;
  const rows = seeds.map(seedToRow);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const ok = await upsertBatch(supabaseUrl, serviceKey, batch);
      if (ok) upserted += batch.length;
      else failures++;
    } catch (err) {
      void shortMsg(err);
      failures++;
    }
  }

  const via = failures === 0 ? "supabase" : upserted > 0 ? "supabase-parcial" : "supabase-falhou";
  return { parsed: seeds.length, upserted, via };
}

export default { importSeeds };
