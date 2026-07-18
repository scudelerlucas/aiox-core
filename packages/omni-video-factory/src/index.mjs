/**
 * @aiox/omni-video-factory — API publica.
 *
 * Fabrica de videos com Google Gemini OMNI (Omni Flash) + Veo 3.1.
 * CLI First: veja bin/omni-video.mjs. Esta e a superficie programatica.
 *
 * @module index
 */

export { loadConfig } from "./config.mjs";
export { BUILT_IN_FORMATS, clipCount } from "./formats.mjs";
export { loadPersona, listPersonas } from "./persona.mjs";
export { buildPrompt } from "./prompt-builder.mjs";
export { createProvider, buildRequestBody, extractVideoUri } from "./providers/gemini.mjs";
export { runBrief } from "./pipeline.mjs";
export { parseEditorPlan, normalizePlan, planToClipSpecs } from "./plan.mjs";
export { renderTimeline, buildFilterComplex, buildFfmpegArgs, dimensionsFor } from "./compositor.mjs";
export {
  runFactory,
  briefsFromSeed,
  generateAngles,
  loadBriefsFile,
} from "./factory.mjs";

import { loadConfig } from "./config.mjs";
import { BUILT_IN_FORMATS } from "./formats.mjs";
import { loadPersona } from "./persona.mjs";
import { runFactory, briefsFromSeed } from "./factory.mjs";

/**
 * Atalho de alto nivel: gera N videos a partir de um seed.
 * @param {Object} opts
 * @param {string} opts.seed
 * @param {number} [opts.count=1]
 * @param {string} [opts.format="reel-viral"]
 * @param {string} [opts.persona=""]
 * @param {Partial<import("./config.mjs").OmniConfig>} [opts.config]
 * @param {(msg:string)=>void} [opts.log]
 */
export async function produce({ seed, count = 1, format = "reel-viral", persona = "", config = {}, log } = {}) {
  const cfg = loadConfig(config);
  const preset = BUILT_IN_FORMATS[format];
  if (!preset) throw new Error(`Formato desconhecido: ${format}`);
  const p = loadPersona(persona, cfg.personaDir);
  const briefs = briefsFromSeed(seed, count);
  return runFactory(briefs, { config: cfg, preset, persona: p, log });
}
