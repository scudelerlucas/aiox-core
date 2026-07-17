// @ts-check
/**
 * Relatorio duravel por run (T1.3): link publico e linkavel
 * (`/report/:id`) que renderiza um HTML grafico auto-contido a partir do
 * registro persistido na tabela `ideas` (Supabase). Complementa o
 * `api/diagnose.mjs` (que roda o pipeline completo inline, sem persistir
 * link) — aqui so LEMOS o que ja foi salvo por `store-remote.mjs`.
 * `renderReport` e pura (sem I/O) — testavel sem HTTP/rede, e NUNCA lanca
 * mesmo com dado ausente/parcial (defaults seguros).
 */
import { fetchIdea, pickRunId } from "../src/read-remote.mjs";

/**
 * Escapa texto p/ HTML (XSS-safe) — todo valor vindo do registro passa por
 * aqui antes de entrar no markup.
 * @param {unknown} v
 * @returns {string}
 */
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

/**
 * Barra/gauge horizontal, SVG inline (sem libs) — mesmo desenho do dashboard.
 * @param {number} pct @param {string} color @param {number} [height]
 */
function svgBar(pct, color, height = 14) {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const r = height / 2;
  return (
    `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" class="bar" role="img" aria-label="${p}%">` +
    `<rect x="0" y="0" width="100" height="${height}" rx="${r}" class="bar-bg"></rect>` +
    `<rect x="0" y="0" width="${p}" height="${height}" rx="${r}" fill="${color}"></rect>` +
    `</svg>`
  );
}

