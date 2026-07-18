/**
 * compositor.mjs — Editor de timeline (a capacidade que faltava).
 *
 * Recebe um `editor-os.plan/v1` + os clipes gerados (um por corte) e monta o
 * vídeo final via ffmpeg: normaliza cada clipe para o enquadramento do formato,
 * corta na duração do corte, QUEIMA o texto-na-tela, concatena na ordem e
 * (opcional) muxa uma faixa de áudio (voiceover/trilha).
 *
 * Robustez: o texto queimado usa `drawtext=textfile=` (não `text=`), evitando o
 * escaping frágil de aspas/dois-pontos no filtergraph. As funções que constroem
 * o filtergraph e o argv são puras e testáveis SEM ffmpeg. Se ffmpeg não existir
 * no ambiente, `renderTimeline` grava um `render.sh` reproduzível em vez de
 * falhar — mesmo contrato de degradação do resto do pacote.
 *
 * @module compositor
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasFfmpeg, ensureDir } from "./util.mjs";

/**
 * Dimensões de saída por aspect ratio (vertical/horizontal/quadrado).
 * @param {import("./formats.mjs").AspectRatio} aspect
 * @returns {{w:number,h:number}}
 */
export function dimensionsFor(aspect) {
  switch (aspect) {
    case "16:9": return { w: 1920, h: 1080 };
    case "1:1": return { w: 1080, h: 1080 };
    case "9:16":
    default: return { w: 1080, h: 1920 };
  }
}

/**
 * Constrói o `-filter_complex` para N cortes.
 * Cada input i: cobre+corta para WxH, fixa SAR, corta na duração, reseta PTS e
 * (se houver textfile) queima o texto-na-tela no terço superior. Depois concat.
 *
 * @param {Array<{duration:number, textFile:string|null}>} cuts
 * @param {{w:number,h:number,fontSize:number,fontFile?:string|null}} opts
 * @returns {string}
 */
export function buildFilterComplex(cuts, opts) {
  const { w, h, fontSize, fontFile } = opts;
  const parts = [];
  const labels = [];
  cuts.forEach((cut, i) => {
    const d = Math.max(1, Number(cut.duration) || 3);
    let chain =
      `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,` +
      `crop=${w}:${h},setsar=1,trim=duration=${d},setpts=PTS-STARTPTS`;
    if (cut.textFile) {
      const font = fontFile ? `fontfile='${fontFile}':` : "";
      chain +=
        `,drawtext=${font}textfile='${cut.textFile}':` +
        `fontcolor=white:fontsize=${fontSize}:box=1:boxcolor=black@0.5:boxborderw=${Math.round(fontSize / 4)}:` +
        `x=(w-text_w)/2:y=h*0.14:line_spacing=8`;
    }
    parts.push(`${chain}[v${i}]`);
    labels.push(`[v${i}]`);
  });
  parts.push(`${labels.join("")}concat=n=${cuts.length}:v=1:a=0[vout]`);
  return parts.join(";");
}

/**
 * Monta o argv completo do ffmpeg.
 * @param {{clips:string[], filterComplex:string, outPath:string, audioFile?:string|null, fps?:number}} o
 * @returns {string[]}
 */
export function buildFfmpegArgs({ clips, filterComplex, outPath, audioFile = null, fps = 30 }) {
  const args = ["-y"];
  for (const c of clips) args.push("-i", c);
  if (audioFile) args.push("-i", audioFile);
  args.push("-filter_complex", filterComplex, "-map", "[vout]");
  if (audioFile) args.push("-map", `${clips.length}:a`, "-shortest");
  args.push("-r", String(fps), "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "medium", outPath);
  return args;
}

/**
 * Renderiza (ou emite o script) a timeline de um plano.
 *
 * @param {object} o
 * @param {import("./plan.mjs").EditorPlan} o.plan
 * @param {string[]} o.clips        um arquivo de clipe por corte (mesma ordem)
 * @param {string} o.outPath        arquivo .mp4 de saída
 * @param {string} [o.audioFile]    faixa de áudio opcional (voiceover/trilha)
 * @param {string|null} [o.fontFile]
 * @param {(m:string)=>void} [o.log]
 * @returns {{rendered:boolean, outPath:string, script?:string, args:string[]}}
 */
export function renderTimeline({ plan, clips, outPath, audioFile = null, fontFile = null, log = () => {} }) {
  if (!Array.isArray(clips) || clips.length !== plan.cuts.length) {
    throw new Error(`clips (${clips?.length}) != cortes (${plan.cuts.length}) — um clipe por corte`);
  }
  const { w, h } = dimensionsFor(plan.aspectRatio);
  const dir = ensureDir(join(outPath, ".."));
  const fontSize = Math.round(h / 20);

  // Escreve os textfiles (evita escaping no filtergraph).
  const cuts = plan.cuts.map((cut, i) => {
    const text = (cut.onScreenText || "").trim();
    let textFile = null;
    if (text) {
      textFile = join(dir, `text-${String(i).padStart(2, "0")}.txt`);
      writeFileSync(textFile, text);
    }
    return { duration: Math.round(cut.duration) || 3, textFile };
  });

  const filterComplex = buildFilterComplex(cuts, { w, h, fontSize, fontFile });
  const args = buildFfmpegArgs({ clips, filterComplex, outPath, audioFile });

  if (hasFfmpeg()) {
    log(`  ⚙ renderizando timeline (${plan.cuts.length} cortes, ${w}x${h})…`);
    execFileSync("ffmpeg", args, { stdio: "ignore" });
    log(`  ✓ vídeo final: ${outPath}`);
    return { rendered: true, outPath, args };
  }

  // Fallback gracioso: script reproduzível.
  const script =
    `#!/usr/bin/env bash\n# ffmpeg ausente no ambiente de geração.\n` +
    `# Rode onde houver ffmpeg para montar o vídeo final:\nffmpeg ${args.map(shq).join(" ")}\n`;
  const scriptPath = join(dir, "render.sh");
  writeFileSync(scriptPath, script);
  log(`  ⚠ ffmpeg ausente — filtergraph + render.sh gerados em ${dir}`);
  return { rendered: false, outPath, script: scriptPath, args };
}

/** shell-quote simples para o render.sh. */
function shq(s) {
  return /[^A-Za-z0-9_./:@%+=-]/.test(s) ? `'${String(s).replace(/'/g, "'\\''")}'` : String(s);
}
