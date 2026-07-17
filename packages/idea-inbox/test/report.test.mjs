// @ts-check
/**
 * Testes do relatorio duravel por run (api/report.mjs). Exercita
 * `renderReport` (pura, sem I/O) e `pickRunId`/`fetchIdea` (src/read-remote.mjs)
 * sem depender de rede real, alem do handler com memoria desligada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../api/report.mjs";
import { fetchIdea, pickRunId } from "../src/read-remote.mjs";

const fullIdea = {
  runId: "r1",
  score: 97,
  blocked: false,
  asymmetry_score: 0.8,
  synergy_score: 0.6,
  cluster_reach: 3,
  matched_seeds: [{ id: "S005", titulo: "x" }],
  project: "p",
  branch: "b",
  source: "telegram",
  channel: "telegram",
  created_at: "2026-07-17T00:00:00Z",
};

test("renderReport: HTML valido com score, seed id e label de assimetria", () => {
  const html = renderReport(fullIdea);
  assert.ok(html.includes("<!doctype") || html.includes("<html"), "deve ser HTML valido");
  assert.ok(html.includes("97"), "deve mostrar o score");
  assert.ok(html.includes("S005"), "deve mostrar o id do seed correlacionado");
  assert.ok(/ASSIMETRIA/.test(html), "deve ter o rotulo de assimetria");
  assert.ok(/PASS/.test(html), "score 97 e nao bloqueado -> PASS");
});

test("renderReport: registro bloqueado ou score baixo -> badge BLOCKED", () => {
  const html = renderReport({ runId: "r2", score: 40, blocked: true });
  assert.ok(/BLOCKED/.test(html));
});

test("renderReport: objeto vazio nao lanca e usa defaults seguros", () => {
  assert.doesNotThrow(() => renderReport({}));
  const html = renderReport({});
  assert.ok(html.includes("<!doctype html"));
  assert.ok(html.includes("—"), "campos ausentes mostram travessao");
});

test("renderReport: undefined/null nao lanca", () => {
  // @ts-expect-error - testando resiliencia a input invalido de proposito
  assert.doesNotThrow(() => renderReport(undefined));
  // @ts-expect-error
  assert.doesNotThrow(() => renderReport(null));
});

test("pickRunId: le runId ou id de um objeto de query, default vazio", () => {
  assert.equal(pickRunId({ runId: "a" }), "a");
  assert.equal(pickRunId({ id: "b" }), "b");
  assert.equal(pickRunId({}), "");
  assert.equal(pickRunId(undefined), "");
});

test("fetchIdea: sem SUPABASE_URL/SUPABASE_SERVICE_KEY resolve null (sem rede)", async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  try {
    const result = await fetchIdea("qualquer-run-id");
    assert.equal(result, null);
  } finally {
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_KEY = prevKey;
  }
});

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
  };
}

test("handler GET /report sem memoria configurada -> 404", async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  try {
    const { default: reportHandler } = await import("../api/report.mjs");
    const res = mockRes();
    await reportHandler({ method: "GET", url: "/report?runId=abc" }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
  } finally {
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_KEY = prevKey;
  }
});

test("handler POST /report -> 405", async () => {
  const { default: reportHandler } = await import("../api/report.mjs");
  const res = mockRes();
  await reportHandler({ method: "POST", url: "/report?runId=abc" }, res);
  assert.equal(res.statusCode, 405);
});

test("handler GET /report sem runId -> 400", async () => {
  const { default: reportHandler } = await import("../api/report.mjs");
  const res = mockRes();
  await reportHandler({ method: "GET", url: "/report" }, res);
  assert.equal(res.statusCode, 400);
});
