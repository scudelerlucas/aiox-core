import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../src/prompt-builder.mjs";
import { BUILT_IN_FORMATS, clipCount } from "../src/formats.mjs";
import { buildRequestBody, extractVideoUri } from "../src/providers/gemini.mjs";
import { generateAngles, briefsFromSeed } from "../src/factory.mjs";
import { loadConfig } from "../src/config.mjs";

const persona = {
  name: "lucas",
  description: "mentor direto",
  references: [],
  loaded: false,
};

test("buildPrompt e deterministico", () => {
  const preset = BUILT_IN_FORMATS["reel-viral"];
  const brief = { topic: "foco" };
  const a = buildPrompt(brief, preset, persona);
  const b = buildPrompt(brief, preset, persona);
  assert.equal(a.text, b.text);
  assert.match(a.text, /9:16/);
  assert.ok(a.negative.length > 0);
});

test("clipCount cobre targetSeconds", () => {
  assert.equal(clipCount({ targetSeconds: 8, clipSeconds: 8 }), 1);
  assert.equal(clipCount({ targetSeconds: 32, clipSeconds: 8 }), 4);
  assert.equal(clipCount({ targetSeconds: 1, clipSeconds: 8 }), 1);
});

test("buildRequestBody mapeia aspect ratio, negative e referencias", () => {
  const body = buildRequestBody("omni", "gemini-omni-flash-preview", {
    prompt: "oi",
    negative: "ruim",
    aspectRatio: "9:16",
    durationSeconds: 8,
    references: [{ mimeType: "image/jpeg", data: "AAAA", file: "ref-0.jpg" }],
  });
  assert.equal(body.parameters.aspectRatio, "9:16");
  assert.equal(body.parameters.negativePrompt, "ruim");
  assert.equal(body.parameters.referenceImages.length, 1);
  assert.equal(body.parameters.referenceImages[0].image.bytesBase64Encoded, "AAAA");
  assert.equal(body.instances[0].prompt, "oi");
});

test("extractVideoUri tolera variacoes de shape", () => {
  assert.equal(
    extractVideoUri({ response: { generateVideoResponse: { generatedSamples: [{ video: { uri: "u1" } }] } } }),
    "u1"
  );
  assert.equal(extractVideoUri({ response: { videos: [{ uri: "u2" }] } }), "u2");
  assert.equal(extractVideoUri({ response: {} }), null);
});

test("generateAngles gera N hooks distintos e deterministicos", () => {
  const a = generateAngles("vendas", 12);
  const b = generateAngles("vendas", 12);
  assert.equal(a.length, 12);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 12); // sem duplicatas
  assert.ok(a[0].includes("vendas"));
});

test("briefsFromSeed produz briefs com topic + hook", () => {
  const briefs = briefsFromSeed("carreira", 3);
  assert.equal(briefs.length, 3);
  assert.ok(briefs.every((b) => b.topic === "carreira" && b.hook));
});

test("loadConfig forca dry-run sem API key", () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.OMNI_API_KEY;
  const cfg = loadConfig();
  assert.equal(cfg.dryRun, true);
  if (prev) process.env.GEMINI_API_KEY = prev;
});
