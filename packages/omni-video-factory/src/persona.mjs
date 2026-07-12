/**
 * persona.mjs — Consistencia de personagem ("comigo").
 *
 * Uma persona e uma pasta com imagens de referencia (seu rosto/corpo em varios
 * angulos) + um cartao de identidade. O Omni Flash aceita ate 7 imagens de
 * referencia; usamos essas imagens para manter VOCE consistente entre videos.
 *
 * Layout:
 *   personas/<nome>/
 *     persona.json          # { name, description, wardrobe, voice, negative }
 *     ref-*.{jpg,png,webp}  # imagens de referencia (ate 7 usadas)
 *
 * @module persona
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const MAX_REFS = 7; // limite documentado do Omni Flash

/**
 * @typedef {Object} ReferenceImage
 * @property {string} mimeType
 * @property {string} data     base64
 * @property {string} file     caminho de origem
 */

/**
 * @typedef {Object} Persona
 * @property {string} name
 * @property {string} description
 * @property {string} [wardrobe]
 * @property {string} [voice]
 * @property {string} [negative]     tracos a evitar
 * @property {ReferenceImage[]} references
 * @property {boolean} loaded        false = persona virtual (sem imagens)
 */

/**
 * Carrega uma persona a partir de personaDir/name.
 * Se a pasta nao existir, retorna uma persona "virtual" (so descricao textual),
 * garantindo que o pipeline nunca quebre por falta de imagens.
 *
 * @param {string} name
 * @param {string} personaDir
 * @returns {Persona}
 */
export function loadPersona(name, personaDir) {
  const dir = join(personaDir, name);
  if (!name || !existsSync(dir) || !statSync(dir).isDirectory()) {
    return {
      name: name || "narrador",
      description: name
        ? `Persona "${name}" (sem imagens de referencia — usando descricao textual)`
        : "Narrador generico",
      references: [],
      loaded: false,
    };
  }

  const meta = readPersonaMeta(dir, name);
  const references = readReferenceImages(dir);
  return { ...meta, references, loaded: references.length > 0 };
}

/** @returns {string[]} nomes de personas disponiveis */
export function listPersonas(personaDir) {
  if (!existsSync(personaDir)) return [];
  return readdirSync(personaDir).filter((n) => {
    const p = join(personaDir, n);
    return existsSync(p) && statSync(p).isDirectory();
  });
}

function readPersonaMeta(dir, name) {
  const metaPath = join(dir, "persona.json");
  const base = { name, description: `Persona ${name}` };
  if (!existsSync(metaPath)) return base;
  try {
    const parsed = JSON.parse(readFileSync(metaPath, "utf8"));
    return { ...base, ...parsed, name: parsed.name || name };
  } catch {
    return base;
  }
}

function readReferenceImages(dir) {
  const files = readdirSync(dir)
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .sort() // ordem estavel: ref-0, ref-1, ...
    .slice(0, MAX_REFS);

  return files.map((f) => {
    const p = join(dir, f);
    const ext = extname(f).toLowerCase();
    return {
      mimeType: MIME[ext] || "image/jpeg",
      data: readFileSync(p).toString("base64"),
      file: basename(p),
    };
  });
}
