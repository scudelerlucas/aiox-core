// @ts-check
/**
 * Estagio SCORE: quality gate. Pontua o blueprint em 5 dimensoes e exige >=95
 * com alta confianca. Se nao passar, roda self-heal (preenche gaps) e re-pontua,
 * ate o gate ou max iteracoes. Padrao CodeRabbit self-healing (max 2) generalizado.
 */
import { SCORE_GATE } from "../types.mjs";

const WEIGHTS = { clarity: 0.2, traceability: 0.25, architecture: 0.2, testability: 0.2, antifragility: 0.15 };
const MAX_HEAL = 4;

/**
 * @param {import("../types.mjs").ProjectBlueprint} bp
 * @param {import("../types.mjs").SteroidedIdea} ster
 * @returns {{score:number, breakdown:import("../types.mjs").ScoreBreakdown, confidence:number, gaps:string[]}}
 */
export function scoreBlueprint(bp, ster) {
  const gaps = [];

  // clarity
  let clarity = 60;
  if (bp.prd.length > 400) clarity += 15;
  if (/tese afiada/i.test(bp.prd)) clarity += 10;
  if (bp.flows.length >= 1) clarity += 15;
  else gaps.push("clarity: nenhum fluxo nomeado");
  clarity = clamp(clarity);

  // traceability (Artigo IV)
  const frCount = (bp.prd.match(/FR-\d+/g) || []).length;
  const risksMapped = bp.risks.filter((r) => /F-[A-Z]+/.test(r)).length;
  let traceability = 50;
  if (frCount >= 1) traceability += 20;
  else gaps.push("traceability: sem requisitos FR-*");
  // riscos totalmente mapeados a modos de fracasso — OU nenhum risco (ideia limpa
  // nao deve ser penalizada por ausencia de riscos).
  if (bp.risks.length === 0 || risksMapped === bp.risks.length) traceability += 20;
  if (/no invention|sem invencao|artigo iv/i.test(bp.prd)) traceability += 10;
  else gaps.push("traceability: falta nota No Invention");
  traceability = clamp(traceability);

  // architecture
  let architecture = 55;
  if (/isomorf/i.test(bp.architecture)) architecture += 20;
  if (bp.flows.length >= 2) architecture += 15;
  if (/cli first/i.test(bp.architecture)) architecture += 10;
  else gaps.push("architecture: falta principio CLI First");
  architecture = clamp(architecture);

  // testability
  const storiesWithAc = bp.stories.filter((s) => (s.acceptanceCriteria || []).length > 0).length;
  const acRatio = bp.stories.length ? storiesWithAc / bp.stories.length : 0;
  let testability = 40 + Math.round(acRatio * 30);
  if (bp.qualityGates.some((g) => /test/i.test(g))) testability += 15;
  else gaps.push("testability: sem gate de teste");
  if (bp.qualityGates.some((g) => /percentil|simula/i.test(g))) testability += 15;
  else gaps.push("testability: sem gate de simulacao E2E");
  testability = clamp(testability);

  // antifragility
  const fmCount = ster.failureModes.length;
  const vaccinated = bp.qualityGates.filter((g) => /vacina/i.test(g)).length;
  let antifragility = 55;
  if (fmCount === 0) antifragility += 20;
  else antifragility += Math.round((Math.min(vaccinated, fmCount) / fmCount) * 30);
  if (/barbell|antifrag/i.test(bp.prd)) antifragility += 15;
  else gaps.push("antifragility: falta barbell/AF no PRD");
  antifragility = clamp(antifragility);

  const breakdown = { clarity, traceability, architecture, testability, antifragility };
  const score = Math.round(
    clarity * WEIGHTS.clarity +
      traceability * WEIGHTS.traceability +
      architecture * WEIGHTS.architecture +
      testability * WEIGHTS.testability +
      antifragility * WEIGHTS.antifragility
  );
  // confianca: puxa para baixo pela pior dimensao (elo mais fraco)
  const min = Math.min(...Object.values(breakdown));
  const confidence = clamp(Math.round(score * 0.6 + min * 0.4));
  return { score, breakdown, confidence, gaps };
}

/**
 * Self-heal: preenche gaps no blueprint para subir o score.
 * @param {import("../types.mjs").ProjectBlueprint} bp
 * @param {string[]} gaps
 */
function heal(bp, gaps) {
  const next = structuredClone(bp);
  for (const g of gaps) {
    if (/No Invention/i.test(g) && !/artigo iv/i.test(next.prd)) {
      next.prd += "\n\n## Rastreabilidade (Artigo IV — No Invention)\nTodo enunciado deste PRD rastreia a um atomo, requisito FR-*, modo de fracasso OP3LIF ou alavanca TGM. Sem features inventadas.\n";
    }
    if (/CLI First/i.test(g) && !/cli first/i.test(next.architecture)) {
      next.architecture += "\n\n## CLI First\nToda funcionalidade opera 100% via CLI antes de qualquer UI.\n";
    }
    if (/gate de teste/i.test(g) && !next.qualityGates.some((x) => /test/i.test(x))) {
      next.qualityGates.push("test (>=80% dos fluxos cobertos)");
    }
    if (/gate de simulacao/i.test(g) && !next.qualityGates.some((x) => /percentil|simula/i.test(x))) {
      next.qualityGates.push("simulacao E2E >= percentil-alvo (99.9%)");
    }
    if (/barbell/i.test(g) && !/barbell/i.test(next.prd)) {
      next.prd += "\n\n## Antifragilidade\nBarbell: fundamentos deterministicos comprovados + apostas assimetricas que so agregam quando funcionam.\n";
    }
    if (/fluxo nomeado/i.test(g) && next.flows.length === 0) {
      next.flows.push("fluxo-principal");
    }
  }
  // garante AC em todas as stories
  for (const s of next.stories) {
    if (!s.acceptanceCriteria || s.acceptanceCriteria.length === 0) {
      s.acceptanceCriteria = ["Criterio de sucesso mensuravel definido e verificado."];
    }
  }
  return next;
}

/** @param {import("../types.mjs").PipelineState} state */
export async function score(state) {
  let bp = state.blueprint;
  const ster = state.steroided;
  let result = scoreBlueprint(bp, ster);
  let iterations = 0;
  while (result.score < SCORE_GATE && iterations < MAX_HEAL && result.gaps.length) {
    bp = heal(bp, result.gaps);
    result = scoreBlueprint(bp, ster);
    iterations++;
  }
  /** @type {import("../types.mjs").ScoredBlueprint} */
  const scored = {
    score: result.score,
    breakdown: result.breakdown,
    confidence: result.confidence,
    passed: result.score >= SCORE_GATE,
    gaps: result.gaps,
    iterations,
  };
  state.log.push(
    `[score] score=${scored.score} conf=${scored.confidence} passed=${scored.passed} (${iterations} self-heal)`
  );
  return { blueprint: bp, scored };
}

function clamp(x) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

export default { score, scoreBlueprint };
