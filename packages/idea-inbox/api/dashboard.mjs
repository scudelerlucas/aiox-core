// @ts-check
/**
 * Dashboard de progresso do roadmap IdeaForge — pagina HTML auto-contida
 * (sem JS/CSS/libs externos), publica (e um board de progresso, sem dado
 * sensivel, sem auth por desenho). Le `roadmap.json` do disco e renderiza o
 * progresso geral + leitura impacto x esforco agrupada por tier.
 * `renderDashboard` e uma funcao pura (sem I/O) para ser testavel sem HTTP.
 */
import { readFileSync } from "node:fs";

/** @type {Record<string, {label:string, color:string}>} */
const STATUS_META = {
  done: { label: "concluido", color: "#16a34a" },
  in_progress: { label: "em execucao", color: "#2563eb" },
  planned: { label: "planejado", color: "#6b7280" },
  needs_user: { label: "precisa de voce", color: "#d97706" },
  blocked: { label: "bloqueado", color: "#dc2626" },
};
const STATUS_ORDER = /** @type {const} */ (["done", "in_progress", "planned", "needs_user", "blocked"]);

/**
 * Escapa texto p/ HTML (XSS-safe) — todo valor vindo do JSON passa por aqui
 * antes de entrar no markup.
 * @param {unknown} v
 * @returns {string}
 */
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

/**
 * Barra de progresso horizontal, SVG inline (sem libs). `viewBox` 0-100 no
 * eixo X deixa a largura do retangulo preenchido igual ao percentual.
 * @param {number} pct @param {string} color @param {number} [height]
 */
function svgBar(pct, color, height = 14) {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const r = height / 2;
  return (
    `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" class="bar" role="img" aria-label="${p}% concluido">` +
    `<rect x="0" y="0" width="100" height="${height}" rx="${r}" class="bar-bg"></rect>` +
    `<rect x="0" y="0" width="${p}" height="${height}" rx="${r}" fill="${color}"></rect>` +
    `</svg>`
  );
}

/** @param {Record<string, unknown>} it @returns {{key:string, label:string, color:string}} */
function statusMeta(it) {
  const key = typeof it.status === "string" && STATUS_META[it.status] ? it.status : "planned";
  return { key, ...STATUS_META[key] };
}

/** Uma linha de item do roadmap: id, titulo, disciplina, impacto/esforco, badge de status. */
function itemRow(it) {
  const meta = statusMeta(it);
  const note = typeof it.note === "string" && it.note ? `<div class="note">${esc(it.note)}</div>` : "";
  return (
    `<div class="row">` +
    `<div class="row-top">` +
    `<span class="rid">${esc(it.id)}</span>` +
    `<span class="rtitle">${esc(it.title)}</span>` +
    `<span class="badge" data-status="${esc(meta.key)}" style="background:${meta.color}">${esc(meta.label)}</span>` +
    `</div>` +
    `<div class="row-bottom">` +
    `<span class="disc">${esc(it.discipline)}</span>` +
    `<span class="ie">impacto ${esc(it.impact)} · esforco ${esc(it.effort)}</span>` +
    `</div>` +
    note +
    `</div>`
  );
}

/** Secao de um tier: cabecalho + barra done/total do tier + linhas dos itens. */
function tierSection(tier, items) {
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    `<section class="tier">` +
    `<div class="tier-head"><h2>Tier ${esc(tier)}</h2><span class="tier-count">${done}/${total}</span></div>` +
    svgBar(pct, "var(--accent)", 8) +
    `<div class="rows">${items.map(itemRow).join("")}</div>` +
    `</section>`
  );
}

/**
 * Gera a pagina HTML do dashboard a partir do `roadmap.json` (shape:
 * `{title, subtitle, updatedAt, round, legend, items:[{id,tier,title,
 * discipline,impact,effort,status,note}]}`). Pura — sem I/O — testavel
 * diretamente. Nunca lanca: dados ausentes/malformados viram defaults seguros.
 * @param {Record<string, any>} roadmap
 * @returns {string}
 */
