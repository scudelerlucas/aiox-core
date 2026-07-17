// @ts-check
/**
 * Testes de governanca de custo (B.1): teto GLOBAL de disparos de CI/min
 * (independente do rate-limit por IP em api/_core.mjs), contador
 * metrificado em memoria (src/cost.mjs) e o snapshot exposto no /health
 * existente. Zero-dependencia: mocka `globalThis.fetch` (mesmo padrao de
 * test/reply.test.mjs) e define o teto via env ANTES do import (o modulo
 * le o env no load, mesmo padrao de IDEAINBOX_RATE_LIMIT em api/_core.mjs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.IDEAINBOX_MAX_CI_PER_MIN = "3";

const { fireRealize } = await import("../src/dispatch-ci.mjs");
const { meter, snapshot } = await import("../src/cost.mjs");
const { healthHandler } = await import("../api/_core.mjs");

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
function okResponse(status) {
  return { ok: status >= 200 && status < 300, status };
}
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

test("dispatch-ci: teto global (IDEAINBOX_MAX_CI_PER_MIN) bloqueia apos N disparos, sem tocar na rede", async () => {
  process.env.GITHUB_DISPATCH_TOKEN = "tok";
  process.env.GITHUB_REPO = "acme/repo";
  const fetchMock = mockFetch(async () => okResponse(204));
  try {
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await fireRealize({ runId: `r${i}`, idea: "ideia de teste", score: 90 }));
    }
    const capped = results.filter((r) => r.via === "ci-cap-atingido");
    const fired = results.filter((r) => r.ok === true);
    assert.ok(capped.length > 0, "deveria bloquear apos exceder o teto");
    capped.forEach((r) => assert.equal(r.ok, false));
    // nao dispara fetch para as chamadas bloqueadas -> fetch chamado no maximo o teto
    assert.ok(fetchMock.calls.length <= 3, `esperado <=3 disparos reais, recebido ${fetchMock.calls.length}`);
    assert.ok(fired.length <= 3);
  } finally {
    delete process.env.GITHUB_DISPATCH_TOKEN;
    delete process.env.GITHUB_REPO;
    restoreFetch();
  }
});

test("dispatch-ci: sem token/repo -> ci-desligado, nunca conta contra o teto nem toca na rede", async () => {
  const fetchMock = mockFetch(async () => okResponse(204));
  delete process.env.GITHUB_DISPATCH_TOKEN;
  delete process.env.GITHUB_REPO;
  const out = await fireRealize({ runId: "x", idea: "y", score: 10 });
  assert.equal(out.ok, false);
  assert.equal(out.via, "ci-desligado");
  assert.equal(fetchMock.calls.length, 0);
  restoreFetch();
});

test("cost: meter incrementa e snapshot reflete a contagem da janela atual", () => {
  meter("__test_metric_a__");
  meter("__test_metric_a__");
  meter("__test_metric_b__");
  const snap = snapshot();
  assert.equal(snap.__test_metric_a__, 2);
  assert.equal(snap.__test_metric_b__, 1);
});

test("cost: nomes nao usados nao aparecem no snapshot (sem poluicao entre contadores)", () => {
  const snap = snapshot();
  assert.equal(snap.__never_used_metric__, undefined);
});

test("/health inclui o snapshot de custo (campo cost) sem quebrar o formato existente", () => {
  const res = mockRes();
  healthHandler({}, res);
  assert.equal(res.statusCode, 200);
  const json = res.json();
  assert.equal(json.ok, true);
  assert.ok(json.cost && typeof json.cost === "object", "campo cost deveria ser um objeto");
});
