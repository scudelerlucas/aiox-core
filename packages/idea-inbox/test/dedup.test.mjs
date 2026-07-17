// @ts-check
/**
 * Testes de T4.2 (idempotencia/dedup — src/dedup.mjs + wiring em api/_core.mjs).
 * Cobre: chave estavel por delivery nativo (telegram/whatsapp), fallback por
 * hash de conteudo, runId deterministico, janela "ja vi isso" e o
 * comportamento fim-a-fim do handler (retry identico -> deduped:true, MESMO
 * runId, sem re-rodar o pipeline).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dedupKey, stableRunId, seenRecently } from "../src/dedup.mjs";

process.env.IDEAFORGE_OFFLINE = "1";
process.env.IDEAFORGE_DIR = mkdtempSync(join(tmpdir(), "inbox-dedup-"));

const { makeHandler } = await import("../api/_core.mjs");

function mockRes() {
  return {
    statusCode: 0,
    headers: /** @type {Record<string,string>} */ ({}),
    body: "",
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(b) {
      this.body = b || "";
    },
    json() {
      return JSON.parse(this.body || "{}");
    },
  };
}
let ipSeq = 0;
function mockReq(method, body, headers = {}, ip) {
  return { method, headers: { "x-forwarded-for": ip || `10.1.0.${++ipSeq}`, ...headers }, body };
}

test("dedupKey: telegram usa chatId+messageId nativos (estavel entre chamadas)", () => {
  const payload = { message: { message_id: 42, chat: { id: 7 }, text: "oi" } };
  const norm = { text: "oi", audioRef: null };
  const k1 = dedupKey("telegram", payload, norm);
  const k2 = dedupKey("telegram", payload, norm);
  assert.equal(k1, k2);
  assert.match(k1, /^telegram:7:42$/);
});

test("dedupKey: telegram sem message_id/chat cai no fallback por hash (nao lanca, nao-vazio)", () => {
  const k = dedupKey("telegram", { message: { text: "sem ids" } }, { text: "sem ids", audioRef: null });
  assert.ok(k.length > 0);
  assert.match(k, /^telegram:hash:[0-9a-f]{64}$/);
});

test("dedupKey: whatsapp usa o id nativo da mensagem", () => {
  const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.ABC123", text: { body: "oi" } }] } }] }] };
  const k = dedupKey("whatsapp", payload, { text: "oi", audioRef: null });
  assert.equal(k, "whatsapp:wamid.ABC123");
});

test("dedupKey: canal generico sem id nativo -> hash estavel do texto", () => {
  const k1 = dedupKey("generic", { text: "mesma ideia" }, { text: "mesma ideia", audioRef: null });
  const k2 = dedupKey("generic", { text: "mesma ideia" }, { text: "mesma ideia", audioRef: null });
  const k3 = dedupKey("generic", { text: "ideia diferente" }, { text: "ideia diferente", audioRef: null });
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test("dedupKey: payload hostil (null/undefined/circular-ish) nunca lanca", () => {
  assert.doesNotThrow(() => dedupKey("telegram", null, undefined));
  assert.doesNotThrow(() => dedupKey("whatsapp", {}, {}));
  assert.doesNotThrow(() => dedupKey("generic", undefined, null));
  const k = dedupKey("telegram", null, undefined);
  assert.ok(typeof k === "string" && k.length > 0);
});

test("stableRunId: deterministico (mesma chave -> mesmo runId) e formatado ib-<16 hex>", () => {
  const key = "telegram:7:42";
  const id1 = stableRunId(key);
  const id2 = stableRunId(key);
  assert.equal(id1, id2);
  assert.match(id1, /^ib-[0-9a-f]{16}$/);
  assert.notEqual(stableRunId("outra-chave"), id1);
});

test("seenRecently: false na 1a vez, true na 2a (dentro da janela)", () => {
  const key = `seen-test-${Date.now()}-${Math.random()}`;
  assert.equal(seenRecently(key), false);
  assert.equal(seenRecently(key), true);
  assert.equal(seenRecently(key), true, "continua true em chamadas subsequentes na janela");
});

test("handler: retry identico do MESMO update telegram -> 2a resposta e 200 deduped:true com o MESMO runId da 1a", async () => {
  const chatId = 555111;
  const messageId = 909;
  const payload = {
    message: {
      message_id: messageId,
      chat: { id: chatId },
      from: { username: "lucas" },
      text: "ideia repetida via retry de webhook com fallback e relatorio",
    },
  };
  const body = JSON.stringify(payload);

  const res1 = mockRes();
  await makeHandler("telegram")(mockReq("POST", body), res1);
  assert.equal(res1.statusCode, 202, "1a entrega roda o pipeline normalmente");
  const j1 = res1.json();
  assert.equal(j1.accepted, true);
  assert.ok(j1.runId);
  assert.notEqual(j1.deduped, true);

  const res2 = mockRes();
  await makeHandler("telegram")(mockReq("POST", body), res2);
  assert.equal(res2.statusCode, 200, "retry identico -> 200 (idempotente, sem re-rodar)");
  const j2 = res2.json();
  assert.equal(j2.accepted, true);
  assert.equal(j2.deduped, true);
  assert.equal(j2.runId, j1.runId, "mesmo runId no retry — nao duplica o run");
});

test("handler: payloads DIFERENTES (message_id distinto) nao sao deduplicados entre si", async () => {
  const chatId = 555222;
  const base = { chat: { id: chatId }, from: { username: "lucas" } };
  const p1 = { message: { ...base, message_id: 1, text: "primeira ideia distinta com fallback e relatorio" } };
  const p2 = { message: { ...base, message_id: 2, text: "segunda ideia distinta com fallback e relatorio" } };

  const res1 = mockRes();
  await makeHandler("telegram")(mockReq("POST", JSON.stringify(p1)), res1);
  const res2 = mockRes();
  await makeHandler("telegram")(mockReq("POST", JSON.stringify(p2)), res2);

  assert.equal(res1.statusCode, 202);
  assert.equal(res2.statusCode, 202, "delivery diferente nao e tratado como retry");
  assert.notEqual(res1.json().runId, res2.json().runId);
});
