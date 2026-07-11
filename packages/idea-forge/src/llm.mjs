// @ts-check
/**
 * Cliente LLM com FALLBACK DETERMINISTICO obrigatorio.
 * Constituicao AIOX / regra "No LLM = no blocker": todo estagio funciona 100%
 * sem API (modo offline por fallback). O LLM e apenas enhancement opcional.
 *
 * Zero-dep: usa `fetch` global (Node 20+) direto na Messages API. Nenhum SDK.
 * Roteamento (ATOM-01): default = Sonnet.
 */

const DEFAULT_MODEL = process.env.IDEAFORGE_MODEL || "claude-sonnet-5";

/** Offline se pedido explicitamente ou se nao ha chave. */
export function isOffline() {
  if (process.env.IDEAFORGE_OFFLINE === "1") return true;
  return !process.env.ANTHROPIC_API_KEY;
}

/**
 * Executa uma chamada estruturada (JSON) ao LLM, com fallback deterministico.
 * O contrato de retorno e SEMPRE o mesmo objeto que o fallback produz, entao
 * os chamadores nunca precisam ramificar entre "com LLM" e "sem LLM".
 *
 * @template T
 * @param {Object} opts
 * @param {string} opts.system
 * @param {string} opts.user
 * @param {() => T} opts.fallback              gera o objeto deterministicamente
 * @param {(x:unknown) => x is T} [opts.validate]  type-guard opcional
 * @param {string} [opts.model]
 * @returns {Promise<{value:T, usedLlm:boolean, note:string}>}
 */
export async function askJson({ system, user, fallback, validate, model }) {
  if (isOffline()) {
    return { value: fallback(), usedLlm: false, note: "offline:fallback-deterministico" };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": String(process.env.ANTHROPIC_API_KEY),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 4096,
        system: system + "\n\nResponda APENAS com JSON valido, sem cercas de codigo.",
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = (data?.content?.[0]?.text ?? "").trim();
    const json = JSON.parse(stripFences(text));
    if (validate && !validate(json)) throw new Error("validacao falhou");
    return { value: /** @type {T} */ (json), usedLlm: true, note: "llm" };
  } catch (err) {
    // Falha de rede/parse/validacao NUNCA bloqueia o pipeline.
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    return { value: fallback(), usedLlm: false, note: `fallback-apos-erro:${msg}` };
  }
}

function stripFences(text) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export default { askJson, isOffline };
