// @ts-check
/**
 * Testes do endpoint de status por run (api/runs.mjs — T1.3). Cobre metodo,
 * runId ausente e memoria desligada (sem depender de rede/Supabase real).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

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

test("GET /runs sem runId -> 400", async () => {
  const { default: runsHandler } = await import("../api/runs.mjs");
  const res = mockRes();
  await runsHandler({ method: "GET", url: "/runs" }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "run id ausente");
});

test("POST /runs -> 405", async () => {
  const { default: runsHandler } = await import("../api/runs.mjs");
  const res = mockRes();
  await runsHandler({ method: "POST", url: "/runs?id=abc" }, res);
  assert.equal(res.statusCode, 405);
});

test("GET /runs?id=abc sem memoria configurada -> 404 com nota de memoria desligada", async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  try {
    const { default: runsHandler } = await import("../api/runs.mjs");
    const res = mockRes();
    await runsHandler({ method: "GET", url: "/runs?id=abc" }, res);
    assert.equal(res.statusCode, 404);
    const body = res.json();
    assert.equal(body.runId, "abc");
    assert.match(body.error, /memoria desligada/);
  } finally {
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_KEY = prevKey;
  }
});

test("GET /runs?runId=xyz aceita a chave runId tambem", async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  try {
    const { default: runsHandler } = await import("../api/runs.mjs");
    const res = mockRes();
    await runsHandler({ method: "GET", url: "/runs?runId=xyz" }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().runId, "xyz");
  } finally {
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_KEY = prevKey;
  }
});
