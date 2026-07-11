// @ts-check
/**
 * Estagio BRAINSTORM: expande (divergencia) e converge (max sinal / min ruido).
 * Deterministico + LLM opcional.
 */
import { askJson } from "../llm.mjs";

const LENSES = [
  (t) => `E se o gargalo real nao for construir, mas capturar bem a ideia? -> ${t}`,
  (t) => `Versao minima que prova a tese em 1 fluxo: ${t}`,
  (t) => `Inversao: o que faria isso FALHAR na primeira semana? Blindar contra isso: ${t}`,
  (t) => `Quem e o operador e qual o passo manual mais caro que isso remove? ${t}`,
  (t) => `Composicao: isso ja e um padrao conhecido (pipeline/PID/tribunal) — reusar em vez de inventar: ${t}`,
];

/** @param {import("../types.mjs").AtomizedIdea} atom @returns {import("../types.mjs").BrainstormedIdea} */
export function brainstormDeterministic(atom) {
  const goals = atom.atoms.filter((a) => a.kind === "goal");
  const seed = atom.coreThesis;
  const variations = LENSES.map((f) => f(shorten(seed)));
  // convergencia: os atomos de maior sinal + metas
  const converged = dedupe([
    ...goals.slice(0, 2).map((g) => g.text),
    ...atom.atoms.slice(0, 3).map((a) => a.text),
  ]).slice(0, 4);
  const sharpenedThesis = sharpen(seed, goals);
  const signalToNoise = clamp(atom.signalToNoise + 5, 0, 100); // convergencia melhora S/N
  return { sharpenedThesis, variations, converged, signalToNoise };
}

/** @param {import("../types.mjs").PipelineState} state */
export async function brainstorm(state) {
  const atom = state.atomized;
  const fallback = () => brainstormDeterministic(atom);
  const { value, note } = await askJson({
    system:
      "Voce e o brainstormer do IdeaForge. Expanda a ideia em 5 variacoes por lentes distintas e depois convirja " +
      "para as poucas linhas de maior sinal. Retorne {sharpenedThesis, variations[], converged[], signalToNoise}.",
    user: `Tese: ${atom.coreThesis}\nAtomos: ${JSON.stringify(atom.atoms.slice(0, 8))}`,
    fallback,
    validate: (x) => !!x && Array.isArray(/** @type {any} */ (x).converged) && typeof (/** @type {any} */ (x).sharpenedThesis) === "string",
  });
  state.log.push(`[brainstorm] ${note} — ${value.variations.length} variacoes, convergido em ${value.converged.length}`);
  return { brainstormed: value };
}

function sharpen(seed, goals) {
  const verb = (goals[0]?.text.match(/(gerar|criar|construir|automat|entregar|transform|simular)\w*/i) || [])[0] || "construir";
  return `Sistema que ${verb.toLowerCase()} — ${shorten(seed)} — com fallback deterministico e loop de validacao ate percentil-alvo.`;
}
function shorten(s) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, 110);
}
function dedupe(xs) {
  return [...new Set(xs.filter(Boolean))];
}
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export default { brainstorm, brainstormDeterministic };
