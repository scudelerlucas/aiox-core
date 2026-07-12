/**
 * formats.mjs — Presets de formato de video.
 *
 * Um preset descreve a *intencao de canal*: dimensao (aspect ratio), duracao,
 * ritmo, e diretrizes de estilo que alimentam o prompt-builder. Adicione novos
 * presets em presets/*.json (carregados dinamicamente) sem tocar no core.
 *
 * @module formats
 */

/** @typedef {"9:16"|"16:9"|"1:1"} AspectRatio */

/**
 * @typedef {Object} FormatPreset
 * @property {string} id
 * @property {string} label
 * @property {AspectRatio} aspectRatio
 * @property {number} clipSeconds     Duracao por clip (Omni: 3-10s).
 * @property {number} targetSeconds   Duracao total desejada (define nro de clips).
 * @property {"omni"|"veo"} provider  Provider preferido para o formato.
 * @property {string} pacing          Diretriz de ritmo p/ o prompt.
 * @property {string[]} styleTags     Tags de estilo cinematografico.
 * @property {string} hookStyle       Como abrir os 1.5s iniciais (retencao).
 */

/** @type {Record<string, FormatPreset>} */
export const BUILT_IN_FORMATS = {
  "reel-viral": {
    id: "reel-viral",
    label: "Reel viral (IG/TikTok base)",
    aspectRatio: "9:16",
    clipSeconds: 8,
    targetSeconds: 8,
    provider: "omni",
    pacing: "corte rapido, energia alta, primeiro frame para o hook",
    styleTags: ["cinematic", "punchy", "high-contrast", "handheld-natural"],
    hookStyle:
      "abre com pattern-interrupt visual + fala direta na camera nos primeiros 1.5s",
  },
  shorts: {
    id: "shorts",
    label: "YouTube Shorts",
    aspectRatio: "9:16",
    clipSeconds: 8,
    targetSeconds: 24,
    provider: "veo",
    pacing: "3 batidas: hook, valor, CTA",
    styleTags: ["cinematic", "clean", "bright"],
    hookStyle: "pergunta provocativa nos primeiros 2s",
  },
  "youtube-horizontal": {
    id: "youtube-horizontal",
    label: "YouTube horizontal (long-form base)",
    aspectRatio: "16:9",
    clipSeconds: 8,
    targetSeconds: 32,
    provider: "veo",
    pacing: "narrativa continua com scene-extension entre clips",
    styleTags: ["cinematic", "warm", "depth-of-field", "professional"],
    hookStyle: "cold-open visual + promessa de valor nos primeiros 5s",
  },
  square: {
    id: "square",
    label: "Feed quadrado 1:1",
    aspectRatio: "1:1",
    clipSeconds: 6,
    targetSeconds: 6,
    provider: "omni",
    pacing: "loop perfeito, comeco = fim",
    styleTags: ["cinematic", "loopable", "minimal"],
    hookStyle: "movimento continuo que convida ao replay",
  },
};

/**
 * Numero de clips necessarios para cobrir targetSeconds.
 * @param {FormatPreset} preset
 * @returns {number}
 */
export function clipCount(preset) {
  return Math.max(1, Math.ceil(preset.targetSeconds / preset.clipSeconds));
}

/**
 * Une os presets built-in com presets/*.json (se o diretorio existir).
 * Presets externos com o mesmo id sobrescrevem os built-in (extend-only).
 * @param {string} [dir]
 * @returns {Record<string, FormatPreset>}
 */
export async function loadFormats(dir) {
  const merged = { ...BUILT_IN_FORMATS };
  if (!dir) return merged;
  const { existsSync, readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  if (!existsSync(dir)) return merged;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    try {
      const p = JSON.parse(readFileSync(join(dir, f), "utf8"));
      if (p && p.id) merged[p.id] = { ...merged[p.id], ...p };
    } catch {
      /* ignora preset invalido */
    }
  }
  return merged;
}
