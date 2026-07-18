import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEditorPlan, normalizePlan, planToClipSpecs } from "../src/plan.mjs";
import { loadPersona } from "../src/persona.mjs";
import { loadConfig } from "../src/config.mjs";

const SAMPLE = `
1) LINHA DO TEMPO
[0-3s] — Lucas olhando pra câmera (tensão) | BLOCO: hook | punch-in | VOCÊ NÃO ESTÁ SOZINHO | beat grave | cut | 🎬 BROLL: —
[3-7s] — mesa de jantar vazia à luz de vela (melancolia) | BLOCO: problem | slow zoom | O SILÊNCIO DÓI | trilha triste | whip | 🎬 BROLL: empty dinner table candle
[7-12s] — Lucas falando com esperança (esperança) | BLOCO: cta | punch-in | COMENTE FAMÍLIA | trilha sobe | zoom | 🎬 BROLL: —

CHECKLIST DE EDIÇÃO
- legenda queimada
- loop última→primeira
`;

test("parseEditorPlan extrai cortes, tempos, blocos e b-roll", () => {
  const plan = parseEditorPlan(SAMPLE, { tema: "solidão familiar", aspectRatio: "9:16" });
  assert.equal(plan.schema, "editor-os.plan/v1");
  assert.equal(plan.cuts.length, 3);

  const [c0, c1, c2] = plan.cuts;
  assert.equal(c0.start, 0);
  assert.equal(c0.end, 3);
  assert.equal(c0.block, "hook");
  assert.equal(c0.sourceType, "talking_head"); // BROLL "—" => talking head
  assert.equal(c0.onScreenText, "VOCÊ NÃO ESTÁ SOZINHO");

  assert.equal(c1.block, "problem");
  assert.equal(c1.sourceType, "broll");
  assert.equal(c1.brollQuery, "empty dinner table candle");
  assert.equal(c1.duration, 4);

  assert.equal(c2.block, "cta");
  assert.equal(plan.totalSeconds, 12);
  assert.deepEqual(plan.checklist, ["legenda queimada", "loop última→primeira"]);
});

test("parseEditorPlan é tolerante a blocos inválidos e linhas ruins", () => {
  const plan = parseEditorPlan("[0-2s] — algo (x) | BLOCO: inexistente | zoom\nlixo sem tempo\n[2-4s] — outro");
  assert.equal(plan.cuts.length, 2);
  assert.equal(plan.cuts[0].block, null); // bloco inválido => null, sem quebrar
});

test("normalizePlan aceita JSON v1 nativo e {texto}", () => {
  const v1 = normalizePlan({
    schema: "editor-os.plan/v1",
    cuts: [{ start: 0, end: 5, sourceType: "broll", brollQuery: "q" }],
  });
  assert.equal(v1.cuts[0].duration, 5);
  assert.equal(v1.totalSeconds, 5);

  const fromText = normalizePlan({ texto: "[0-3s] — a (b) | BLOCO: hook", tema: "t" });
  assert.equal(fromText.cuts.length, 1);
  assert.equal(fromText.tema, "t");
});

test("planToClipSpecs mapeia cortes para geração (talking head usa persona)", () => {
  const cfg = loadConfig({ dryRun: true });
  const persona = loadPersona("", cfg.personaDir);
  const plan = parseEditorPlan(SAMPLE, { aspectRatio: "9:16", language: "pt-BR" });
  const specs = planToClipSpecs(plan, persona);
  assert.equal(specs.length, 3);
  assert.equal(specs[1].sourceType, "broll");
  assert.match(specs[1].prompt, /empty dinner table candle/);
  assert.ok(specs.every((s) => s.durationSeconds >= 2 && s.durationSeconds <= 10));
  assert.equal(specs[0].block, "hook"); // atribuição de retenção preservada
});
