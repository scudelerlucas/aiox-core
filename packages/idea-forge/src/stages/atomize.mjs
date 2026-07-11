// @ts-check
/**
 * Estagio ATOMIZE: transcript -> atomos classificados, maximo sinal / minimo ruido.
 * Deterministico (fallback) + enriquecimento opcional por LLM.
 */
import { askJson } from "../llm.mjs";

const KIND_RULES = [
  { kind: "goal", re: /(quero|preciso|objetivo|meta|para\s+que|deve\s+(gerar|entregar|fazer)|entregar)/i },
  { kind: "constraint", re: /(nunca|sempre|somente|apenas|precisa\s+ser|tem\s+que|limite|regra|obrigat)/i },
  { kind: "unknown", re: /(talvez|nao\s+sei|como\s+fazer|duvida|incerto|\?|sera\s+que)/i },
  { kind: "assumption", re: /(acho|suponho|provavelmente|assumo|imagino|deveria)/i },
];

/** @param {string} transcript @returns {import("../types.mjs").AtomizedIdea} */
export function atomizeDeterministic(transcript) {
  const clauses = splitClauses(transcript);
  /** @type {import("../types.mjs").Atom[]} */
  const atoms = [];
  const noiseRemoved = [];
  for (const c of clauses) {
    const signal = signalScore(c);
    if (signal < 25 || c.length < 12) {
      noiseRemoved.push(c);
      continue;
    }
    atoms.push({ text: c, kind: classify(c), signal });
  }
  atoms.sort((a, b) => b.signal - a.signal);
  const coreThesis =
    atoms.find((a) => a.kind === "goal")?.text || atoms[0]?.text || transcript.slice(0, 120) || "(ideia vazia)";
  const totalSignal = atoms.reduce((s, a) => s + a.signal, 0);
  const totalNoise = noiseRemoved.reduce((s, c) => s + (100 - signalScore(c)), 0) || 1;
  const signalToNoise = clamp(Math.round((totalSignal / (totalSignal + totalNoise)) * 100), 0, 100);
  return { coreThesis, atoms, signalToNoise, noiseRemoved };
}

/** @param {import("../types.mjs").PipelineState} state */
export async function atomize(state) {
  const transcript = state.raw?.transcript || state.input?.text || "";
  const fallback = () => atomizeDeterministic(transcript);
  const { value, usedLlm, note } = await askJson({
    system:
      "Voce e o atomizador de ideias do IdeaForge. Decomponha a ideia em atomos com maximo sinal e minimo ruido. " +
      "Cada atomo: {text, kind: goal|claim|assumption|unknown|constraint, signal: 0-100}. " +
      "Retorne {coreThesis, atoms, signalToNoise, noiseRemoved}.",
    user: `Ideia (transcrita de ${state.raw?.source || "texto"}):\n"""${transcript}"""`,
    fallback,
    validate: (x) => !!x && Array.isArray(/** @type {any} */ (x).atoms) && typeof (/** @type {any} */ (x).coreThesis) === "string",
  });
  state.log.push(`[atomize] ${note} — ${value.atoms.length} atomos, S/N=${value.signalToNoise}`);
  return { atomized: value, _usedLlm: usedLlm };
}

function splitClauses(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+|\s*>\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function classify(clause) {
  for (const r of KIND_RULES) if (r.re.test(clause)) return r.kind;
  return "claim";
}
function signalScore(clause) {
  const len = clause.length;
  const words = clause.split(/\s+/).length;
  const hasVerb = /(gerar|criar|fazer|construir|automat|entregar|validar|deploy|rodar|transform|simular|corrigir)/i.test(clause);
  const filler = /(tipo|ai|entao|assim|sabe|meio que|na verdade|enfim)/i.test(clause);
  let s = 40;
  s += Math.min(30, words * 2);
  if (hasVerb) s += 20;
  if (len > 40) s += 10;
  if (filler) s -= 25;
  return clamp(s, 0, 100);
}
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export default { atomize, atomizeDeterministic };
