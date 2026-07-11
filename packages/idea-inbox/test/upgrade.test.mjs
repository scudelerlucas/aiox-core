// @ts-check
/**
 * Testes das 3 camadas aditivas (voz->texto, memoria permanente, fecha-laco CI).
 * Zero-dependencia: mocka `globalThis.fetch` e restaura env/fetch apos cada teste.
 * Todas as funcoes sao best-effort e nunca devem lancar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { transcribe } from "../src/transcribe.mjs";
import { persistIdea } from "../src/store-remote.mjs";
import { fireRealize } from "../src/dispatch-ci.mjs";

const ORIGINAL_FETCH = globalThis.fetch;

/** @param {(...args:any[])=>Promise<any>} impl */
function mockFetch(impl) {
  let calls = [];
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
  return { ok: status >= 200 && status < 300, status, async json() { return body; }, async arrayBuffer() { return new ArrayBuffer(0); } };
}

test("transcribe: passthrough quando ja ha texto — fetch NAO e chamado", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(200, {}));
  try {
    const out = await transcribe({ source: "telegram", audioRef: null, text: "  ideia com texto  " });
    assert.equal(out.text, "ideia com texto");
    assert.equal(out.via, "passthrough");
    assert.equal(fetchMock.calls.length, 0, "fetch nao deve ser chamado em passthrough");
  } finally {
    restoreFetch();
  }
});

test("transcribe: audio telegram sem TELEGRAM_BOT_TOKEN -> sem-stt, texto vazio", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(200, {}));
  delete process.env.TELEGRAM_BOT_TOKEN;
  try {
    const out = await transcribe({ source: "telegram", audioRef: "file123", text: "" });
    assert.equal(out.text, "");
    assert.equal(out.via, "sem-stt");
    assert.equal(fetchMock.calls.length, 0, "sem token, nao deve tentar rede");
  } finally {
    restoreFetch();
  }
});

test("persistIdea: sem env -> memoria-desligada, fetch nao chamado", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(204, {}));
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  try {
    const out = await persistIdea({ run_id: "ib-1", text: "x" });
    assert.equal(out.ok, false);
    assert.equal(out.via, "memoria-desligada");
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    restoreFetch();
  }
});

test("persistIdea: com env + fetch ok -> ok:true, chama rest/v1/ideas com apikey", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(204, {}));
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "service-key-123";
  try {
    const out = await persistIdea({ run_id: "ib-1", text: "ideia de teste" });
    assert.equal(out.ok, true);
    assert.equal(out.via, "supabase");
    assert.equal(fetchMock.calls.length, 1);
    const [url, opts] = fetchMock.calls[0];
    assert.match(String(url), /\/rest\/v1\/ideas$/);
    assert.equal(opts.headers.apikey, "service-key-123");
    assert.equal(opts.headers.authorization, "Bearer service-key-123");
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    restoreFetch();
  }
});

test("fireRealize: sem env -> ci-desligado, fetch nao chamado", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(204, {}));
  delete process.env.GITHUB_DISPATCH_TOKEN;
  delete process.env.GITHUB_REPO;
  try {
    const out = await fireRealize({ runId: "ib-1", idea: "x", score: 90 });
    assert.equal(out.ok, false);
    assert.equal(out.via, "ci-desligado");
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    restoreFetch();
  }
});

test("fireRealize: com env + fetch 204 -> ok:true, dispara dispatches com event_type correto", async () => {
  const fetchMock = mockFetch(async () => okJsonResponse(204, {}));
  process.env.GITHUB_DISPATCH_TOKEN = "gh-token-123";
  process.env.GITHUB_REPO = "org/aiox-core";
  try {
    const out = await fireRealize({ runId: "ib-1", idea: "ideia de teste", score: 95 });
    assert.equal(out.ok, true);
    assert.equal(out.via, "github");
    assert.equal(fetchMock.calls.length, 1);
    const [url, opts] = fetchMock.calls[0];
    assert.equal(url, "https://api.github.com/repos/org/aiox-core/dispatches");
    const body = JSON.parse(opts.body);
    assert.equal(body.event_type, "idea-forge-realize");
    assert.equal(body.client_payload.runId, "ib-1");
  } finally {
    delete process.env.GITHUB_DISPATCH_TOKEN;
    delete process.env.GITHUB_REPO;
    restoreFetch();
  }
});