export function renderDashboard(roadmap) {
  const r = roadmap && typeof roadmap === "object" ? roadmap : {};
  const items = Array.isArray(r.items) ? r.items : [];
  const total = items.length;

  const counts = { done: 0, in_progress: 0, planned: 0, needs_user: 0, blocked: 0 };
  for (const it of items) {
    const key = statusMeta(it || {}).key;
    counts[key] = (counts[key] || 0) + 1;
  }
  const done = counts.done;
  const pct = total ? Math.round((done / total) * 100) : 0;

  /** @type {Map<number, any[]>} */
  const byTier = new Map();
  for (const it of items) {
    const t = Number.isFinite(it?.tier) ? it.tier : 0;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t).push(it || {});
  }
  const tierKeys = [...byTier.keys()].sort((a, b) => a - b);

  const statusChips = STATUS_ORDER.map(
    (k) =>
      `<div class="chip"><span class="dot" style="background:${STATUS_META[k].color}"></span>${esc(STATUS_META[k].label)}: <strong>${counts[k]}</strong></div>`
  ).join("");

  const tiersHtml = tierKeys.map((t) => tierSection(t, byTier.get(t) || [])).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title || "IdeaForge Roadmap")}</title>
<style>
  :root { color-scheme: light dark; --bg:#f8fafc; --fg:#0f172a; --card:#ffffff; --border:#e2e8f0; --muted:#64748b; --accent:#2563eb; --bar-bg:#e2e8f0; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0b1220; --fg:#e2e8f0; --card:#111827; --border:#1f2937; --muted:#94a3b8; --accent:#60a5fa; --bar-bg:#1f2937; }
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body {
    background:var(--bg); color:var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 16px; max-width: 820px; margin: 0 auto;
    overflow-x: hidden;
  }
  header h1 { font-size: 1.3rem; margin: 0 0 4px; word-break: break-word; }
  header p.subtitle { margin: 0 0 4px; color: var(--muted); font-size: 0.9rem; }
  header p.meta { margin: 0 0 16px; color: var(--muted); font-size: 0.78rem; }
  .overall { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .overall .pct { font-size: 2.2rem; font-weight: 700; margin: 0 0 8px; }
  .bar { width: 100%; height: auto; display: block; }
  .bar-bg { fill: var(--bar-bg); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .chip { font-size: 0.78rem; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; display:flex; align-items:center; gap:6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display:inline-block; flex: none; }
  .tier { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .tier-head { display:flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; gap: 8px; }
  .tier-head h2 { font-size: 1rem; margin: 0; }
  .tier-count { color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
  .rows { margin-top: 10px; display:flex; flex-direction: column; gap: 8px; }
  .row { border-top: 1px solid var(--border); padding-top: 8px; }
  .row-top { display:flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .rid { font-family: ui-monospace, Menlo, monospace; font-size: 0.75rem; color: var(--muted); flex: none; }
  .rtitle { font-size: 0.92rem; font-weight: 600; flex: 1 1 160px; min-width: 0; overflow-wrap: break-word; }
  .badge { font-size: 0.7rem; color: #fff; padding: 2px 8px; border-radius: 999px; white-space: nowrap; flex: none; }
  .row-bottom { display:flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; font-size: 0.78rem; color: var(--muted); }
  .note { margin-top: 4px; font-size: 0.78rem; color: var(--muted); font-style: italic; overflow-wrap: break-word; }
  footer { text-align:center; color: var(--muted); font-size: 0.72rem; margin: 24px 0 8px; }
</style>
</head>
<body>
<header>
  <h1>${esc(r.title || "Roadmap")}</h1>
  <p class="subtitle">${esc(r.subtitle || "")}</p>
  <p class="meta">rodada ${esc(r.round ?? "-")} · atualizado em ${esc(r.updatedAt ?? "-")}</p>
</header>
<main>
<section class="overall">
  <div class="pct">${pct}%</div>
  ${svgBar(pct, "var(--accent)", 14)}
  <div class="chips">${statusChips}</div>
</section>
${tiersHtml}
</main>
<footer>IdeaForge — dashboard gerado a partir de roadmap.json (${total} itens)</footer>
</body>
</html>`;
}

/**
 * Handler serverless (Vercel Node function). Publico por desenho — e um
 * board de progresso, sem dado sensivel, sem escrita. Nunca lanca: falha de
 * leitura/parse devolve 500 com mensagem generica (F5 — sem vazar detalhe interno).
 * @param {import("node:http").IncomingMessage} _req
 * @param {import("node:http").ServerResponse} res
 */
export default function handler(_req, res) {
  try {
    const raw = readFileSync(new URL("../roadmap.json", import.meta.url), "utf8");
    const roadmap = JSON.parse(raw);
    const html = renderDashboard(roadmap);
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("dashboard indisponivel");
  }
}
