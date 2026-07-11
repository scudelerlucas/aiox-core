// @ts-check
/**
 * Fecha o laco (idea -> CI): dispara um `repository_dispatch` no GitHub para
 * o workflow `.github/workflows/idea-forge-realize.yml`, que roda o restante
 * do pipeline (realize) fora do request serverless. Best-effort, nunca lanca —
 * sem token/repo configurados, so registra que a CI esta desligada.
 */

const FETCH_TIMEOUT_MS = 5_000;

/** @param {unknown} err */
function shortMsg(err) {
  const m = err instanceof Error ? err.message : String(err);
  return m.slice(0, 160);
}

/**
 * Dispara o evento `idea-forge-realize` via GitHub `repository_dispatch`.
 * @param {{runId?:string|null, idea?:string, score?:number|null}} input
 * @returns {Promise<{ok:boolean, via:string}>}
 */
export async function fireRealize({ runId, idea, score }) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return { ok: false, via: "ci-desligado" };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": "idea-inbox",
        },
        body: JSON.stringify({
          event_type: "idea-forge-realize",
          client_payload: { runId, score, idea: String(idea ?? "").slice(0, 1000) },
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { ok: false, via: `github-http-${res.status}` };
    return { ok: true, via: "github" };
  } catch (err) {
    return { ok: false, via: `github-falhou:${shortMsg(err)}` };
  }
}

export default fireRealize;
