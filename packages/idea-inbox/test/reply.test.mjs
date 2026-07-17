// @ts-check
/**
 * Testes de T0.3 (resposta no Telegram — src/reply.mjs). Zero-dependencia:
 * mocka `globalThis.fetch` e restaura env/fetch apos cada teste (mesmo
 * padrao de test/upgrade.test.mjs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReply, sendTelegramReply } from "../src/reply.mjs";

const ORIGINAL_FETCH = globalThis.fetch;

/** @param {(...args:any[])=>Promise<any>} impl */
function mockFetch(impl) {
  const calls = [];
  const fn = async (...args) => {
    calls.push(args);
    return impl(...args);
  };
  fn.calls = calls;
  globalThis.fetch = /** @type {any} */ (fn);
  return fn;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
}

function okJsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

test("formatReply: string curta, nao-vazia, com o score e o badge", () => {
  const text = formatReply({
    result: { project: "meu-projeto", score: 92, passed: true, branch: "feat/meu-projeto", blocked: false },
    enrichment: { asymmetry_score: null, synergy_score: null, cluster_reach: null, matched_seeds: null },
    transcription: "passthrough",
  });
  assert.ok(text.length > 0);
  assert.ok(text.length < 800);
  assert.match(text, /92\/100/);
  assert.match(text, /✅/);
  assert.match(text, /feat\/meu-projeto/);
});

test("formatReply: campos ausentes/nulos nao lancam (result e enrichment undefined)", () => {
  const text = formatReply({});
  assert.equal(typeof text, "string");
  assert.ok(text.length > 0);
  assert.match(text, /sem score/);

  const text2 = formatReply(undefined);
  assert.equal(typeof text2, "string");
  assert.ok(text2.length > 0);
});

test("formatReply: com matched_seeds, inclui linha de sinergia/assimetria", () => {
  const text = formatReply({
    result: { project: "p", score: 80, passed: true, branch: "b" },
    enrichment: {
      asymmetry_score: 60,
      synergy_score: 45,
      cluster_reach: 2,
      matched_seeds: [
        { id: "S1", titulo: "Seed Um", cluster: "c1", similarity: 0.3 },
        { id: "S2", titulo: "Seed Dois", cluster: "c2", similarity: 0.2 },
      ],
    },
  });
  assert.match(text, /combina com/);
  assert.match(text, /Seed Um/);
  assert.match(text, /sinergia 45/);
  assert.match(text, /assimetria 60/);
});

test("formatReply: nunca excede 800 chars mesmo com nota/branch longos", () => {
  const text = formatReply({
    result: { project: "x".repeat(500), score: 10, passed: false, branch: "y".repeat(500) },
    enrichment: {},
  });
  assert.ok(text.length <= 800, `esperado <= 800, recebido ${text.length}`);
});

test("sendTelegramReply: sem TELEGRAM_BOT_TOKEN -> ok:false via reply-desligado, fetch nao chamado", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(200, {}));
  delete process.env.TELEGRAM_BOT_TOKEN;
  try {
    const out = await sendTelegramReply("12345", "oi");
    assert.equal(out.ok, false);
    assert.equal(out.via, "reply-desligado");
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    restoreFetch();
  }
});

test("sendTelegramReply: sem chatId -> ok:false via reply-desligado mesmo com token", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(200, {}));
  process.env.TELEGRAM_BOT_TOKEN = "bot-token-123";
  try {
    const out = await sendTelegramReply(null, "oi");
    assert.equal(out.ok, false);
    assert.equal(out.via, "reply-desligado");
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    restoreFetch();
  }
});

test("sendTelegramReply: com token + chatId + fetch ok -> ok:true, chama sendMessage com chat_id/text", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(200, { ok: true }));
  process.env.TELEGRAM_BOT_TOKEN = "bot-token-123";
  try {
    const out = await sendTelegramReply(98765, "🔨 projeto — score 90/100 ✅");
    assert.equal(out.ok, true);
    assert.equal(fetchMock.calls.length, 1);
    const [url, opts] = fetchMock.calls[0];
    assert.equal(url, "https://api.telegram.org/botbot-token-123/sendMessage");
    const body = JSON.parse(opts.body);
    assert.equal(body.chat_id, 98765);
    assert.match(body.text, /score 90\/100/);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    restoreFetch();
  }
});

test("sendTelegramReply: fetch nao-ok -> ok:false com via telegram-http-<status>", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(500, {}));
  process.env.TELEGRAM_BOT_TOKEN = "bot-token-123";
  try {
    const out = await sendTelegramReply(1, "oi");
    assert.equal(out.ok, false);
    assert.equal(out.via, "telegram-http-500");
    assert.equal(fetchMock.calls.length, 1);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    restoreFetch();
  }
});

test("sendTelegramReply: fetch lanca -> nunca propaga, ok:false com via telegram-falhou:...", async () => {
  mockFetch(async () => {
    throw new Error("network down");
  });
  process.env.TELEGRAM_BOT_TOKEN = "bot-token-123";
  try {
    const out = await sendTelegramReply(1, "oi");
    assert.equal(out.ok, false);
    assert.match(out.via, /^telegram-falhou:/);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    restoreFetch();
  }
});
