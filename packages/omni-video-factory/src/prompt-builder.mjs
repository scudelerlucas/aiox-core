/**
 * prompt-builder.mjs — Transforma um brief em prompt cinematografico para o Omni.
 *
 * Deterministico e sem rede: o mesmo brief sempre gera o mesmo prompt. Isso
 * mantem os videos reproduziveis e permite testar offline. O prompt segue a
 * estrutura que os modelos de video do Google respondem melhor:
 *   [SUJEITO] + [ACAO] + [AMBIENTE] + [CAMERA/LENTE] + [ESTILO] + [AUDIO].
 *
 * @module prompt-builder
 */

/**
 * @typedef {Object} Brief
 * @property {string} topic          Tema/assunto do video.
 * @property {string} [hook]         Frase de abertura (fala do personagem).
 * @property {string} [scene]        Descricao de cena/ambiente.
 * @property {string} [action]       O que o personagem faz.
 * @property {string} [cta]          Call-to-action final.
 * @property {string} [style]        Override de estilo textual.
 * @property {string} [language]     Idioma da fala (default pt-BR).
 */

/**
 * @typedef {Object} BuiltPrompt
 * @property {string} text           Prompt final enviado ao provider.
 * @property {string} negative       Prompt negativo.
 * @property {string} shortHook      Hook curto (uso em legenda/titulo).
 */

/**
 * @param {Brief} brief
 * @param {import("./formats.mjs").FormatPreset} preset
 * @param {import("./persona.mjs").Persona} persona
 * @returns {BuiltPrompt}
 */
export function buildPrompt(brief, preset, persona) {
  const language = brief.language || "pt-BR";
  const subject = describeSubject(persona);
  const hook = brief.hook || defaultHook(brief.topic);
  const action =
    brief.action || `fala diretamente para a camera sobre "${brief.topic}"`;
  const scene = brief.scene || inferScene(preset);
  const camera = cameraFor(preset);
  const style = brief.style || preset.styleTags.join(", ");
  const wardrobe = persona.wardrobe ? ` Vestindo ${persona.wardrobe}.` : "";

  const parts = [
    `${subject} ${action}.`,
    `Ambiente: ${scene}.${wardrobe}`,
    `Abertura (${preset.hookStyle}): "${hook}".`,
    `Camera: ${camera}. Ritmo: ${preset.pacing}.`,
    `Estilo: ${style}. Enquadramento ${preset.aspectRatio}.`,
    `Fala em ${language}, labios sincronizados, audio limpo.`,
    brief.cta ? `Fecha com CTA falado: "${brief.cta}".` : "",
  ].filter(Boolean);

  const negative = [
    "texto sobreposto distorcido",
    "maos deformadas",
    "rosto inconsistente",
    "watermark",
    "artefatos",
    persona.negative || "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    text: parts.join(" "),
    negative,
    shortHook: truncate(hook, 90),
  };
}

function describeSubject(persona) {
  if (persona.loaded) {
    // Imagens de referencia carregam a identidade; o texto ancora estilo.
    return `A mesma pessoa das imagens de referencia (${persona.name})`;
  }
  return persona.description || `Um apresentador (${persona.name})`;
}

function defaultHook(topic) {
  return `Ninguem te contou isso sobre ${topic}...`;
}

function inferScene(preset) {
  return preset.aspectRatio === "16:9"
    ? "estudio moderno com profundidade, luz suave e bokeh ao fundo"
    : "cenario limpo e proximo, luz natural, fundo desfocado";
}

function cameraFor(preset) {
  return preset.aspectRatio === "16:9"
    ? "lente 35mm, leve dolly-in, profundidade de campo rasa"
    : "close vertical, leve movimento de mao, foco no rosto";
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}
