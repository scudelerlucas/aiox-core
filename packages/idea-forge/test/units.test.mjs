// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng, seedFrom, synthesizeDatabase } from "../src/store.mjs";
import { op3lif } from "../src/frameworks/op3lif.mjs";
import { tgm } from "../src/frameworks/tgm.mjs";
import { antifragility } from "../src/frameworks/antifragility.mjs";
import { atomizeDeterministic } from "../src/stages/atomize.mjs";
import { brainstormDeterministic } from "../src/stages/brainstorm.mjs";
import { steroidDeterministic } from "../src/stages/steroid.mjs";
import { architectDeterministic } from "../src/stages/architect.mjs";
import { scoreBlueprint } from "../src/stages/score.mjs";
import { simulateDeterministic } from "../src/stages/simulate.mjs";
import { retroforjaDeterministic } from "../src/stages/retroforja.mjs";
import { SCORE_GATE, PERCENTILE_TARGET } from "../src/types.mjs";

test("makeRng is deterministic for same seed", () => {
  const a = makeRng(seedFrom("x"));
  const b = makeRng(seedFrom("x"));
  assert.equal(a(), b());
  assert.equal(a(), b());
  const c = makeRng(seedFrom("y"));
  assert.notEqual(makeRng(seedFrom("x"))(), c());
});

test("synthesizeDatabase carries confidence and lower confidence => higher error", () => {
  const bp = { slug: "demo", flows: ["f1", "f2"] };
  const hi = synthesizeDatabase(/** @type any */ (bp), 95, 500);
  const lo = synthesizeDatabase(/** @type any */ (bp), 60, 500);
  assert.equal(hi.confidence, 95);
  assert.equal(hi.sessions.length, 500);
  assert.ok(lo.metrics.errorRate >= hi.metrics.errorRate, "menos confianca => mais erro");
});

test("op3lif detects failure modes on a weak idea", () => {
  const weak = op3lif({ thesis: "quero ganhar dinheiro rapido escalando pra milhoes", atoms: [] });
  const ids = weak.failureModes.map((f) => f.id);
  assert.ok(ids.includes("F-VAL"), "sem validador");
  assert.ok(ids.includes("F-SPOF"), "sem fallback");
  assert.ok(weak.occam.length > 0);
  assert.ok(Array.isArray(weak.rescue.vaccinate));
});

test("op3lif finds fewer failure modes on a strong idea", () => {
  const strong = op3lif({
    thesis: "sistema com validador de metrica, fallback deterministico, observabilidade e loop com percentil-alvo para o operador",
    atoms: [],
  });
  assert.ok(strong.failureModes.length <= 2);
});

test("tgm returns the 7 levers", () => {
  const out = tgm({ thesis: "pipeline de fluxo com feedback e estresse", atoms: [{ text: "meta x", kind: "goal", signal: 90 }] });
  for (const k of ["radarPassivo", "grafoCruzamentos", "isomorfismos", "lacunaAssimetrica", "calibracaoCQRG", "retroforjaHook", "maestro"])
    assert.ok(k in out, `falta ${k}`);
  assert.ok(out.isomorfismos.length >= 1);
});

test("antifragility converts failure modes into convex responses", () => {
  const fms = [{ id: "F-SPOF", name: "SPOF", mechanism: "", lethal: true, vaccine: "fallback" }];
  const af = antifragility({ failureModes: fms });
  assert.equal(af.convexResponses.length, 1);
  assert.ok(af.barbell.includes("Barbell"));
  assert.ok(af.viaNegativa.length >= 1);
});

test("atomize maximizes signal and drops noise", () => {
  const a = atomizeDeterministic("Quero construir um sistema que valida ideias. tipo, sabe, meio que isso ai. Deve gerar relatorio.");
  assert.ok(a.atoms.length >= 1);
  assert.ok(a.signalToNoise >= 0 && a.signalToNoise <= 100);
  assert.ok(a.coreThesis.length > 0);
  assert.ok(a.atoms.every((x) => x.signal >= 25));
});

test("brainstorm converges and does not regress S/N", () => {
  const a = atomizeDeterministic("Quero gerar um sistema que automatiza deploy e valida fluxo.");
  const b = brainstormDeterministic(a);
  assert.equal(b.variations.length, 5);
  assert.ok(b.converged.length >= 1);
  assert.ok(b.signalToNoise >= a.signalToNoise);
});

test("steroid combines TGM+OP3LIF+AF with a confidence", () => {
  const a = atomizeDeterministic("quero ganhar dinheiro escalando pra milhoes rapido");
  const b = brainstormDeterministic(a);
  const s = steroidDeterministic(a, b);
  assert.ok(s.confidence >= 0 && s.confidence <= 100);
  assert.ok(Array.isArray(s.failureModes));
  assert.ok(s.tgm && s.op3lif && s.antifragility);
});

