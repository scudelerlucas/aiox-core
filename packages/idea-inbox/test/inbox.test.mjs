// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../src/server.mjs";
import { telegram as normalizeTelegram, whatsapp as normalizeWhatsapp, generic } from "../src/normalize.mjs";
import { verifySignature } from "../src/verify.mjs";
import { enqueueRaw, buildRunId } from "../src/inbox.mjs";

process.env.IDEAFORGE_OFFLINE = "1"; // testes rodam 100% offline (fallback deterministico)
delete process.env.TELEGRAM_WEBHOOK_SECRET;
delete process.env.WHATSAPP_APP_SECRET;

/** Sobe um servidor de teste em porta efemera e retorna base URL + close(). */
function startTestServer() {
  const dir = mkdtempSync(join(tmpdir(), "idea-inbox-"));
  const server = createServer({ dir });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolvePromise({
        dir,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r(undefined))),
      });
    });
  });
}

const TELEGRAM_VOICE_UPDATE = {
  update_id: 1001,
  message: {
    message_id: 55,
    chat: { id: 999 },
    from: { username: "lucas" },
    voice: { file_id: "AwACAgVoice123", duration: 4 },
  },
};

test("GET /health -> 200 { ok: true }", async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { ok: true });
  } finally {
    await close();
  }
});

test("POST /webhook/telegram with voice update -> 202 with runId", async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/webhook/telegram`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(TELEGRAM_VOICE_UPDATE),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.accepted, true);
    assert.equal(typeof body.runId, "string");
    assert.ok(body.runId.startsWith("ib-"));
  } finally {
    await close();
  }
});

test("POST /ingest with plain text -> 202 with runId", async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "minha ideia de teste" }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.accepted, true);
    assert.equal(typeof body.runId, "string");
  } finally {
    await close();
  }
});

test("invalid JSON body -> 400, server continues alive", async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ isso nao e json valido ][",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);

    // servidor segue vivo: proxima requisicao funciona normalmente
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
  } finally {
    await close();
  }
});

test("unknown route -> 404", async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/nao/existe`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});

test("POST /webhook/whatsapp with text message -> 202 with runId", async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: "wamid.1", from: "5511999998888", type: "text", text: { body: "ideia via whatsapp" } }],
              },
            },
          ],
        },
      ],
    };
    const res = await fetch(`${baseUrl}/webhook/whatsapp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(typeof body.runId, "string");
  } finally {
    await close();
  }
});

test("fallback: enqueueRaw persists a raw payload as one JSON line", () => {
  const dir = mkdtempSync(join(tmpdir(), "idea-inbox-queue-"));
  enqueueRaw(dir, "telegram", { message: { text: "cru" } });
  enqueueRaw(dir, "whatsapp", { entry: [] });

  const queuePath = join(dir, "inbox-queue.jsonl");
  assert.ok(existsSync(queuePath), "arquivo de fila criado");
  const lines = readFileSync(queuePath, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]);
  assert.equal(first.channel, "telegram");
  assert.equal(first.payload.message.text, "cru");
  assert.ok(typeof first.queuedAt === "string");
});

test("normalize.telegram extracts text, caption, voice/audio file_id and meta", () => {
  const withText = normalizeTelegram({ message: { text: "oi", chat: { id: 1 }, from: { username: "a" } } });
  assert.equal(withText.source, "telegram");
  assert.equal(withText.text, "oi");
  assert.equal(withText.audioRef, null);
  assert.equal(withText.meta.chatId, 1);
  assert.equal(withText.meta.from, "a");

  const withVoice = normalizeTelegram(TELEGRAM_VOICE_UPDATE);
  assert.equal(withVoice.text, "");
  assert.equal(withVoice.audioRef, "AwACAgVoice123");
  assert.equal(withVoice.meta.chatId, 999);

  const withCaption = normalizeTelegram({ message: { caption: "legenda", audio: { file_id: "AUD1" } } });
  assert.equal(withCaption.text, "legenda");
  assert.equal(withCaption.audioRef, "AUD1");
});

test("normalize.whatsapp extracts text body and audio id", () => {
  const withText = normalizeWhatsapp({
    entry: [{ changes: [{ value: { messages: [{ from: "55119", type: "text", text: { body: "oi zap" } }] } }] }],
  });
  assert.equal(withText.source, "whatsapp");
  assert.equal(withText.text, "oi zap");
  assert.equal(withText.meta.waId, "55119");

  const withAudio = normalizeWhatsapp({
    entry: [{ changes: [{ value: { messages: [{ from: "55119", type: "audio", audio: { id: "AUD-ZAP-1" } }] } }] }],
  });
  assert.equal(withAudio.audioRef, "AUD-ZAP-1");
});

test("normalize.generic passes through text/audioRef/source", () => {
  const n = generic({ text: "puro", audioRef: "a1", source: "cowork" });
  assert.equal(n.source, "cowork");
  assert.equal(n.text, "puro");
  assert.equal(n.audioRef, "a1");

  const withoutSource = generic({ text: "sem canal" });
  assert.equal(withoutSource.source, "text");
});

test("verifySignature: skips verification when secret is unset (dev fallback)", () => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.WHATSAPP_APP_SECRET;
  const fakeReq = /** @type {any} */ ({ headers: {} });
  assert.equal(verifySignature("telegram", fakeReq, Buffer.from("{}")), true);
  assert.equal(verifySignature("whatsapp", fakeReq, Buffer.from("{}")), true);
});

test("verifySignature: rejects wrong telegram secret token when configured", () => {
  process.env.TELEGRAM_WEBHOOK_SECRET = "shh-secret";
  try {
    const wrongReq = /** @type {any} */ ({ headers: { "x-telegram-bot-api-secret-token": "nope" } });
    assert.equal(verifySignature("telegram", wrongReq, Buffer.from("{}")), false);
    const rightReq = /** @type {any} */ ({ headers: { "x-telegram-bot-api-secret-token": "shh-secret" } });
    assert.equal(verifySignature("telegram", rightReq, Buffer.from("{}")), true);
  } finally {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  }
});

test("buildRunId is deterministic for the same (now, seq)", () => {
  const a = buildRunId("2026-07-11T10:00:00.000Z", 1);
  const b = buildRunId("2026-07-11T10:00:00.000Z", 1);
  assert.equal(a, b);
  assert.ok(a.startsWith("ib-20260711100000"));
});
