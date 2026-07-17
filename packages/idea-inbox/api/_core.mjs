// @ts-check
/**
 * Nucleo compartilhado dos handlers serverless (Vercel Node functions).
 * Endurecido pos-auditoria de seguranca (F1-F8):
 *  - assinatura fail-closed em producao (verify.mjs)
 *  - rate limit por IP (F3), request cost limitado (pipeline ate 'dispatch', F3/F7)
 *  - corpo cru fiel p/ HMAC + rejeicao de body grande (F4)
 *  - guarda de prototype pollution (F8)
 *  - erro 500 sem vazar mensagem interna (F5)
 */
import { resolve } from "../src/normalize.mjs";
import { verifySignature } from "../src/verify.mjs";
import { runSync } from "../src/pipeline-sync.mjs";
import { transcribe } from "../src/transcribe.mjs";
import { persistIdea } from "../src/store-remote.mjs";
import { enrichWithSeeds } from "../src/enrich.mjs";
import { fireRealize } from "../src/dispatch-ci.mjs";
import { newRunId } from "../src/inbox.mjs";
import { formatReply, sendTelegramReply } from "../src/reply.mjs";
import { dedupKey, stableRunId, seenRecently } from "../src/dedup.mjs";
import { meter, snapshot as costSnapshot } from "../src/cost.mjs";

export const MAX_BODY = 256 * 1024; // 256KB — teto anti-DoS
const RATE_LIMIT = Number(process.env.IDEAINBOX_RATE_LIMIT || 30); // req/janela/IP
const RATE_WINDOW_MS = 60_000;

/** Rate limiter fixed-window em memoria (best-effort; por instancia no serverless). */
const buckets = new Map();
const BUCKET_CAP = 10_000; // teto anti-crescimento de memoria (N2)
export function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.start >= RATE_WINDOW_MS) {
    if (buckets.size >= BUCKET_CAP) pruneBuckets(now);
    buckets.set(ip, { start: now, count: 1 });
    return false;
  }
  b.count++;
  return b.count > RATE_LIMIT;
}
function pruneBuckets(now) {
  for (const [k, v] of buckets) if (now - v.start >= RATE_WINDOW_MS) buckets.delete(k);
  // se ainda cheio (flood ativo), zera para nao vazar memoria
  if (buckets.size >= BUCKET_CAP) buckets.clear();
}
/**
 * IP confiavel: prioriza `x-real-ip` (setado pela plataforma, nao spoofavel pelo
 * cliente) e, no XFF, usa a entrada MAIS A DIREITA (o hop adicionado pelo proxy
 * confiavel) — nunca a mais a esquerda, que o cliente controla (N1).
 */