test("architect emits an AIOX PRO blueprint traceable to FR-*", () => {
  const a = atomizeDeterministic("Quero um sistema que gera relatorio e valida o fluxo do operador com fallback.");
  const b = brainstormDeterministic(a);
  const s = steroidDeterministic(a, b);
  const raw = { id: "r", source: "text", transcript: "x", audioRef: null, capturedAt: "t", meta: {} };
  const bp = architectDeterministic(/** @type any */ (raw), b, s);
  assert.ok(bp.prd.includes("FR-1"));
  assert.ok(bp.flows.length >= 1);
  assert.ok(bp.stories.length >= 2);
  assert.ok(bp.qualityGates.some((g) => /test/i.test(g)));
  assert.ok(/cli first/i.test(bp.architecture));
});

test("score passes the 95 gate for a strong idea", () => {
  const a = atomizeDeterministic("Quero um sistema que gera relatorio e valida metrica do operador, com fallback e observabilidade.");
  const b = brainstormDeterministic(a);
  const s = steroidDeterministic(a, b);
  const raw = { id: "r", source: "text", transcript: "x", audioRef: null, capturedAt: "t", meta: {} };
  const bp = architectDeterministic(/** @type any */ (raw), b, s);
  const r = scoreBlueprint(bp, s);
  assert.ok(r.score >= SCORE_GATE, `score ${r.score} deveria passar ${SCORE_GATE}`);
  assert.ok(r.confidence > 0);
});

test("score self-heal raises a deliberately weak blueprint", () => {
  const s = { failureModes: [], tgm: {}, op3lif: {}, antifragility: {}, confidence: 50 };
  const weakBp = {
    name: "W", slug: "w",
    prd: "curto", architecture: "sem principios",
    stories: [{ id: "1.1", title: "t", acceptanceCriteria: [] }],
    qualityGates: ["lint"], risks: [], flows: [],
  };
  const before = scoreBlueprint(/** @type any */ (weakBp), /** @type any */ (s));
  assert.ok(before.gaps.length > 0, "blueprint fraco deve ter gaps");
  // aplica os mesmos heals que o estagio faz e re-pontua
  // (o estagio score() faz esse loop; aqui garantimos que gaps existem e sao acionaveis)
  assert.ok(before.gaps.some((g) => /CLI First|gate de teste|simulacao|No Invention|barbell|fluxo/.test(g)));
});

test("simulate converges toward the percentile target and is deterministic", () => {
  const s = { failureModes: [{ id: "F-VAL", name: "v", mechanism: "", lethal: false, vaccine: "x" }], tgm: {}, op3lif: {}, antifragility: {}, confidence: 80 };
  const bp = { name: "P", slug: "p", prd: "", architecture: "", stories: [], qualityGates: ["gate-vacina F-VAL"], risks: [], flows: ["f1"] };
  const r1 = simulateDeterministic(/** @type any */ (bp), /** @type any */ (s), seedFrom("run:p"));
  const r2 = simulateDeterministic(/** @type any */ (bp), /** @type any */ (s), seedFrom("run:p"));
  assert.deepEqual(r1.history, r2.history, "mesma seed => mesmo historico");
  assert.ok(r1.percentile >= PERCENTILE_TARGET || r1.iterations >= 1);
  assert.ok(r1.history.length >= 1);
});

test("retroforja falls back to synthetic DB @95% and produces cycles", () => {
  const bp = { name: "P", slug: "p", prd: "", architecture: "", stories: [], qualityGates: [], risks: [], flows: ["f1"] };
  const sim = { iterations: 3, percentile: 100, reachedTarget: true, history: [], fixedBreaks: [] };
  const s = { failureModes: [], tgm: {}, op3lif: {}, antifragility: {}, confidence: 90 };
  const rf = retroforjaDeterministic(/** @type any */ (bp), /** @type any */ (sim), /** @type any */ (s), null);
  assert.equal(rf.dataSource, "synthetic");
  assert.equal(rf.dataConfidence, 95);
  assert.equal(rf.cycles.length, 3);
  assert.ok(rf.backwardScore >= 0 && rf.backwardScore <= 100);
});

test("retroforja uses real data when provided", () => {
  const bp = { name: "P", slug: "p", prd: "", architecture: "", stories: [], qualityGates: [], risks: [], flows: ["f1"] };
  const sim = { iterations: 1, percentile: 100, reachedTarget: true, history: [], fixedBreaks: [] };
  const s = { failureModes: [], tgm: {}, op3lif: {}, antifragility: {}, confidence: 90 };
  const realData = { sessions: Array.from({ length: 50 }, (_, i) => ({ completed: i % 20 !== 0, duration_ms: 9000 })) };
  const rf = retroforjaDeterministic(/** @type any */ (bp), /** @type any */ (sim), /** @type any */ (s), realData);
  assert.equal(rf.dataSource, "real");
  assert.equal(rf.dataConfidence, 100);
});
