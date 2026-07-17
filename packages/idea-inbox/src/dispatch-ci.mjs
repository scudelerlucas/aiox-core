// @ts-check
/**
 * Fecha o laco (idea -> CI): dispara um `repository_dispatch` no GitHub para
 * o workflow `.github/workflows/idea-forge-realize.yml`, que roda o restante
 * do pipeline (realize) fora do request serverless. Best-effort, nunca lanca —
 * sem token/repo configurados, so registra que a CI esta desligada.
 *
 * Governanca de custo (B.1): disparo de CI e uma operacao CARA (roda todo o
 * pipeline + build do projeto-filho). Um teto GLOBAL fixed-window (independente
 * do rate-limit por IP, que so limita requests) evita que um pico de webhooks
 * dispare uma avalanche de runs de CI. Excedeu o teto -> nao dispara, nunca.
 */
import { meter } from "./cost.mjs";

const FETCH_TIMEOUT_MS = 5_000;
const CI_MAX_PER_MIN = Number(process.env.IDEAINBOX_MAX_CI_PER_MIN || 20);
const CI_WINDOW_MS = 60_000;

/** Contador fixed-window GLOBAL (nao por IP/operador) — o teto e do sistema como um todo. */
let ciBucket = { start: 0, count: 0 };

/** true se o teto global de disparos de CI/minuto foi excedido nesta janela. */
function ciCapExceeded() {
  const now = Date.now();
  if (now - ciBucket.start >= CI_WINDOW_MS) {
    ciBucket = { start: now, count: 1 };
    return false;
  }
  ciBucket.count++;
  return ciBucket.count > CI_MAX_PER_MIN;
}

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

  // Teto de custo (B.1) — checado ANTES de disparar, independente do
  // rate-limit por IP. Excedeu -> bloqueia, sem tocar na rede.
  if (ciCapExceeded()) {
    meter("ci_capped");
    return { ok: false, via: "ci-cap-atingido" };
  }

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
    meter("ci_fires");
    return { ok: true, via: "github" };
  } catch (err) {
    return { ok: false, via: `github-falhou:${shortMsg(err)}` };
  }
}

export default fireRealize;
