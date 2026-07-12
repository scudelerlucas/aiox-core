import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.mjs";
import { BUILT_IN_FORMATS } from "../src/formats.mjs";
import { loadPersona } from "../src/persona.mjs";
import { runBrief } from "../src/pipeline.mjs";
import { runFactory, briefsFromSeed } from "../src/factory.mjs";

function ctxWith(outDir, formatId = "reel-viral") {
  const config = loadConfig({ dryRun: true, outDir });
  return {
    config,
    preset: BUILT_IN_FORMATS[formatId],
    persona: loadPersona("", config.personaDir),
    log: () => {},
  };
}

test("runBrief (dry-run) grava manifest e nao cria video", async () => {
  const out = mkdtempSync(join(tmpdir(), "ovf-"));
  try {
    const ctx = ctxWith(out);
    const res = await runBrief({ topic: "teste unitario" }, ctx);
    assert.equal(res.dryRun, true);
    assert.equal(res.status, "dry-run");
    assert.equal(res.finalVideo, null);
    assert.ok(existsSync(res.manifest));
    const man = JSON.parse(readFileSync(res.manifest, "utf8"));
    assert.ok(man.prompt.text.includes("teste unitario"));
    assert.equal(man.clips.length, 1);
    // manifest nao vaza base64 de imagem
    assert.equal(man.persona.referenceCount, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("runBrief youtube-horizontal gera manifest multi-clip", async () => {
  const out = mkdtempSync(join(tmpdir(), "ovf-"));
  try {
    const ctx = ctxWith(out, "youtube-horizontal");
    const res = await runBrief({ topic: "long form" }, ctx);
    const man = JSON.parse(readFileSync(res.manifest, "utf8"));
    assert.equal(man.clips.length, 4); // 32s / 8s
    assert.equal(man.preset.aspectRatio, "16:9");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("runFactory dedupe via state.json ao reprocessar", async () => {
  const out = mkdtempSync(join(tmpdir(), "ovf-"));
  try {
    const ctx = ctxWith(out);
    const briefs = briefsFromSeed("mkt", 3);
    const first = await runFactory(briefs, { ...ctx, resume: true });
    assert.equal(first.results.length, 3);
    const second = await runFactory(briefs, { ...ctx, resume: true });
    assert.equal(second.results.length, 0);
    assert.equal(second.skipped, 3);
    assert.ok(existsSync(join(out, "state.json")));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
