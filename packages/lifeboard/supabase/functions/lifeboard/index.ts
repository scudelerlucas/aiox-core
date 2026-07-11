import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// OS-LIFEBOARD — status ao vivo (Supabase Edge Function, público e seguro).
//
// Deployado no projeto real hciiilopyivjaekaxfqp em 2026-07-09 (version 2).
// URL pública: https://hciiilopyivjaekaxfqp.supabase.co/functions/v1/lifeboard
//
// Lê SOMENTE métricas agregadas via a RPC `lifeboard_stats` (counts-only, sem
// conteúdo privado, sem service_role). Nenhum título de tarefa nem label pessoal
// é exposto publicamente. O dashboard completo (conteúdo das tarefas) fica no
// deploy gated (Vercel — ver DEPLOY.md).
//
// verify_jwt=false: acessível por browser sem JWT (superfície pública), mas só
// serve dados NÃO sensíveis (contagens). Decisão de segurança consciente: a v1
// (com view de conteúdo privado atrás de token) foi substituída por esta v2
// aggregate-only após o gate de segurança sinalizar exposição de dado pessoal.

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const C = { navy: "#0A1628", bone: "#F5F2EC", gold: "#A8895A", card: "#0F1E33", border: "#1E3350", muted: "#8593A8", green: "#4FA97B", red: "#CF5C48" };

function shell(inner: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OS-LIFEBOARD — ALMA PETRA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:${C.navy};color:${C.bone};font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}main{max-width:820px;margin:0 auto;padding:56px 22px}code{color:${C.gold};font-family:ui-monospace,monospace}</style></head><body><main>${inner}</main></body></html>`;
}
function stat(label: string, value: string | number, accent?: string): string {
  return `<div style="background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:20px 24px;min-width:150px;flex:1 1 150px"><div style="font-size:38px;font-weight:700;color:${accent || C.bone};line-height:1">${value}</div><div style="font-size:12px;color:${C.muted};margin-top:7px">${label}</div></div>`;
}

Deno.serve(async () => {
  let stats: Record<string, unknown> | null = null;
  let error: string | null = null;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/lifeboard_stats`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) throw new Error(`stats HTTP ${r.status}`);
    stats = await r.json();
  } catch (e) {
    error = String(e);
  }

  const ok = !error && stats;
  const syncAt = stats && stats.lastSyncAt ? new Date(String(stats.lastSyncAt)).toLocaleString("pt-BR") : "—";

  let body = `<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><h1 style="font-size:30px;font-weight:800;letter-spacing:1px">ALMA PETRA</h1><span style="color:${C.gold};font-family:monospace;font-size:14px">OS-LIFEBOARD</span></div>`;
  body += `<p style="color:${C.muted};margin-top:8px;font-size:15px">Status da conexão ao vivo.</p>`;
  body += `<div style="margin-top:26px;display:inline-flex;align-items:center;gap:9px;background:${ok ? "rgba(79,169,123,.12)" : "rgba(207,92,72,.12)"};border:1px solid ${ok ? C.green : C.red};color:${ok ? C.green : C.red};border-radius:999px;padding:7px 15px;font-size:13px;font-weight:600"><span style="width:8px;height:8px;border-radius:999px;background:currentColor"></span>${ok ? "Conectado ao Supabase — fontes reais" : "Sem conexão"}</div>`;

  if (ok) {
    body += `<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:26px">` +
      stat("Tarefas reais", String(stats!.taskCount ?? "—"), C.gold) +
      stat("Fontes conectadas", String(stats!.sourceCount ?? "—")) +
      stat("Acionáveis", String(stats!.openToday ?? "—")) +
      stat("Último sync OK", stats!.lastSyncOk ? "Sim" : "Não", stats!.lastSyncOk ? C.green : C.red) +
      `</div>`;
    body += `<div style="margin-top:20px;font-size:13px;color:${C.muted}">Último sync: ${syncAt}</div>`;
  } else {
    body += `<pre style="margin-top:24px;color:${C.red};font-size:13px">${error}</pre>`;
  }

  body += `<div style="margin-top:42px;padding:20px 22px;background:${C.card};border:1px solid ${C.border};border-radius:14px;font-size:14px;line-height:1.6;color:#B8C4D6"><strong style="color:${C.bone}">Esta página está ao vivo e conectada às fontes reais</strong> (Google Calendar ingerido no Supabase). Por segurança, mostra apenas métricas agregadas — nenhum conteúdo privado das tarefas é exposto publicamente.<br><br>O <strong style="color:${C.gold}">dashboard completo</strong> (grafo + lista "hoje" com o conteúdo das tarefas, protegido por senha) sobe com 4 variáveis de ambiente na Vercel — ver <code>packages/lifeboard/DEPLOY.md</code>.</div>`;
  body += `<div style="margin-top:26px;font-size:12px;color:#5A6B84">servido de Supabase Edge · ALMA PETRA · Julho 2026</div>`;

  return new Response(shell(body), { status: ok ? 200 : 503, headers: { "content-type": "text/html; charset=utf-8" } });
});
