// @ts-check
/**
 * Testes de T3.2 (endpoint de diagnostico — api/diagnose.mjs). Roda o
 * pipeline IdeaForge COMPLETO (offline) e devolve o relatorio HTML grafico.
 * Cobre: 200 + HTML valido no caminho feliz, e o gate de auth (mesma
 * politica do /ingest generico: Bearer INGEST_TOKEN, fail-closed em
 * producao) em wrong-token e no-token.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.IDEAFORGE_OFFLINE = "1";
process.env.IDEAFORGE_DIR = mkdtempSync(join(tmpdir(), "inbox-diagnose-"));

const { default: diagnoseHandler } = await import("../api/diagnose.mjs");

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
  return { method, headers: { "x-forwarded-for": ip || `10.2.0.${++ipSeq}`, ...headers }, body };
}

test("POST /diagnose com texto -> 200 text/html com RELATORIO grafico completo (RETROFORJA)", async () => {
  const res = mockRes();
  await diagnoseHandler(
    mockReq("POST", JSON.stringify({ text: "sistema de diagnostico completo com fallback e relatorio grafico" })),
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
  assert.ok(res.body.startsWith("<!doctype html"), "corpo comeca com <!doctype html");
  assert.match(res.body, /RETROFORJA/, "contem a secao RETROFORJA-P do relatorio grafico");
});

test("metodo GET -> 405", async () => {
  const res = mockRes();
  await diagnoseHandler(mockReq("GET"), res);
  assert.equal(res.statusCode, 405);
});

test("texto vazio -> 422", async () => {
  const res = mockRes();
  await diagnoseHandler(mockReq("POST", JSON.stringify({ text: "" })), res);
  assert.equal(res.statusCode, 422);
});

test("json invalido -> 400", async () => {
  const res = mockRes();
  await diagnoseHandler(mockReq("POST", "{quebrado"), res);
  assert.equal(res.statusCode, 400);
});

test("prototype pollution no payload -> 400", async () => {
  const res = mockRes();
  await diagnoseHandler(mockReq("POST", '{"text":"x","__proto__":{"admin":true}}'), res);
  assert.equal(res.statusCode, 400);
});

test("prod-sim (VERCEL=1 + INGEST_TOKEN setado): sem token -> 401; token errado -> 401; token certo -> 200 html", async () => {
  process.env.VERCEL = "1";
  process.env.INGEST_TOKEN = "diag-tok-123";
  try {
    const noAuth = mockRes();
    await diagnoseHandler(mockReq("POST", JSON.stringify({ text: "ideia sem auth com fallback e relatorio" })), noAuth);
    assert.equal(noAuth.statusCode, 401, "sem bearer -> 401");

    const wrongAuth = mockRes();
    await diagnoseHandler(
      mockReq("POST", JSON.stringify({ text: "ideia com token errado com fallback e relatorio" }), { authorization: "Bearer token-errado" }),
      wrongAuth
    );
    assert.equal(wrongAuth.statusCode, 401, "bearer errado -> 401");

    const ok = mockRes();
    await diagnoseHandler(
      mockReq("POST", JSON.stringify({ text: "ideia autorizada com fallback e relatorio grafico" }), { authorization: "Bearer diag-tok-123" }),
      ok
    );
    assert.equal(ok.statusCode, 200, "bearer correto -> 200");
    assert.ok(ok.body.startsWith("<!doctype html"));
  } finally {
    delete process.env.VERCEL;
    delete process.env.INGEST_TOKEN;
  }
});
