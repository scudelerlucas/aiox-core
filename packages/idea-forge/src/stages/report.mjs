// @ts-check
/**
 * Estagio REPORT: relatorio final grafico (HTML autocontido com SVG inline,
 * zero libs) + guia em linguagem simples de "como usar o novo sistema".
 * Observability Third (UI): apenas observa/comunica o que a CLI produziu.
 */
import { PERCENTILE_TARGET, SCORE_GATE } from "../types.mjs";

/** @param {import("../types.mjs").PipelineState} state @param {{store?:any}} ctx */
export async function report(state, ctx) {
  const html = generateReportHtml(state);
  const guide = generateGuide(state);
  let reportPath = "(memoria)";
  let guidePath = "(memoria)";
  if (ctx?.store) {
    reportPath = ctx.store.writeArtifact(state.runId, "RELATORIO.html", html);
    guidePath = ctx.store.writeArtifact(state.runId, "COMO-USAR.md", guide);
  }
  state.log.push(`[report] relatorio HTML + guia gerados`);
  return { report: { reportPath, guidePath } };
}

/** @param {import("../types.mjs").PipelineState} state */
export function generateReportHtml(state) {
  const bp = state.blueprint;
  const sc = state.scored;
  const sim = state.simulation;
  const rf = state.retroforja;
  const ster = state.steroided;

  const scoreBars = barChart([
    { label: "Clareza", value: sc.breakdown.clarity },
    { label: "Rastreab.", value: sc.breakdown.traceability },
    { label: "Arquitet.", value: sc.breakdown.architecture },
    { label: "Testab.", value: sc.breakdown.testability },
    { label: "Antifrag.", value: sc.breakdown.antifragility },
  ], 100);

  const simLine = lineChart(sim.history.map((h) => h.percentile), PERCENTILE_TARGET, "percentil %");

  const rfBars = barChart(
    rf.cycles.map((c) => ({ label: c.metric.slice(0, 8), value: Math.min(100, Math.abs(c.delta) * 100 || 1) })),
    100,
    "delta"
  );

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IdeaForge — ${esc(bp.name)}</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--fg:#e6edf3;--muted:#8b949e;--ok:#3fb950;--warn:#d29922;--bad:#f85149;--accent:#58a6ff}
@media(prefers-color-scheme:light){:root{--bg:#f6f8fa;--card:#fff;--fg:#1f2328;--muted:#656d76;--accent:#0969da}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
.wrap{max-width:860px;margin:0 auto;padding:28px 20px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 10px;border-bottom:1px solid #30363d55;padding-bottom:6px}
.sub{color:var(--muted);margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.kpi{background:var(--card);border:1px solid #30363d44;border-radius:10px;padding:14px}
.kpi .n{font-size:26px;font-weight:700}.kpi .l{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.card{background:var(--card);border:1px solid #30363d44;border-radius:10px;padding:16px;margin-top:12px;overflow-x:auto}
.tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:600}
.ok{background:#3fb95022;color:var(--ok)}.warn{background:#d2992222;color:var(--warn)}.bad{background:#f8514922;color:var(--bad)}
ul{margin:6px 0;padding-left:20px}li{margin:3px 0}code{background:#6e768133;padding:1px 5px;border-radius:5px;font-size:13px}
.muted{color:var(--muted)}
</style></head><body><div class="wrap">
<h1>🔨 IdeaForge — ${esc(bp.name)}</h1>
<p class="sub">Da ideia falada ao projeto validado. Run <code>${esc(state.runId)}</code> · capturado via <b>${esc(state.raw?.source || "texto")}</b> · ${esc(state.createdAt)}</p>

<div class="grid">
  ${kpi("Score", `${sc.score}`, sc.passed ? "ok" : "warn", `/100 · gate ${SCORE_GATE}`)}
  ${kpi("Confianca", `${sc.confidence}`, sc.confidence >= 80 ? "ok" : "warn", "/100")}
  ${kpi("Percentil E2E", `${sim.percentile}%`, sim.reachedTarget ? "ok" : "warn", `alvo ${PERCENTILE_TARGET}%`)}
  ${kpi("RETROFORJA-P", `${rf.backwardScore}`, rf.backwardScore >= 80 ? "ok" : "warn", `dados ${rf.dataSource}`)}
</div>

<h2>A ideia, destilada</h2>
<div class="card">
  <p><b>Tese (Occam):</b> ${esc(strip(ster.op3lif.occam))}</p>
  <p><b>Tese afiada:</b> ${esc(state.brainstormed.sharpenedThesis)}</p>
  <p class="muted">Sinal/Ruido apos brainstorm: <b>${state.brainstormed.signalToNoise}/100</b> · Confianca do esteroide: <b>${ster.confidence}/100</b></p>
</div>

<h2>Qualidade do blueprint (gate 95+)</h2>
<div class="card">${scoreBars}
<p class="muted">Self-heal: ${sc.iterations} ciclo(s). ${sc.passed ? '<span class="tag ok">APROVADO</span>' : '<span class="tag warn">GAPS: ' + esc(sc.gaps.join("; ")) + "</span>"}</p></div>

<h2>Simulacao E2E — convergencia ao percentil 99.9%</h2>
<div class="card">${simLine}
<p class="muted">${sim.iterations} iteracoes · ${sim.fixedBreaks.length} quebras de fluxo corrigidas:</p>
<ul>${sim.fixedBreaks.map((b) => `<li>${esc(b)}</li>`).join("") || "<li>nenhuma</li>"}</ul></div>

<h2>RETROFORJA-P — validacao de tras para frente</h2>
<div class="card">
<p class="muted">Fonte de dados: <b>${rf.dataSource}</b> (confianca ${rf.dataConfidence}%). Ciclos predicao→resultado→delta:</p>
${rfBars}
<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
<tr class="muted"><td>Metrica</td><td>Predicao</td><td>Resultado</td><td>Delta</td><td>Diagnostico</td></tr>
${rf.cycles.map((c) => `<tr><td>${esc(c.metric)}</td><td>${c.prediction}</td><td>${c.result}</td><td>${c.delta}</td><td><span class="tag ${c.diagnosis === "ok" ? "ok" : c.diagnosis === "arquitetural" ? "bad" : "warn"}">${c.diagnosis}</span></td></tr>`).join("")}
</table>
<ul>${rf.adjustments.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>

<h2>Modos de fracasso vacinados (OP3LIF + AF)</h2>
<div class="card"><ul>${ster.failureModes.map((f) => `<li><b>${esc(f.id)} ${esc(f.name)}</b>${f.lethal ? ' <span class="tag bad">letal</span>' : ""} — <span class="muted">${esc(f.vaccine)}</span></li>`).join("") || "<li>nenhum</li>"}</ul></div>

<h2>Dispatch para o Claude Code</h2>
<div class="card">
<p>Branch: <code>${esc(state.dispatch.branch)}</code> · Deploy: ${esc(state.dispatch.deployTargets.join(", "))} · ${state.dispatch.blocked ? '<span class="tag bad">BLOQUEADO</span>' : '<span class="tag ok">LIBERADO</span>'}</p>
<p class="muted">${esc(state.dispatch.note)}</p>
<p class="muted">Artefatos: <code>PRD.md</code>, <code>ARCHITECTURE.md</code>, <code>KICKOFF.md</code> no diretorio do run.</p>
</div>

<p class="sub" style="margin-top:28px">Gerado pelo Sistema Agentico de Ideias (IdeaForge) · CLI First · fluxo canonizado para replicacao.</p>
</div></body></html>`;
}

/** @param {import("../types.mjs").PipelineState} state */
export function generateGuide(state) {
  const bp = state.blueprint;
  const sim = state.simulation;
  const rf = state.retroforja;
  return `# Como usar o **${bp.name}** — em linguagem simples

Voce falou uma ideia. O IdeaForge transformou ela em um projeto pronto para construir. Aqui esta o que aconteceu e o que fazer agora, sem jargao.

## O que o sistema fez com a sua ideia
1. **Ouviu e limpou** — pegou o audio/texto (via ${state.raw?.source}) e separou o que importa do que era ruido.
2. **Turbinou** — passou por 3 filtros: TGM (acha o padrao que ja funciona), OP3LIF (lista como isso poderia fracassar) e Antifragilidade (transforma risco em vantagem).
3. **Arquitetou** — escreveu o PRD, a arquitetura e as tarefas (stories), tudo rastreavel — nada inventado.
4. **Avaliou** — deu uma nota de qualidade: **${state.scored.score}/100** ${state.scored.passed ? "(passou no corte de 95)" : "(ainda abaixo de 95 — veja os gaps)"}.
5. **Testou o fluxo ${sim.iterations}x** — simulou o uso de ponta a ponta ate chegar em **${sim.percentile}%** de robustez (alvo 99.9%), corrigindo ${sim.fixedBreaks.length} quebras.
6. **Validou de tras pra frente** — com dados ${rf.dataSource === "real" ? "reais" : "simulados (95% de confianca)"}, conferiu se a realidade bate com o que foi prometido: **${rf.backwardScore}/100**.

## O que fazer agora (3 passos)
1. Abra o arquivo **KICKOFF.md** — e o roteiro pronto para o Claude Code construir o projeto.
2. Rode na branch \`${bp.branch || "feat/" + bp.slug}\`. O Claude Code segue as stories em ordem.
3. Depois do deploy, o proprio sistema roda de novo a simulacao ate 99.9% e a RETROFORJA-P.

## Se algo travar
- Cada peca tem um "plano B" automatico (fallback) — se a IA cair, o sistema continua sozinho.
- O relatorio visual (**RELATORIO.html**) mostra tudo em graficos.

## Fluxos que o seu sistema vai ter
${bp.flows.map((f) => `- ${f}`).join("\n")}

---
_Este guia e o passo final do fluxo canonico. O mesmo fluxo pode ser reaplicado a qualquer nova ideia de qualquer operador._
`;
}

// ---- SVG helpers (zero libs) ----
function barChart(data, max, unit = "") {
  const W = 620, H = 40 + data.length * 34, pad = 110;
  const bars = data
    .map((d, i) => {
      const y = 24 + i * 34;
      const w = Math.max(2, ((d.value || 0) / max) * (W - pad - 60));
      const col = d.value >= 90 ? "#3fb950" : d.value >= 70 ? "#58a6ff" : d.value >= 50 ? "#d29922" : "#f85149";
      return `<text x="0" y="${y + 13}" fill="#8b949e" font-size="12">${esc(d.label)}</text>
<rect x="${pad}" y="${y}" width="${w}" height="18" rx="4" fill="${col}"/>
<text x="${pad + w + 6}" y="${y + 13}" fill="#8b949e" font-size="12">${d.value}${unit ? " " + unit : ""}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${bars}</svg>`;
}

function lineChart(values, target, unit = "") {
  const W = 620, H = 200, padL = 44, padB = 24, padT = 12;
  const n = values.length;
  const min = Math.min(...values, target) - 0.5;
  const max = Math.max(...values, target) + 0.2;
  const xs = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - 12));
  const ys = (v) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);
  const pts = values.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
  const dots = values.map((v, i) => `<circle cx="${xs(i)}" cy="${ys(v)}" r="3.5" fill="#58a6ff"/><text x="${xs(i)}" y="${ys(v) - 8}" font-size="10" fill="#8b949e" text-anchor="middle">${v}</text>`).join("");
  const ty = ys(target);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">
<line x1="${padL}" y1="${ty}" x2="${W - 12}" y2="${ty}" stroke="#3fb950" stroke-dasharray="5 4" stroke-width="1.5"/>
<text x="${W - 12}" y="${ty - 5}" font-size="10" fill="#3fb950" text-anchor="end">alvo ${target}%</text>
<polyline points="${pts}" fill="none" stroke="#58a6ff" stroke-width="2"/>${dots}
<text x="4" y="${padT + 8}" font-size="10" fill="#8b949e">${round1(max)}</text>
<text x="4" y="${H - padB}" font-size="10" fill="#8b949e">${round1(min)}</text>
<text x="${padL}" y="${H - 6}" font-size="10" fill="#8b949e">iteracoes -> ${unit}</text></svg>`;
}

function kpi(label, n, cls, sub) {
  return `<div class="kpi"><div class="l">${esc(label)}</div><div class="n"><span class="tag ${cls}" style="font-size:24px;padding:0">${esc(n)}</span></div><div class="muted" style="font-size:12px">${esc(sub)}</div></div>`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function strip(s) {
  return String(s ?? "").replace(/[#*_`]/g, "");
}
function round1(x) {
  return Math.round(x * 10) / 10;
}

export default { report, generateReportHtml, generateGuide };
