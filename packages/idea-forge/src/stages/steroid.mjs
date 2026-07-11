// @ts-check
/**
 * Estagio STEROID: esteroida a ideia com TGM + OP3LIF + AF (antifragilidade).
 * Combina os tres engines deterministicos; LLM opcional enriquece a sintese.
 */
import { askJson } from "../llm.mjs";
import { tgm } from "../frameworks/tgm.mjs";
import { op3lif } from "../frameworks/op3lif.mjs";
import { antifragility } from "../frameworks/antifragility.mjs";

/**
 * @param {import("../types.mjs").AtomizedIdea} atom
 * @param {import("../types.mjs").BrainstormedIdea} brain
 * @returns {import("../types.mjs").SteroidedIdea}
 */
export function steroidDeterministic(atom, brain) {
  const idea = { thesis: brain.sharpenedThesis, atoms: atom.atoms, converged: brain.converged };
  const tgmOut = tgm(idea);
  // OP3LIF audita a ideia ORIGINAL (coreThesis + atomos), nao a tese ja polida —
  // senao os vacinas embutidos no brainstorm mascaram os modos de fracasso reais.
  const op3 = op3lif({ thesis: atom.coreThesis, atoms: atom.atoms });
  const af = antifragility({ failureModes: op3.failureModes, thesis: idea.thesis });

  // Confianca: parte de 70, sobe com S/N e isomorfismos, cai com modos letais.
  const lethal = op3.failureModes.filter((f) => f.lethal).length;
  const confidence = clamp(
    Math.round(70 + brain.signalToNoise * 0.2 + tgmOut.isomorfismos.length * 3 - lethal * 8),
    0,
    100
  );

  return {
    tgm: tgmOut,
    op3lif: { occam: op3.occam, pareto3: op3.pareto3, synthesis: op3.synthesis, rescue: op3.rescue },
    failureModes: op3.failureModes,
    antifragility: af,
    confidence,
  };
}

/** @param {import("../types.mjs").PipelineState} state */
export async function steroid(state) {
  const atom = state.atomized;
  const brain = state.brainstormed;
  const fallback = () => steroidDeterministic(atom, brain);
  const { value, note } = await askJson({
    system:
      "Voce e o motor de esteroide do IdeaForge. Aplique TGM (7 alavancas), OP3LIF (auditoria de modos de fracasso: " +
      "Occam/Pareto3/LIF/rescue) e AF (antifragilidade: via negativa, opcionalidade, redundancia, small bets/barbell). " +
      "Preserve o formato do fallback: {tgm, op3lif, failureModes[], antifragility, confidence}.",
    user: `Tese: ${brain.sharpenedThesis}\nConvergido: ${JSON.stringify(brain.converged)}\nAtomos: ${JSON.stringify(atom.atoms.slice(0, 8))}`,
    fallback,
    validate: (x) => !!x && Array.isArray(/** @type {any} */ (x).failureModes) && typeof (/** @type {any} */ (x).confidence) === "number",
  });
  state.log.push(`[steroid] ${note} — ${value.failureModes.length} modos de fracasso, confianca=${value.confidence}`);
  return { steroided: value };
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export default { steroid, steroidDeterministic };
