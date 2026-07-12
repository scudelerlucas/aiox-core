/**
 * pipeline.mjs — Brief -> prompt -> clips -> montagem -> saida.
 *
 * Fluxo por brief:
 *   1. build prompt (deterministico)
 *   2. quebra em N clips conforme o formato (beats: hook/valor/cta)
 *   3. gera cada clip via provider (Omni/Veo) ou registra dry-run
 *   4. monta com ffmpeg se disponivel; senao emite manifest + comando ffmpeg
 *   5. grava manifest.json auditavel
 *
 * @module pipeline
 */

import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { createProvider } from "./providers/gemini.mjs";
import { buildPrompt } from "./prompt-builder.mjs";
import { clipCount } from "./formats.mjs";
import {
  slugify,
  ensureDir,
  writeJson,
  writeText,
  hasFfmpeg,
  ffmpegConcat,
  ffmpegConcatCommand,
} from "./util.mjs";

const BEATS = ["hook", "desenvolvimento", "prova", "cta"];

/**
 * @typedef {Object} RunResult
 * @property {string} id
 * @property {string} dir
 * @property {boolean} dryRun
 * @property {string[]} clips        arquivos de clip gerados
 * @property {string|null} finalVideo
 * @property {string} manifest
 * @property {string} status         "generated" | "dry-run" | "clips-only"
 */

/**
 * Roda um unico brief e retorna o resultado.
 * @param {import("./prompt-builder.mjs").Brief} brief
 * @param {{
 *   config: import("./config.mjs").OmniConfig,
 *   preset: import("./formats.mjs").FormatPreset,
 *   persona: import("./persona.mjs").Persona,
 *   log?: (msg: string) => void
 * }} ctx
 * @returns {Promise<RunResult>}
 */
export async function runBrief(brief, ctx) {
  const { config, preset, persona } = ctx;
  const log = ctx.log || (() => {});
  const provider = createProvider(preset.provider, config);

  const built = buildPrompt(brief, preset, persona);
  const n = clipCount(preset);
  // Inclui um slug do hook para que angulos diferentes do mesmo tema nao
  // colidam no mesmo diretorio de saida.
  const hookSlug = brief.hook ? `-${slugify(brief.hook, 24)}` : "";
  const id = `${slugify(brief.topic)}-${preset.id}${hookSlug}`;
  const dir = ensureDir(join(config.outDir, id));

  log(`▶ ${id} — ${n} clip(s) via ${provider.name} (${provider.model})`);

  const clips = [];
  const clipMetas = [];
  for (let i = 0; i < n; i++) {
    const beat = BEATS[Math.min(i, BEATS.length - 1)];
    const clipPrompt =
      n > 1 ? `${built.text} [Batida ${i + 1}/${n}: ${beat}]` : built.text;

    const result = await provider.generate({
      prompt: clipPrompt,
      negative: built.negative,
      aspectRatio: preset.aspectRatio,
      durationSeconds: preset.clipSeconds,
      references: persona.references,
    });

    clipMetas.push({
      index: i,
      beat,
      prompt: clipPrompt,
      request: result.request,
      dryRun: result.dryRun,
    });

    if (result.bytes) {
      const clipPath = join(dir, `clip-${String(i).padStart(2, "0")}.mp4`);
      writeFileSync(clipPath, result.bytes);
      clips.push(clipPath);
      log(`  ✓ clip ${i + 1}/${n} salvo`);
    } else {
      log(`  · clip ${i + 1}/${n} (dry-run: prompt registrado)`);
    }
  }

  const manifest = writeManifest(dir, {
    id,
    brief,
    preset,
    persona: publicPersona(persona),
    prompt: built,
    clips: clipMetas,
    createdAtIso: null, // sem relogio no core; CLI carimba se quiser
  });

  // Montagem
  let finalVideo = null;
  let status = config.dryRun ? "dry-run" : "clips-only";

  if (clips.length === 1) {
    finalVideo = clips[0];
    status = "generated";
  } else if (clips.length > 1) {
    const outPath = join(dir, `${id}.mp4`);
    const listPath = join(dir, "concat.txt");
    if (hasFfmpeg()) {
      ffmpegConcat(clips, outPath, listPath);
      finalVideo = outPath;
      status = "generated";
      log(`  ✓ montado: ${outPath}`);
    } else {
      // Fallback gracioso: emite o comando para o usuario rodar depois.
      writeText(
        join(dir, "assemble.sh"),
        `#!/usr/bin/env bash\n# ffmpeg nao encontrado no ambiente de geracao.\n# Rode este comando onde houver ffmpeg para montar o video final:\n${ffmpegConcatCommand(listPath, outPath)}\n`
      );
      // garante a lista para o comando acima
      writeText(
        listPath,
        clips.map((p) => `file '${p}'`).join("\n") + "\n"
      );
      status = "clips-only";
      log(`  ⚠ ffmpeg ausente — clips salvos + assemble.sh gerado`);
    }
  }

  return { id, dir, dryRun: config.dryRun, clips, finalVideo, manifest, status };
}

function writeManifest(dir, data) {
  const path = join(dir, "manifest.json");
  writeJson(path, data);
  return path;
}

function publicPersona(persona) {
  // Nao vaza base64 das imagens no manifest.
  return {
    name: persona.name,
    description: persona.description,
    loaded: persona.loaded,
    referenceCount: persona.references.length,
  };
}
