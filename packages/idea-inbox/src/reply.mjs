// @ts-check
/**
 * Resposta curta pro canal (Telegram) apos o pipeline rodar — T0.3 "mata o
 * silencio": o operador manda uma ideia por voz/texto e recebe confirmacao
 * imediata (score + branch + eventual match de seed) em vez de silencio ate
 * o CI terminar. Best-effort e nunca lanca (Constitution "no backend = no
 * blocker" — mesma politica de src/store-remote.mjs e src/dispatch-ci.mjs).
 */

const FETCH_TIMEOUT_MS = 5_000;
const MAX_LEN = 800;

/** @param {unknown} err */
function shortMsg(err) {
  const m = err instanceof Error ? err.message : String(err);
  return m.slice(0, 160);
}

/**
 * Monta o texto de resposta a partir do resultado do pipeline + enriquecimento
 * de seeds (`enrichWithSeeds`, src/enrich.mjs). Tolerante a campos ausentes ou
 * nulos em qualquer nivel — nunca lanca. Saida sempre < 800 chars.
 * @param {{result?:Record<string, unknown>|null, enrichment?:Record<string, unknown>|null, transcription?:string|null}} [input]
 * @returns {string}
 */
export function formatReply(input = {}) {
  const r = (input && input.result) || {};
  const e = (input && input.enrichment) || {};

  const project = typeof r.project === "string" && r.project ? r.project : "ideia";
  const score = typeof r.score === "number" ? r.score : null;
  const passed = r.passed === true;
  const blocked = r.blocked === true;
  const branch = typeof r.branch === "string" && r.branch ? r.branch : null;

  const badge = blocked ? "🚫" : passed ? "✅" : "⚠️";
  const scoreTxt = score !== null ? `${score}/100` : "sem score";

  const lines = [`🔨 ${project} — score ${scoreTxt} ${badge}`];
  lines.push(branch ? `branch: ${branch}` : "branch: sem dispatch (bloqueado ou abaixo do gate)");

  const matched = Array.isArray(e.matched_seeds) ? e.matched_seeds : [];
  if (matched.length) {
    const top = matched
      .slice(0, 2)
      .map((m) => (m && typeof m === "object" ? String(m.titulo || m.id || "seed") : "seed"))
      .join(", ");
    const synergy = typeof e.synergy_score === "number" ? e.synergy_score : "?";
    const asymmetry = typeof e.asymmetry_score === "number" ? e.asymmetry_score : "?";
    lines.push(`🌱 combina com: ${top} (sinergia ${synergy}, assimetria ${asymmetry})`);
  }

  const transcription = input && input.transcription;
  if (transcription && transcription !== "passthrough") lines.push(`(via: ${transcription})`);

  const text = lines.join("\n");
  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN - 1)}…` : text;
}

/**
 * Envia a resposta ao Telegram (Bot API `sendMessage`), best-effort. Sem
 * `TELEGRAM_BOT_TOKEN` configurado ou sem `chatId`, nao tenta rede — devolve
 * `{ok:false, via:"reply-desligado"}`. Nunca lanca.
 * @param {string|number|null|undefined} chatId
 * @param {string} text
 * @returns {Promise<{ok:boolean, via:string}>}
 */
export async function sendTelegramReply(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || chatId === null || chatId === undefined || chatId === "") {
    return { ok: false, via: "reply-desligado" };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { ok: false, via: `telegram-http-${res.status}` };
    return { ok: true, via: "telegram" };
  } catch (err) {
    return { ok: false, via: `telegram-falhou:${shortMsg(err)}` };
  }
}

export default { formatReply, sendTelegramReply };
