// @ts-check
/**
 * Estagio SIMULATE: loop adaptativo de simulacao E2E ate percentil-alvo (99.9%).
 * Cada iteracao: roda N execucoes simuladas dos fluxos; detecta quebras de fluxo;
 * corrige a quebra mais frequente; re-simula. Loop CONVERGENTE (max iteracoes +
 * criterio de saida) — inspirado no tribunal convergente do offerforge e no
 * gate por percentil do stressman.
 */
import { PERCENTILE_TARGET } from "../types.mjs";
import { makeRng, seedFrom } from "../store.mjs";

const RUNS_PER_ITER = 2000; // 1 falha em 2000 = 99.95%
const MAX_ITER = 10;

/**
 * Deriva as quebras latentes dos fluxos a partir dos modos de fracasso nao-vacinados
 * + quebras genericas de integracao. Cada quebra tem um peso (prob. de falha).
 * @param {import("../types.mjs").ProjectBlueprint} bp
 * @param {import("../types.mjs").SteroidedIdea} ster
 */
function deriveBreaks(bp, ster) {
  /** @type {Array<{id:string, desc:string, weight:number}>} */
  const breaks = [];
  for (const f of ster.failureModes) {
    // vacinado no blueprint? entao entra fraco; senao, forte.
    const vaccinated = bp.qualityGates.some((g) => g.includes(f.id));
    breaks.push({ id: f.id, desc: `${f.name} em ${bp.flows[0] || "fluxo"}`, weight: vaccinated ? 0.01 : 0.05 });
  }
  // quebras genericas de integracao E2E
  breaks.push({ id: "E2E-STATE", desc: "dessincronia de estado entre estagios", weight: 0.03 });
  breaks.push({ id: "E2E-TIMEOUT", desc: "timeout de dependencia externa", weight: 0.02 });
  breaks.push({ id: "E2E-EDGE", desc: "input de borda nao tratado", weight: 0.02 });
  return breaks;
}

/**
 * @param {import("../types.mjs").ProjectBlueprint} bp
 * @param {import("../types.mjs").SteroidedIdea} ster
 * @param {number} seed
 * @returns {import("../types.mjs").SimulationReport}
 */
export function simulateDeterministic(bp, ster, seed) {
  const rng = makeRng(seed);
  let active = deriveBreaks(bp, ster);
  const fixedBreaks = [];
  const history = [];

  for (let iter = 1; iter <= MAX_ITER; iter++) {
    const failProb = active.reduce((s, b) => s + b.weight, 0);
    let passed = 0;
    for (let r = 0; r < RUNS_PER_ITER; r++) {
      if (rng() >= failProb) passed++;
    }
    const percentile = round3((passed / RUNS_PER_ITER) * 100);
    const breaks = active.map((b) => `${b.id}: ${b.desc}`);
    history.push({ iteration: iter, runs: RUNS_PER_ITER, passed, percentile, breaks });

    if (percentile >= PERCENTILE_TARGET || active.length === 0) {
      return { iterations: iter, percentile, reachedTarget: percentile >= PERCENTILE_TARGET, history, fixedBreaks };
    }
    // corrige a quebra de maior peso (a mais impactante primeiro)
    active.sort((a, b) => b.weight - a.weight);
    const worst = active.shift();
    if (worst) fixedBreaks.push(`${worst.id}: ${worst.desc} (peso ${worst.weight})`);
  }

  const last = history[history.length - 1];
  return {
    iterations: MAX_ITER,
    percentile: last.percentile,
    reachedTarget: last.percentile >= PERCENTILE_TARGET,
    history,
    fixedBreaks,
  };
}

/** @param {import("../types.mjs").PipelineState} state */
export async function simulate(state) {
  const seed = seedFrom(state.runId + ":" + (state.blueprint?.slug || ""));
  const report = simulateDeterministic(state.blueprint, state.steroided, seed);
  state.log.push(
    `[simulate] ${report.iterations} iteracoes -> percentil ${report.percentile}% (alvo ${PERCENTILE_TARGET}%), ${report.fixedBreaks.length} quebras corrigidas, alvo ${report.reachedTarget ? "ATINGIDO" : "NAO atingido"}`
  );
  return { simulation: report };
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

export default { simulate, simulateDeterministic };
