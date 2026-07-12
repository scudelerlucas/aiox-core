/**
 * providers/gemini.mjs — Clientes REST para Gemini OMNI Flash e Veo 3.1.
 *
 * Ambos os modelos vivem no Generative Language API e usam o padrao
 * long-running (`:predictLongRunning` -> poll da operation -> download do uri).
 * Zero dependencias: usa `fetch` nativo (Node >= 18).
 *
 *   - OMNI Flash: primario. Reasoning-model que gera video, aceita ate 7 imagens
 *     de referencia (persona "comigo") e faz edicao conversacional.
 *   - Veo 3.1: clips de 8s com scene-extension, ideal para YouTube horizontal.
 *
 * NOTA (API preview): o corpo exato do request do Omni Flash preview pode mudar.
 * Todo o mapeamento de campos esta centralizado em `buildRequestBody()` — ajuste
 * apenas ali quando a API estabilizar. O restante do pipeline nao muda.
 *
 * @module providers/gemini
 */

/**
 * @typedef {Object} GenerateSpec
 * @property {string} prompt
 * @property {string} [negative]
 * @property {import("../formats.mjs").AspectRatio} aspectRatio
 * @property {number} durationSeconds
 * @property {import("../persona.mjs").ReferenceImage[]} [references]
 * @property {string} [image]   base64 opcional (first-frame / image-to-video)
 */

/**
 * @typedef {Object} GenerateResult
 * @property {Buffer|null} bytes    video mp4 (null em dry-run).
 * @property {string} mime
 * @property {"omni"|"veo"} provider
 * @property {string} model
 * @property {object} request       corpo enviado (para auditoria/dry-run).
 * @property {boolean} dryRun
 */

/**
 * Fabrica um provider.
 * @param {"omni"|"veo"} name
 * @param {import("../config.mjs").OmniConfig} config
 */
export function createProvider(name, config) {
  const model = name === "veo" ? config.veoModel : config.omniModel;
  return {
    name,
    model,
    /** @param {GenerateSpec} spec @returns {Promise<GenerateResult>} */
    async generate(spec) {
      const request = buildRequestBody(name, model, spec);
      if (config.dryRun) {
        return { bytes: null, mime: "video/mp4", provider: name, model, request, dryRun: true };
      }
      const bytes = await runLongRunning(config, model, request);
      return { bytes, mime: "video/mp4", provider: name, model, request, dryRun: false };
    },
  };
}

/**
 * Mapeia a spec para o corpo do `:predictLongRunning`.
 * PONTO UNICO de acoplamento com o schema da API.
 * @param {"omni"|"veo"} name
 * @param {string} model
 * @param {GenerateSpec} spec
 */
export function buildRequestBody(name, model, spec) {
  const instance = { prompt: spec.prompt };
  if (spec.image) {
    instance.image = { bytesBase64Encoded: spec.image, mimeType: "image/jpeg" };
  }

  /** @type {Record<string, unknown>} */
  const parameters = {
    aspectRatio: spec.aspectRatio,
    durationSeconds: spec.durationSeconds,
    sampleCount: 1,
    personGeneration: "allow_all",
  };
  if (spec.negative) parameters.negativePrompt = spec.negative;

  // Persona "comigo": imagens de referencia (Omni aceita ate 7).
  if (spec.references && spec.references.length) {
    parameters.referenceImages = spec.references.map((r) => ({
      image: { bytesBase64Encoded: r.data, mimeType: r.mimeType },
      referenceType: "asset",
    }));
  }

  return { model, instances: [instance], parameters };
}

/**
 * Dispara a operacao, faz polling e baixa o video.
 * @param {import("../config.mjs").OmniConfig} config
 * @param {string} model
 * @param {object} body
 * @returns {Promise<Buffer>}
 */
async function runLongRunning(config, model, body) {
  const key = config.apiKey;
  const startUrl = `${config.apiBase}/models/${model}:predictLongRunning?key=${key}`;

  const op = await postJson(startUrl, body);
  const opName = op?.name;
  if (!opName) {
    throw new Error(`Resposta sem operation name: ${JSON.stringify(op).slice(0, 400)}`);
  }

  const done = await pollOperation(config, opName);
  const uri = extractVideoUri(done);
  if (!uri) {
    throw new Error(`Operacao concluida sem video uri: ${JSON.stringify(done).slice(0, 400)}`);
  }
  return downloadVideo(uri, key);
}

async function pollOperation(config, opName) {
  const url = `${config.apiBase}/${opName}?key=${config.apiKey}`;
  const deadline = timeNow() + config.pollTimeoutMs;
  // Loop de polling — nao usa relogio de parede para logica, apenas timeout.
  // eslint-disable-next-line no-constant-condition
  for (let i = 0; ; i++) {
    const res = await getJson(url);
    if (res?.done) {
      if (res.error) {
        throw new Error(`Operacao falhou: ${JSON.stringify(res.error).slice(0, 400)}`);
      }
      return res;
    }
    if (timeNow() > deadline) {
      throw new Error(`Timeout de polling (${config.pollTimeoutMs}ms) apos ${i} tentativas`);
    }
    await sleep(config.pollIntervalMs);
  }
}

/** Extrai o uri do video da resposta (tolerante a variacoes de shape). */
export function extractVideoUri(op) {
  const r = op?.response || {};
  return (
    r?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
    r?.generatedSamples?.[0]?.video?.uri ||
    r?.generatedVideos?.[0]?.video?.uri ||
    r?.videos?.[0]?.uri ||
    null
  );
}

async function downloadVideo(uri, key) {
  const url = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou (${res.status}) em ${uri}`);
  return Buffer.from(await res.arrayBuffer());
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle(res, url);
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "content-type": "application/json" } });
  return handle(res, url);
}

async function handle(res, url) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} em ${url.split("?")[0]}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta nao-JSON de ${url.split("?")[0]}: ${text.slice(0, 200)}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Isolado para permitir mock/teste sem depender de Date.now diretamente no loop.
function timeNow() {
  return Date.now();
}
