/**
 * factory.mjs — Motor de producao "infinita".
 *
 * "Infinito" = uma fonte de temas + geracao de angulos deterministica. A partir
 * de um seed ("marketing de conteudo") a fabrica deriva N angulos virais
 * distintos (hooks), vira briefs, e roda o pipeline em sequencia. Um state.json
 * evita reprocessar o mesmo brief.
 *
 * Sem LLM externo aqui: os angulos sao templates de retencao comprovados,
 * combinados com o tema. Isso mantem a fabrica offline-first e reproduzivel.
 * (Plugue um gerador de temas via CLI --topics para variedade ilimitada.)
 *
 * @module factory
 */

import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { runBrief } from "./pipeline.mjs";
import { slugify, ensureDir, writeJson } from "./util.mjs";

/** Angulos de hook de alta retencao (templates {t} = tema). */
const ANGLES = [
  "O erro nº1 que todo mundo comete em {t}",
  "Ninguem te conta essa verdade sobre {t}",
  "Como eu faria {t} do zero hoje",
  "3 sinais de que voce esta sabotando seu {t}",
  "Pare de fazer isso em {t} agora",
  "O que aprendi depois de anos com {t}",
  "A forma mais rapida de destravar {t}",
  "Isso mudou completamente meu {t}",
  "Por que 90% falham em {t}",
  "O segredo de {t} que ninguem aplica",
];

/**
 * Deriva N angulos deterministicos a partir de um seed.
 * @param {string} seed
 * @param {number} n
 * @returns {string[]} hooks
 */
export function generateAngles(seed, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const tpl = ANGLES[i % ANGLES.length];
    const round = Math.floor(i / ANGLES.length);
    const hook = tpl.replaceAll("{t}", seed);
    out.push(round === 0 ? hook : `${hook} (parte ${round + 1})`);
  }
  return out;
}

/**
 * Constroi briefs a partir de um seed + angulos.
 * @param {string} seed
 * @param {number} count
 * @param {Partial<import("./prompt-builder.mjs").Brief>} [base]
 * @returns {import("./prompt-builder.mjs").Brief[]}
 */
export function briefsFromSeed(seed, count, base = {}) {
  return generateAngles(seed, count).map((hook) => ({
    topic: seed,
    hook,
    cta: base.cta || "Segue pra parte 2.",
    ...base,
  }));
}

/**
 * Carrega briefs de um arquivo:
 *  - .json  => array de Brief (ou {briefs:[...]})
 *  - outro  => texto, 1 tema por linha (vira Brief {topic})
 * @param {string} path
 * @returns {import("./prompt-builder.mjs").Brief[]}
 */
export function loadBriefsFile(path) {
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".json")) {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.briefs || [];
    return arr.filter((b) => b && b.topic);
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((topic) => ({ topic }));
}

/**
 * Roda a fabrica sobre uma lista de briefs, com dedupe por state.json.
 * @param {import("./prompt-builder.mjs").Brief[]} briefs
 * @param {{
 *   config: import("./config.mjs").OmniConfig,
 *   preset: import("./formats.mjs").FormatPreset,
 *   persona: import("./persona.mjs").Persona,
 *   log?: (msg: string) => void,
 *   resume?: boolean
 * }} ctx
 * @returns {Promise<{results: import("./pipeline.mjs").RunResult[], skipped: number}>}
 */
export async function runFactory(briefs, ctx) {
  const log = ctx.log || (() => {});
  ensureDir(ctx.config.outDir);
  const statePath = join(ctx.config.outDir, "state.json");
  const state = ctx.resume ? loadState(statePath) : { done: {} };

  const results = [];
  let skipped = 0;

  for (const brief of briefs) {
    const key = `${slugify(brief.topic)}::${slugify(brief.hook || "")}::${ctx.preset.id}`;
    if (state.done[key]) {
      skipped++;
      log(`⤼ pulado (ja feito): ${key}`);
      continue;
    }
    const res = await runBrief(brief, ctx);
    results.push(res);
    state.done[key] = { id: res.id, status: res.status, dir: res.dir };
    writeJson(statePath, state);
  }

  log(`✔ fabrica concluida: ${results.length} gerado(s), ${skipped} pulado(s)`);
  return { results, skipped };
}

function loadState(path) {
  if (!existsSync(path)) return { done: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { done: {} };
  }
}
