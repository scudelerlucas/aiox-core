/**
 * config.mjs — Configuracao central da fabrica de videos.
 *
 * Fonte da verdade: variaveis de ambiente + defaults. CLI First: nenhuma UI
 * necessaria. Se GEMINI_API_KEY nao estiver setada, o pipeline roda em modo
 * dry-run (offline, deterministico) — nunca vira blocker.
 *
 * @module config
 */

/**
 * @typedef {Object} OmniConfig
 * @property {string|null} apiKey        Gemini API key (GEMINI_API_KEY|GOOGLE_API_KEY).
 * @property {string} apiBase            Base REST do Generative Language API.
 * @property {string} omniModel          Model id do Gemini Omni Flash.
 * @property {string} veoModel           Model id do Veo (clips longos / scene extension).
 * @property {string} outDir             Diretorio raiz de saida.
 * @property {string} personaDir         Diretorio com imagens de referencia (personas).
 * @property {number} pollIntervalMs     Intervalo de polling da long-running operation.
 * @property {number} pollTimeoutMs      Timeout total de polling.
 * @property {boolean} dryRun            Forca modo offline (sem chamadas de rede).
 */

const DEFAULTS = {
  apiBase: "https://generativelanguage.googleapis.com/v1beta",
  // OMNI = Gemini Omni Flash (Google I/O 2026). Reasoning-model que gera video.
  omniModel: "gemini-omni-flash-preview",
  // Veo 3.1 — clips de ate 8s com scene extension para videos longos (YouTube).
  veoModel: "veo-3.1-generate-preview",
  pollIntervalMs: 10_000,
  pollTimeoutMs: 10 * 60_000,
};

/**
 * Resolve a config a partir do ambiente + overrides.
 * @param {Partial<OmniConfig>} [overrides]
 * @returns {OmniConfig}
 */
export function loadConfig(overrides = {}) {
  const env = process.env;
  const apiKey =
    env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.OMNI_API_KEY || null;

  // Overrides com valor undefined nao devem sobrescrever defaults.
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined)
  );

  const cfg = {
    apiKey,
    apiBase: env.OMNI_API_BASE || DEFAULTS.apiBase,
    omniModel: env.OMNI_MODEL || DEFAULTS.omniModel,
    veoModel: env.VEO_MODEL || DEFAULTS.veoModel,
    outDir: env.OMNI_OUT_DIR || "output",
    personaDir: env.OMNI_PERSONA_DIR || "personas",
    pollIntervalMs: numFromEnv(env.OMNI_POLL_INTERVAL_MS, DEFAULTS.pollIntervalMs),
    pollTimeoutMs: numFromEnv(env.OMNI_POLL_TIMEOUT_MS, DEFAULTS.pollTimeoutMs),
    dryRun: false,
    ...defined,
  };

  // Sem chave => dry-run obrigatorio (fallback estatico, nunca bloqueia).
  if (!cfg.apiKey) cfg.dryRun = true;
  return cfg;
}

function numFromEnv(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
