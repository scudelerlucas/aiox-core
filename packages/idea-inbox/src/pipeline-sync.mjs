// @ts-check
/**
 * Execucao SINCRONA do pipeline para ambientes serverless (Vercel).
 * Serverless nao tem processo de fundo nem FS duravel: em vez de fire-and-forget,
 * rodamos o pipeline ate o fim (offline, ~100ms) e devolvemos o resumo inline.
 * O store usa /tmp (efemero) — os artefatos nao persistem entre invocacoes;
 * para persistir, configure IDEAFORGE_DIR para um volume/gancho externo.
 */
import { createRun, runAll, Store } from "@aiox/idea-forge";

/** runId de fallback quando o chamador nao passa um (ex: sem dedup.mjs). */
function fallbackRunId() {
  return `ib-${Date.now()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, "0")}`;
}

/** @param {import("@aiox/idea-forge").PipelineState} state */
function summarize(state) {
  return {
    runId: state.runId,
    done: state.done,
    project: state.blueprint?.name ?? null,
    score: state.scored?.score ?? null,
    passed: state.scored?.passed ?? null,
    percentile: state.simulation?.percentile ?? null,
    backwardScore: state.retroforja?.backwardScore ?? null,
    branch: state.dispatch?.branch ?? null,
    blocked: state.dispatch?.blocked ?? null,
  };
}

/**
 * @param {{source:string, text:string, audioRef?:string|null, dir?:string, runId?:string, until?:string, full?:boolean}} input
 */
export async function runSync(input) {
  const dir = input.dir || process.env.IDEAFORGE_DIR || "/tmp/idea-inbox";
  const store = new Store(dir);
  const runId = input.runId || fallbackRunId();
  const state = createRun({ runId, source: input.source, text: input.text, audioRef: input.audioRef ?? null });
  store.save(state);
  // BOUNDED por padrao: roda ate 'dispatch' (captura + gate 95+). A simulacao E2E
  // pesada e a RETROFORJA rodam no laco assincrono (realize/CI), nao no endpoint publico.
  const until = input.full ? undefined : input.until || "dispatch";
  await runAll(state, { store }, until);
  return summarize(state);
}

/**
 * Variante FULL do pipeline sincrono: roda ate o fim (simulacao E2E +
 * RETROFORJA-P + relatorio + canonize incluidos) e devolve tambem o estado
 * inteiro — usado pelo endpoint de diagnostico (T3.2), que precisa do
 * `PipelineState` completo para `generateReportHtml`. `runSync` (bounded,
 * usado no webhook publico) fica inalterado.
 * @param {{source:string, text:string, audioRef?:string|null, dir?:string, runId?:string}} input
 * @returns {Promise<{summary:ReturnType<typeof summarize>, state:import("@aiox/idea-forge").PipelineState}>}
 */
export async function runSyncFull(input) {
  const dir = input.dir || process.env.IDEAFORGE_DIR || "/tmp/idea-inbox";
  const store = new Store(dir);
  const runId = input.runId || fallbackRunId();
  const state = createRun({ runId, source: input.source, text: input.text, audioRef: input.audioRef ?? null });
  store.save(state);
  await runAll(state, { store }); // sem 'until' -> roda ate o fim (canonize inclusive)
  return { summary: summarize(state), state };
}

export default { runSync, runSyncFull };
