// @ts-check
/**
 * Orquestrador do pipeline IdeaForge — resumivel, estado no store (offerforge).
 * Roda estagios na ordem canonica (STAGES/NEXT); salva apos cada um; pode
 * retomar de onde parou. Cada estagio e uma funcao pura-ish (state, ctx) -> patch.
 */
import { STAGES, NEXT } from "./types.mjs";
import { ingest } from "./ingest/index.mjs";
import { atomize } from "./stages/atomize.mjs";
import { brainstorm } from "./stages/brainstorm.mjs";
import { steroid } from "./stages/steroid.mjs";
import { architect } from "./stages/architect.mjs";
import { score } from "./stages/score.mjs";
import { dispatch } from "./stages/dispatch.mjs";
import { simulate } from "./stages/simulate.mjs";
import { retroforja } from "./stages/retroforja.mjs";
import { report } from "./stages/report.mjs";
import { canonize } from "./stages/canonize.mjs";

/** @type {Record<string, (state:any, ctx:any)=>Promise<any>>} */
export const REGISTRY = {
  ingest,
  atomize,
  brainstorm,
  steroid,
  architect,
  score,
  dispatch,
  simulate,
  retroforja,
  report,
  canonize,
};

/**
 * Cria um novo run.
 * @param {Object} opts
 * @param {string} opts.runId
 * @param {string} opts.source   canal (CHANNELS)
 * @param {string} opts.text     transcript / texto da ideia
 * @param {string|null} [opts.audioRef]
 * @param {Record<string, unknown>} [opts.meta]
 * @returns {import("./types.mjs").PipelineState}
 */
export function createRun({ runId, source, text, audioRef = null, meta = {} }) {
  return {
    runId,
    createdAt: nowIso(),
    stage: STAGES[0],
    done: false,
    // input bruto guardado para o estagio ingest normalizar
    // @ts-ignore campo auxiliar
    input: { source, text, audioRef, meta },
    log: [],
  };
}

/** Executa um unico estagio (o estagio atual de `state`). Salva no store. */
export async function step(state, ctx) {
  const stage = state.stage;
  if (!stage || state.done) return state;
  const fn = REGISTRY[stage];
  if (!fn) throw new Error(`estagio desconhecido: ${stage}`);
  const started = Date.now();
  const patch = (await fn(state, ctx)) || {};
  Object.assign(state, patch);
  const ms = Date.now() - started;
  state.log.push(`[${stage}] ok (${ms}ms)`);
  const next = NEXT[stage];
  state.stage = next;
  state.done = next === null;
  if (ctx?.store) ctx.store.save(state);
  return state;
}

/**
 * Roda o pipeline do estagio atual ate o fim (ou ate `until`, inclusivo).
 * @param {import("./types.mjs").PipelineState} state
 * @param {Object} ctx
 * @param {string} [until] estagio-alvo final (inclusivo); default = ate o fim
 */
export async function runAll(state, ctx, until) {
  let guard = 0;
  while (!state.done && guard++ < STAGES.length + 2) {
    const current = state.stage;
    await step(state, ctx);
    if (until && current === until) break;
  }
  return state;
}

function nowIso() {
  // Data injetavel para testes deterministicos.
  return process.env.IDEAFORGE_NOW || new Date().toISOString();
}

export default { REGISTRY, createRun, step, runAll };
