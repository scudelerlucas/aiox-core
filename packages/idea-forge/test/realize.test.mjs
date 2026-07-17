// @ts-check
/**
 * Testes de B.2 — gate de qualidade do auto-deploy (executor REALIZE).
 * Confirma que o executor real NUNCA e chamado (spawn) quando o blueprint
 * esta bloqueado no dispatch OU quando o score reprovou, mesmo com um
 * executor configurado. Zero-dependencia: diretorio temporario real
 * (mesmo padrao de test/e2e.test.mjs), sem tocar em rede/processo externo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.mjs";
import { realize } from "../src/executor/realize.mjs";

/** Monta um PipelineState minimo com blueprint/dispatch/scored + KICKOFF.md no disco. */
function makeState({ runId, blocked, passed, score }) {
  const dir = mkdtempSync(join(tmpdir(), "iforge-realize-"));
  const store = new Store(dir);
  const runDir = join(store.runsDir, runId);
  const state = {
    runId,
    blueprint: { name: "P", slug: "p", flows: ["f1"] },
    scored: { score, confidence: 90, passed, gaps: [], iterations: 1, breakdown: {} },
    dispatch: { projectSlug: "p", branch: `feat/p`, filesToCreate: [], deployTargets: ["local"], blocked, note: blocked ? "BLOQUEADO" : "liberado", kickoffPrompt: "" },
    log: [],
  };
  store.writeArtifact(runId, "KICKOFF.md", "# KICKOFF\n");
  return { state, store, targetDir: join(dir, "child") };
}

test("realize: dispatch.blocked=true -> nao spawna, devolve rec bloqueado (mesmo com executor configurado)", () => {
  const { state, store, targetDir } = makeState({ runId: "r-blocked", blocked: true, passed: false, score: 40 });
  const rec = realize(state, { store, targetDir, executor: "echo NUNCA-DEVERIA-RODAR" });
  assert.equal(rec.executed, false);
  assert.match(rec.note, /BLOQUEADO/);
  assert.ok(existsSync(join(store.runsDir, "r-blocked", "realize.json")));
});

test("realize: dispatch liberado mas scored.passed=false + executor configurado -> RECUSA, nao spawna", () => {
  const { state, store, targetDir } = makeState({ runId: "r-failed-score", blocked: false, passed: false, score: 60 });
  const rec = realize(state, { store, targetDir, executor: "echo NUNCA-DEVERIA-RODAR" });
  assert.equal(rec.executed, false);
  assert.match(rec.note, /RECUSADO/);
  assert.match(rec.note, /60/);
  const raw = JSON.parse(readFileSync(join(store.runsDir, "r-failed-score", "realize.json"), "utf8"));
  assert.equal(raw.executed, false);
});

test("realize: dispatch liberado mas scored.passed=false + SEM executor -> handoff normal (nao e uma recusa, so nao ha o que rodar)", () => {
  const { state, store, targetDir } = makeState({ runId: "r-no-executor", blocked: false, passed: false, score: 60 });
  const rec = realize(state, { store, targetDir });
  assert.equal(rec.executed, false);
  assert.match(rec.note, /sem IDEAFORGE_EXECUTOR/);
});

test("realize: dispatch liberado + scored.passed=true + executor configurado -> executa de fato (spawn real, comando trivial)", () => {
  const { state, store, targetDir } = makeState({ runId: "r-ok", blocked: false, passed: true, score: 97 });
  const rec = realize(state, { store, targetDir, executor: "echo executou" });
  assert.equal(rec.executed, true);
  assert.equal(rec.ok, true);
  assert.match(rec.stdoutTail, /executou/);
});
