/**
 * util.mjs — utilitarios sem dependencias.
 * @module util
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

/** slug estavel para nomes de arquivo/pasta. */
export function slugify(s, max = 48) {
  return (
    String(s || "video")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "video"
  );
}

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2));
}

export function writeText(path, text) {
  writeFileSync(path, text);
}

/** Detecta ffmpeg no PATH. Retorna true/false (nunca lanca). */
export function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Concatena mp4s com ffmpeg. Retorna true se executou. */
export function ffmpegConcat(clipPaths, outPath, concatListPath) {
  const list = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  writeFileSync(concatListPath, list + "\n");
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", outPath],
    { stdio: "ignore" }
  );
  return true;
}

/** Comando ffmpeg equivalente (para quando ffmpeg nao esta instalado). */
export function ffmpegConcatCommand(concatListPath, outPath) {
  return `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${outPath}"`;
}