/** Formata um numero 0-1 (ou ja em %) como percentual; "—" quando ausente. @param {unknown} v */
function fmtPct(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct * 10) / 10}%`;
}

/** Formata um inteiro; "—" quando ausente. @param {unknown} v */
function fmtInt(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return String(Math.round(Number(v)));
}

/** Renderiza um item de `matched_seeds` de forma defensiva (string ou objeto parcial). */
function seedItem(seed) {
  if (seed === null || seed === undefined) return "";
  if (typeof seed === "string") return `<li class="seed">${esc(seed)}</li>`;
  if (typeof seed === "object") {
    const id = "id" in seed ? seed.id : undefined;
    const titulo = "titulo" in seed ? seed.titulo : "title" in seed ? seed.title : undefined;
    const score = "score" in seed ? seed.score : "similarity" in seed ? seed.similarity : undefined;
    const label = [id, titulo].filter((x) => x !== undefined && x !== null && x !== "").map(esc).join(" — ");
    const scoreLabel = score !== undefined && score !== null && Number.isFinite(Number(score)) ? ` <span class="seed-score">${fmtPct(score)}</span>` : "";
    return `<li class="seed">${label || esc(JSON.stringify(seed).slice(0, 80))}${scoreLabel}</li>`;
  }
  return `<li class="seed">${esc(seed)}</li>`;
}

/**
 * Gera a pagina HTML do relatorio a partir de um registro `ideas` (shape:
 * `{runId|run_id, score, blocked, project, branch, source, channel,
 * asymmetry_score, synergy_score, cluster_reach, matched_seeds, created_at}`).
 * Pura — sem I/O — testavel diretamente. Nunca lanca: dados ausentes ou
 * malformados viram defaults seguros (score 0, arrays vazios, "—").
 * @param {Record<string, any>} idea
 * @returns {string}
 */
export function renderReport(idea) {
  const it = idea && typeof idea === "object" ? idea : {};
  const runId = String(it.runId ?? it.run_id ?? "—");
  const score = Number.isFinite(Number(it.score)) ? Number(it.score) : 0;
  const blocked = !!it.blocked;
  const pass = !blocked && score >= 95;
  const badgeLabel = pass ? "PASS" : "BLOCKED";
  const badgeColor = pass ? "#16a34a" : "#dc2626";

  const project = it.project ? esc(it.project) : "—";
  const branch = it.branch ? esc(it.branch) : "—";
  const source = it.source ? esc(it.source) : "—";
  const channel = it.channel ? esc(it.channel) : "—";
  const createdAt = it.created_at ?? it.createdAt ?? "—";

  const seeds = Array.isArray(it.matched_seeds) ? it.matched_seeds : [];
  const seedsHtml = seeds.length ? `<ul class="seeds">${seeds.map(seedItem).join("")}</ul>` : `<p class="empty">nenhum seed correlacionado</p>`;

  const pct = Math.max(0, Math.min(100, score));

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatorio IdeaForge — ${esc(runId)}</title>
<style>
  :root { color-scheme: light dark; --bg:#f8fafc; --fg:#0f172a; --card:#ffffff; --border:#e2e8f0; --muted:#64748b; --accent:#2563eb; --bar-bg:#e2e8f0; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0b1220; --fg:#e2e8f0; --card:#111827; --border:#1f2937; --muted:#94a3b8; --accent:#60a5fa; --bar-bg:#1f2937; }
  }
  :root[data-theme="dark"] { --bg:#0b1220; --fg:#e2e8f0; --card:#111827; --border:#1f2937; --muted:#94a3b8; --accent:#60a5fa; --bar-bg:#1f2937; }
  :root[data-theme="light"] { --bg:#f8fafc; --fg:#0f172a; --card:#ffffff; --border:#e2e8f0; --muted:#64748b; --accent:#2563eb; --bar-bg:#e2e8f0; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body {
    background:var(--bg); color:var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 16px; max-width: 820px; margin: 0 auto;
    overflow-x: hidden;
  }
  header h1 { font-size: 1.15rem; margin: 0 0 4px; word-break: break-word; }
  header p.meta { margin: 0 0 16px; color: var(--muted); font-size: 0.78rem; font-family: ui-monospace, Menlo, monospace; }
  .hero { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .hero-top { display:flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .score { font-size: 2.4rem; font-weight: 700; margin: 0; }
  .badge { font-size: 0.78rem; font-weight: 700; color: #fff; padding: 4px 12px; border-radius: 999px; white-space: nowrap; }
  .bar { width: 100%; height: auto; display: block; margin-top: 10px; }
  .bar-bg { fill: var(--bar-bg); }
  .grid { display:flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .kv { flex: 1 1 140px; font-size: 0.82rem; }
  .kv .k { color: var(--muted); display:block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .kv .v { font-weight: 600; overflow-wrap: break-word; }
  .panel { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .panel h2 { font-size: 0.95rem; margin: 0 0 10px; }
  .metrics { display:flex; flex-wrap: wrap; gap: 12px; }
  .metric { flex: 1 1 140px; text-align:center; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
  .metric .num { font-size: 1.3rem; font-weight: 700; }
  .metric .label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
  .seeds { list-style: none; margin: 8px 0 0; padding: 0; display:flex; flex-direction: column; gap: 6px; }
  .seed { font-size: 0.82rem; border-top: 1px solid var(--border); padding-top: 6px; overflow-wrap: break-word; }
  .seed-score { color: var(--muted); font-size: 0.75rem; }
  .empty { color: var(--muted); font-size: 0.82rem; font-style: italic; margin: 8px 0 0; }
  footer { text-align:center; color: var(--muted); font-size: 0.72rem; margin: 24px 0 8px; }
</style>
</head>
<body>
<header>
  <h1>Relatorio IdeaForge</h1>
  <p class="meta">run ${esc(runId)} · criado em ${esc(createdAt)}</p>
</header>
<main>
<section class="hero">
  <div class="hero-top">
    <p class="score">${pct}</p>
    <span class="badge" style="background:${badgeColor}">${badgeLabel}</span>
  </div>
  ${svgBar(pct, "var(--accent)", 14)}
  <div class="grid">
    <div class="kv"><span class="k">projeto</span><span class="v">${project}</span></div>
    <div class="kv"><span class="k">branch</span><span class="v">${branch}</span></div>
    <div class="kv"><span class="k">origem</span><span class="v">${source}</span></div>
    <div class="kv"><span class="k">canal</span><span class="v">${channel}</span></div>
  </div>
</section>
<section class="panel">
  <h2>ASSIMETRIA / SINERGIA / ALCANCE DE CLUSTERS</h2>
  <div class="metrics">
    <div class="metric"><div class="num">${fmtPct(it.asymmetry_score)}</div><div class="label">assimetria</div></div>
    <div class="metric"><div class="num">${fmtPct(it.synergy_score)}</div><div class="label">sinergia</div></div>
    <div class="metric"><div class="num">${fmtInt(it.cluster_reach)}</div><div class="label">alcance de clusters</div></div>
  </div>
  ${seedsHtml}
</section>
</main>
<footer>IdeaForge — relatorio gerado a partir da memoria permanente (Supabase)</footer>
</body>
</html>`;
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
}

/**
 * Handler serverless (Vercel Node function). Publico por desenho — e um
 * relatorio de leitura, sem dado sensivel de sistema, sem escrita. GET-only.
 * Nunca lanca: falha interna devolve resposta generica (F5).
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return sendHtml(res, 405, "metodo nao permitido");

    const { searchParams } = new URL(req.url || "", "http://x");
    const runId = pickRunId(searchParams);
    if (!runId) return sendHtml(res, 400, "run id ausente");

    const idea = await fetchIdea(runId);
    if (!idea) {
      return sendHtml(
        res,
        404,
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Nao encontrado</title></head>` +
          `<body><p>run nao encontrado (ou memoria desligada): ${esc(runId)}</p></body></html>`
      );
    }

    const html = renderReport({ ...idea, runId });
    return sendHtml(res, 200, html);
  } catch (err) {
    // Nunca vaza a mensagem interna (F5); loga server-side com um id de correlacao.
    const errorId = Math.random().toString(36).slice(2, 10);
    // eslint-disable-next-line no-console
    console.error(`[idea-inbox:report] errorId=${errorId}`, err instanceof Error ? err.stack : err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("relatorio indisponivel");
  }
}
