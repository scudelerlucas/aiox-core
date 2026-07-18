import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  dimensionsFor,
  buildFilterComplex,
  buildFfmpegArgs,
  renderTimeline,
} from "../src/compositor.mjs";
import { parseEditorPlan } from "../src/plan.mjs";

test("dimensionsFor mapeia aspect -> pixels", () => {
  assert.deepEqual(dimensionsFor("9:16"), { w: 1080, h: 1920 });
  assert.deepEqual(dimensionsFor("16:9"), { w: 1920, h: 1080 });
  assert.deepEqual(dimensionsFor("1:1"), { w: 1080, h: 1080 });
  assert.deepEqual(dimensionsFor("qualquer"), { w: 1080, h: 1920 }); // default vertical
});

test("buildFilterComplex normaliza, corta, queima texto e concatena", () => {
  const cuts = [
    { duration: 3, textFile: "/tmp/t0.txt" },
    { duration: 5, textFile: null },
  ];
  const fg = buildFilterComplex(cuts, { w: 1080, h: 1920, fontSize: 96, fontFile: null });
  // um input por corte
  assert.match(fg, /\[0:v\]scale=1080:1920:force_original_aspect_ratio=increase/);
  assert.match(fg, /\[1:v\]scale=1080:1920/);
  // corte na duração
  assert.match(fg, /trim=duration=3/);
  assert.match(fg, /trim=duration=5/);
  // texto só no corte 0 (via textfile, sem escaping)
  assert.match(fg, /drawtext=textfile='\/tmp\/t0\.txt'/);
  assert.equal((fg.match(/drawtext/g) || []).length, 1);
  // concat de 2 -> vout
  assert.match(fg, /\[v0\]\[v1\]concat=n=2:v=1:a=0\[vout\]/);
});

test("buildFfmpegArgs inclui inputs, filtro, map e áudio opcional", () => {
  const noAudio = buildFfmpegArgs({
    clips: ["a.mp4", "b.mp4"],
    filterComplex: "FG",
    outPath: "out.mp4",
  });
  assert.deepEqual(noAudio.slice(0, 5), ["-y", "-i", "a.mp4", "-i", "b.mp4"]);
  assert.ok(noAudio.includes("[vout]"));
  assert.ok(noAudio.includes("out.mp4"));
  assert.ok(!noAudio.includes("-shortest"));

  const withAudio = buildFfmpegArgs({
    clips: ["a.mp4", "b.mp4"],
    filterComplex: "FG",
    outPath: "out.mp4",
    audioFile: "vo.wav",
  });
  assert.ok(withAudio.includes("vo.wav"));
  assert.ok(withAudio.includes("-shortest"));
  assert.ok(withAudio.includes("2:a")); // áudio é o input de índice = clips.length
});

test("renderTimeline sem ffmpeg emite render.sh reproduzível", () => {
  const out = mkdtempSync(join(tmpdir(), "ovf-comp-"));
  try {
    const plan = parseEditorPlan(
      "[0-3s] — a (t) | BLOCO: hook | zoom | TEXTO UM | trilha | cut | 🎬 BROLL: —\n" +
      "[3-6s] — b (m) | BLOCO: cta | zoom | | trilha | cut | 🎬 BROLL: x",
      { aspectRatio: "9:16" }
    );
    const clips = [join(out, "clip-00.mp4"), join(out, "clip-01.mp4")];
    const res = renderTimeline({ plan, clips, outPath: join(out, "final.mp4") });
    // neste ambiente não há ffmpeg -> fallback
    assert.equal(res.rendered, false);
    assert.ok(existsSync(res.script));
    const sh = readFileSync(res.script, "utf8");
    assert.match(sh, /ffmpeg -y/);
    assert.match(sh, /concat=n=2/);
    // textfile do corte com texto foi escrito
    assert.ok(existsSync(join(out, "text-00.txt")));
    assert.equal(readFileSync(join(out, "text-00.txt"), "utf8"), "TEXTO UM");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("renderTimeline exige um clipe por corte", () => {
  const plan = parseEditorPlan("[0-3s] — a (t) | BLOCO: hook", { aspectRatio: "9:16" });
  assert.throws(() => renderTimeline({ plan, clips: [], outPath: "x.mp4" }), /um clipe por corte/);
});
