// @ts-check
/**
 * Testes de T4.5 — memoria de falhas antifragil. Zero-dependencia: usa
 * diretorios temporarios reais (node:fs), mesmo padrao de test/e2e.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordFailures, topFailures } from "../src/frameworks/failure-memory.mjs";
import { architectDeterministic } from "../src/stages/architect.mjs";
import { atomizeDeterministic } from "../src/stages/atomize.mjs";
import { brainstormDeterministic } from "../src/stages/brainstorm.mjs";
import { steroidDeterministic } from "../src/stages/steroid.mjs";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "iforge-failmem-"));
}

test("topFailures: sem arquivo/historico -> lista vazia (no-op)", () => {
  const dir = tmpDir();
  assert.deepEqual(topFailures(dir), []);
});

test("recordFailures + topFailures: registra e devolve contagens ordenadas desc", () => {
  const dir = tmpDir();
  const ok1 = recordFailures(dir, [{ id: "F-VAL", desc: "sem validador" }, { id: "E2E-TIMEOUT", desc: "timeout" }], { runId: "r1" });
  assert.equal(ok1, true);
  assert.ok(existsSync(join(dir, "failure-patterns.json")));

  recordFailures(dir, [{ id: "F-VAL", desc: "sem validador" }], { runId: "r2" });
  recordFailures(dir, [{ id: "F-VAL", desc: "sem validador" }, { id: "E2E-TIMEOUT", desc: "timeout" }], { runId: "r3" });

  const top = topFailures(dir, 5);
  assert.equal(top[0].id, "F-VAL");
  assert.equal(top[0].count, 3);
  assert.equal(top[1].id, "E2E-TIMEOUT");
  assert.equal(top[1].count, 2);
  // ordenado desc
  assert.ok(top[0].count >= top[1].count);

  // append-only: arquivo cresce, nunca sobrescreve entradas anteriores
  const raw = JSON.parse(readFileSync(join(dir, "failure-patterns.json"), "utf8"));
  assert.equal(raw.length, 5);
});

test("recordFailures: tolerante a input vazio/invalido, nunca lanca", () => {
  const dir = tmpDir();
  assert.equal(recordFailures(dir, []), false);
  assert.equal(recordFailures(dir, undefined), false);
  assert.equal(recordFailures("", [{ id: "X" }]), false);
  assert.doesNotThrow(() => recordFailures(join(dir, "nested", "deep"), [{ id: "X", desc: "d" }]));
});

test("topFailures: tolerante a arquivo corrompido -> []", () => {
  const dir = tmpDir();
  recordFailures(dir, [{ id: "F-VAL" }]);
  // corrompe o arquivo diretamente
  const p = join(dir, "failure-patterns.json");
  writeFileSync(p, "{ nao e um array valido de json ]");
  assert.deepEqual(topFailures(dir), []);
});

function baseBlueprintInputs() {
  const a = atomizeDeterministic("Quero um sistema que gera relatorio e valida o fluxo do operador com fallback.");
  const b = brainstormDeterministic(a);
  const s = steroidDeterministic(a, b);
  const raw = { id: "r", source: "text", transcript: "x", audioRef: null, capturedAt: "t", meta: {} };
  return { raw, b, s };
}

test("architectDeterministic: sem historico de falhas -> no-op (sem secao de licoes, sem gates extras)", () => {
  const { raw, b, s } = baseBlueprintInputs();
  const bp = architectDeterministic(/** @type any */ (raw), b, s);
  assert.ok(!/Licoes de falhas anteriores/.test(bp.architecture));
  assert.ok(!bp.qualityGates.some((g) => g.includes("gate-antifragil")));
});

test("architectDeterministic: com historico de falhas -> adiciona secao de licoes + gates extras", () => {
  const { raw, b, s } = baseBlueprintInputs();
  const lessons = [
    { id: "F-VAL", count: 5, desc: "sem validador" },
    { id: "E2E-TIMEOUT", count: 3, desc: "timeout de dependencia externa" },
  ];
  const bp = architectDeterministic(/** @type any */ (raw), b, s, { topFailures: lessons });
  assert.match(bp.architecture, /Licoes de falhas anteriores/);
  assert.match(bp.architecture, /F-VAL/);
  assert.ok(bp.qualityGates.some((g) => g.includes("gate-antifragil F-VAL")));
  assert.ok(bp.qualityGates.some((g) => g.includes("gate-antifragil E2E-TIMEOUT")));
});
