// @ts-check
/**
 * Estagio RETROFORJA-P: validacao "de tras para frente".
 * Parte dos DADOS (reais se houver; senao banco sintetico @95% de confianca) e
 * verifica se eles reproduzem as PREDICOES do design. Ciclo canonico da RETROFORJA:
 * predicao -> resultado -> delta -> diagnostico (arquitetural x operacional) -> ajuste.
 * Fonte: skill pandora-retroforja-engine (controlador PID).
 */
import { SYNTHETIC_DB_CONFIDENCE } from "../types.mjs";
import { synthesizeDatabase, round2 } from "../store.mjs";

/** Predicoes derivadas do design (o que o blueprint promete). */
function predictionsFrom(bp, sim) {
  return {
    completionRate: 0.99, // gate de percentil E2E
    errorRate: 0.01,
    avgDurationMs: 10000,
    // se a simulacao atingiu o alvo, a predicao de robustez sobe
    _simPercentile: sim?.percentile ?? 0,
  };
}

const TOLERANCE = { completionRate: 0.03, errorRate: 0.03, avgDurationMs: 6000 };

/**
 * @param {import("../types.mjs").ProjectBlueprint} bp
 * @param {import("../types.mjs").SimulationReport} sim
 * @param {import("../types.mjs").SteroidedIdea} ster
 * @param {{sessions?:any[], metrics?:Record<string,number>}|null} realData
 * @returns {import("../types.mjs").RetroforjaReport}
 */
export function retroforjaDeterministic(bp, sim, ster, realData) {
  const hasReal = !!(realData && Array.isArray(realData.sessions) && realData.sessions.length);
  const db = hasReal
    ? { confidence: 100, sessions: realData.sessions, metrics: realData.metrics || computeMetrics(realData.sessions) }
    : synthesizeDatabase(bp, SYNTHETIC_DB_CONFIDENCE);

  const pred = predictionsFrom(bp, sim);
  const unvaccinated = ster.failureModes.filter((f) => !bp.qualityGates.some((g) => g.includes(f.id))).length;

  /** @type {import("../types.mjs").RetroforjaReport["cycles"]} */
  const cycles = [];
  for (const metric of ["completionRate", "errorRate", "avgDurationMs"]) {
    const prediction = pred[metric];
    const result = db.metrics[metric] ?? 0;
    const delta = round2(result - prediction);
    const tol = TOLERANCE[metric];
    let diagnosis = "ok";
    if (Math.abs(delta) > tol) {
      // arquitetural se ha modo de fracasso nao-vacinado ligado a taxa; senao operacional
      const rateMetric = metric === "completionRate" || metric === "errorRate";
      diagnosis = rateMetric && unvaccinated > 0 ? "arquitetural" : "operacional";
    }
    cycles.push({ metric, prediction, result, delta, diagnosis });
  }

  // score de validacao de tras para frente
  let penalty = 0;
  for (const c of cycles) {
    if (c.diagnosis === "arquitetural") penalty += 20;
    else if (c.diagnosis === "operacional") penalty += 8;
  }
  const backwardScore = clamp(100 - penalty);

  const adjustments = cycles
    .filter((c) => c.diagnosis !== "ok")
    .map((c) =>
      c.diagnosis === "arquitetural"
        ? `[ARQUITETURAL] ${c.metric}: delta ${c.delta} — redesenhar (vacinar modo de fracasso ligado).`
        : `[OPERACIONAL] ${c.metric}: delta ${c.delta} — ajustar execucao/disciplina (owner + prazo).`
    );

  return {
    dataSource: hasReal ? "real" : "synthetic",
    dataConfidence: db.confidence,
    cycles,
    backwardScore,
    adjustments: adjustments.length ? adjustments : ["Sem divergencia relevante: predicoes do design reproduzidas pelos dados."],
  };
}

/** @param {import("../types.mjs").PipelineState & {input?:any}} state */
export async function retroforja(state) {
  const realData = state.input?.realData || state.raw?.meta?.realData || null;
  const report = retroforjaDeterministic(state.blueprint, state.simulation, state.steroided, realData);
  state.log.push(
    `[retroforja] dados=${report.dataSource} (conf ${report.dataConfidence}%), backwardScore=${report.backwardScore}, ${report.adjustments.length} ajustes`
  );
  return { retroforja: report };
}

function computeMetrics(sessions) {
  const n = sessions.length || 1;
  const completed = sessions.filter((s) => s.completed).length;
  const durs = sessions.map((s) => Number(s.duration_ms) || 0);
  return {
    completionRate: round2(completed / n),
    errorRate: round2(1 - completed / n),
    avgDurationMs: round2(durs.reduce((a, b) => a + b, 0) / n),
    sampleSize: n,
  };
}
function clamp(x) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

export default { retroforja, retroforjaDeterministic };
