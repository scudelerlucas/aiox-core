// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.mjs";
import { createRun, runAll } from "../src/orchestrator.mjs";
import { STAGES, SCORE_GATE } from "../src/types.mjs";

process.env.IDEAFORGE_OFFLINE = "1"; // E2E roda 100% offline (fallback deterministico)

const IDEA =
  "Quero um sistema que grava um audio com uma ideia, atomiza pra maximo sinal, esteroida com TGM OP3LIF e antifragilidade, " +
  "arquiteta em AIOX PRO com quality gates, despacha no Claude Code, roda simulacao end to end ate percentil 99.9, " +
  "roda RETROFORJA-P com banco sintetico, entrega relatorio grafico simples e canoniza o fluxo.";

test("full pipeline runs end-to-end offline and produces all artifacts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "iforge-"));
  const store = new Store(dir);
  const state = createRun({ runId: "e2e-1", source: "audio-file", text: IDEA });
  store.save(state);
  await runAll(state, { store });

  assert.equal(state.done, true, "pipeline concluiu");
  assert.equal(state.stage, null);
  const okLines = state.log.filter((l) => /ok \(\d+ms\)/.test(l));
  assert.equal(okLines.length, STAGES.length, "um 'ok' do orquestrador por estagio");

  // artefatos esperados
  const runDir = join(store.runsDir, "e2e-1");
  for (const f of ["PRD.md", "ARCHITECTURE.md", "KICKOFF.md", "RELATORIO.html", "COMO-USAR.md", "CANONICAL-FLOW.md", "dispatch-manifest.json"]) {
    assert.ok(existsSync(join(runDir, f)), `artefato ausente: ${f}`);
  }

  // conteudo minimo do relatorio
  const html = readFileSync(join(runDir, "RELATORIO.html"), "utf8");
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("<svg"), "relatorio tem grafico SVG");
  assert.ok(html.includes("RETROFORJA-P"));

  // resultados do pipeline
  assert.ok(state.scored.score >= SCORE_GATE, `score ${state.scored.score}`);
  assert.ok(state.scored.passed);
  assert.ok(state.simulation.reachedTarget, "atingiu percentil-alvo");
  assert.equal(state.dispatch.blocked, false, "dispatch liberado");
  assert.equal(state.retroforja.dataSource, "synthetic");
});

test("pipeline is resumable (state persisted per stage)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "iforge-"));
  const store = new Store(dir);
  const state = createRun({ runId: "e2e-2", source: "text", text: IDEA });
  store.save(state);

  // roda ate 'steroid' inclusive
  await runAll(state, { store }, "steroid");
  assert.equal(state.stage, "architect", "parou apos steroid");
  assert.ok(state.steroided, "steroid persistido");
  assert.ok(!state.blueprint, "ainda nao arquitetou");

  // recarrega do disco e retoma ate o fim
  const reloaded = store.load("e2e-2");
  assert.equal(reloaded.stage, "architect");
  await runAll(reloaded, { store });
  assert.equal(reloaded.done, true);
  assert.ok(reloaded.canon);
});

test("determinism: same idea + same runId => same score and percentile", async () => {
  const run = async (id) => {
    const dir = mkdtempSync(join(tmpdir(), "iforge-"));
    const store = new Store(dir);
    const state = createRun({ runId: id, source: "text", text: IDEA });
    await runAll(state, { store });
    return state;
  };
  const a = await run("det");
  const b = await run("det");
  assert.equal(a.scored.score, b.scored.score);
  assert.equal(a.simulation.percentile, b.simulation.percentile);
  assert.equal(a.retroforja.backwardScore, b.retroforja.backwardScore);
});

test("multi-channel ingest normalizes different payloads", async () => {
  const dir = mkdtempSync(join(tmpdir(), "iforge-"));
  const store = new Store(dir);
  // canal telegram com voice file_id, sem texto -> transcript pendente, nao trava
  const tg = createRun({ runId: "tg", source: "telegram", text: "", audioRef: null });
  // @ts-ignore injeta payload cru do telegram
  tg.input.raw = { message: { voice: { file_id: "AwACv123" }, chat: { id: 42 }, from: { username: "lucas" } } };
  store.save(tg);
  await runAll(tg, { store }, "ingest");
  assert.equal(tg.raw.source, "telegram");
  assert.equal(tg.raw.audioRef, "AwACv123");
  assert.equal(tg.raw.meta.chatId, 42);
});