export function clientIp(req) {
  const h = req.headers || {};
  const real = h["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  const xff = h["x-forwarded-for"];
  if (typeof xff === "string" && xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Le o corpo cru com teto de tamanho, sinalizando se foi reconstruido/truncado.
 * @returns {Promise<{raw:string, reconstructed:boolean, truncated:boolean}>}
 */
export async function readRawBody(req) {
  if (typeof req.body === "string") return { raw: req.body, reconstructed: false, truncated: req.body.length > MAX_BODY };
  if (req.body && Buffer.isBuffer(req.body)) {
    const s = req.body.toString("utf8");
    return { raw: s, reconstructed: false, truncated: s.length > MAX_BODY };
  }
  if (req.body && typeof req.body === "object") {
    // corpo ja parseado pela plataforma: bytes originais perdidos -> reconstruido.
    return { raw: JSON.stringify(req.body), reconstructed: true, truncated: false };
  }
  return await new Promise((resolveP) => {
    let data = "";
    let truncated = false;
    req.on("data", (c) => {
      if (truncated) return;
      data += c;
      if (data.length > MAX_BODY) {
        truncated = true;
      }
    });
    req.on("end", () => resolveP({ raw: data, reconstructed: false, truncated }));
    req.on("error", () => resolveP({ raw: data, reconstructed: false, truncated }));
  });
}

/**
 * Rejeita chaves perigosas apos o parse (F8/N4) — cobre escape unicode que um
 * regex sobre o texto cru nao pega (ex: "__proto__").
 */
const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
export function hasDangerousKeys(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return false;
  for (const k of Object.keys(obj)) {
    if (DANGEROUS.has(k)) return true;
    if (hasDangerousKeys(obj[k], depth + 1)) return true;
  }
  return false;
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(obj));
  // eslint-disable-next-line no-console
  console.log(`[idea-inbox:serverless] ${new Date().toISOString()} -> ${status} runId=${obj.runId || "-"}`);
}

/**
 * Handler generico para um canal.
 * @param {"telegram"|"whatsapp"|"generic"} channel
 */
export function makeHandler(channel) {
  return async function handler(req, res) {
    try {
      if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

      if (rateLimited(clientIp(req))) return send(res, 429, { error: "rate limit excedido" });

      const { raw, reconstructed, truncated } = await readRawBody(req);
      if (truncated) return send(res, 413, { error: "payload muito grande" });

      // 1) verificacao de assinatura (fail-closed em prod; HMAC exige corpo fiel)
      if (!verifySignature(channel, req, raw, { reconstructed })) return send(res, 401, { error: "nao autorizado" });

      // 2) parse seguro + guarda de prototype pollution (pos-parse, N4)
      let payload;
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        return send(res, 400, { error: "json invalido" });
      }
      if (hasDangerousKeys(payload)) return send(res, 400, { error: "payload rejeitado" });

      // 3) normaliza
      const norm = resolve(channel)(payload);
      const rawText = (norm.text || "").trim();

      // 3a) idempotencia (T4.2): Telegram/WhatsApp reenviam o MESMO webhook em
      //     timeout — sem dedup, cada retry roda o pipeline + persist + CI de
      //     novo. Chave estavel (id nativo do canal ou hash do conteudo) ->
      //     runId deterministico (mesma chave -> mesmo runId sempre). Se ja
      //     vimos esta chave na janela recente, devolve o MESMO runId sem
      //     rodar nada de novo (no-op idempotente, 200).
      const dedup = dedupKey(channel, payload, norm);
      const stableId = stableRunId(dedup);
      if (seenRecently(dedup)) return send(res, 200, { accepted: true, deduped: true, runId: stableId });

      // 3b) voz -> texto (best-effort, nunca lanca). Passthrough sem rede se ja
      //     houver texto; so busca/transcreve audio quando necessario (F3/F7).
      const tr = await transcribe({ source: norm.source || channel, audioRef: norm.audioRef, text: rawText });
      const finalText = rawText || tr.text;

      if (!finalText && !norm.audioRef) return send(res, 422, { accepted: false, reason: "sem texto nem audio" });
      if (!finalText && norm.audioRef) {
        // audio recebido mas STT indisponivel/nao configurado: nao roda o
        // pipeline em texto vazio, mas confirma recebimento (nunca perde a ideia).
        // Resposta best-effort no Telegram pra nao deixar o operador no silencio
        // (T0.3) — Promise.allSettled evita unhandled rejection mesmo em falha.
        const noSttMsg = "recebi seu audio, mas a transcricao nao esta ligada ainda — manda em texto por enquanto 🙏";
        const [noSttReplySettled] = await Promise.allSettled([
          channel === "telegram"
            ? sendTelegramReply(norm.meta?.chatId, noSttMsg)
            : Promise.resolve({ ok: false, via: "canal-nao-telegram" }),
        ]);
        const noSttReply = noSttReplySettled.status === "fulfilled" ? noSttReplySettled.value : undefined;
        return send(res, 202, {
          accepted: true,
          runId: newRunId(),
          channel,
          source: norm.source || channel,
          audio: norm.audioRef,
          transcription: tr.via,
          reply: noSttReply?.via,
          note: "audio recebido; transcricao indisponivel",
        });
      }

      // 4) roda o pipeline BOUNDED (ingest..dispatch) — captura + validacao rapida.
      //    A simulacao E2E pesada (99.9%) + RETROFORJA rodam no laco assincrono
      //    (idea-forge realize / CI), nao no endpoint publico. (F3/F7)
      const result = await runSync({ source: norm.source || channel, text: finalText, audioRef: norm.audioRef, runId: stableId });
      meter("pipeline_runs"); // governanca de custo (B.1) — observabilidade do volume de runs

      // 4b) enriquecimento best-effort: ASSIMETRIA/SINERGIA contra o seed bank
      //     do operador (packages/idea-forge/src/seeds). Nunca bloqueia — sem
      //     Supabase/seeds configurados, devolve campos nulos (F3/F7).
      const enrichment = await enrichWithSeeds(finalText);

      // 5) efeitos colaterais best-effort (memoria permanente + fecha o laco na
      //    CI + resposta no canal, T0.3) — nunca bloqueiam nem quebram a
      //    resposta 202 (Promise.allSettled).
      const [memSettled, ciSettled, replySettled] = await Promise.allSettled([
        persistIdea({
          run_id: result.runId,
          source: norm.source || channel,
          channel,
          text: finalText.slice(0, 4000),
          score: result.score,
          project: result.project,
          branch: result.branch,
          blocked: result.blocked,
          created_at: new Date().toISOString(),
          ...enrichment,
        }),
        fireRealize({ runId: result.runId, idea: finalText, score: result.score }),
        channel === "telegram"
          ? sendTelegramReply(norm.meta?.chatId, formatReply({ result, enrichment, transcription: tr.via }))
          : Promise.resolve({ ok: false, via: "canal-nao-telegram" }),
      ]);
      const memResult = memSettled.status === "fulfilled" ? memSettled.value : undefined;
      const ciResult = ciSettled.status === "fulfilled" ? ciSettled.value : undefined;
      const replyResult = replySettled.status === "fulfilled" ? replySettled.value : undefined;

      return send(res, 202, {
        accepted: true,
        ...result,
        transcription: tr.via,
        stored: memResult?.ok ?? false,
        memory: memResult?.via,
        ci: ciResult?.via,
        reply: replyResult?.via,
        ...enrichment,
      });
    } catch (err) {
      // Nunca vaza a mensagem interna (F5); loga server-side com um id de correlacao.
      const errorId = Math.random().toString(36).slice(2, 10);
      // eslint-disable-next-line no-console
      console.error(`[idea-inbox:serverless] errorId=${errorId}`, err instanceof Error ? err.stack : err);
      return send(res, 500, { error: "falha interna", errorId });
    }
  };
}

export function healthHandler(_req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  // B.1: expoe o snapshot de custo (pipeline_runs/ci_fires/ci_capped) no
  // /health existente — observabilidade sem precisar de rota nova.
  res.end(JSON.stringify({ ok: true, service: "idea-inbox", ts: new Date().toISOString(), cost: costSnapshot() }));
}

export default {
  makeHandler,
  healthHandler,
  readRawBody,
  hasDangerousKeys,
  rateLimited,
  clientIp,
  MAX_BODY,
};
