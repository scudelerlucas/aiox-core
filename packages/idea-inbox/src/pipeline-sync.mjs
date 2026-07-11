// @ts-check
/**
 * Execucao SINCRONA do pipeline para ambientes serverless (Vercel).
 * Serverless nao tem processo de fundo nem FS duravel: em vez de fire-and-forget,
 * rodamos o pipeline ate o fim (offline, ~100ms) e devolvemos o resumo inline.
 * O store usa /tmp (efemero) — os artefatos nao persistem entre invocacoes;
 * para persistir, configure IDEAFORGE_DIR para um volume/gancho externo.
 */
import { createRun, runAll, Store } from "@aiox/idea-forge";

/**
 * @param {{source:string, text:string, audioRef?:string|null, dir?:string, runId?:string, until?:string, full?:boolean}} input
 */
export async function runSync(input) {
  const dir = input.dir || process.env.IDEAFORGE_DIR || "/tmp/idea-inbox";
  const store = new Store(dir);
  const runId = input.runId || `ib-${Date.now()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, "0")}`;
  const state = createRun({ runId, source: input.source, text: input.text, audioRef: input.audioRef ?? null });
  store.save(state);
  // BOUNDED por padrao: roda ate 'dispatch' (captura + gate 95+). A simulacao E2E
  // pesada e a RETROFORJA rodam no laco assincrono (realize/CI), nao no endpoint publico.
  const until = input.full ? undefined : input.until || "dispatch";
  await runAll(state, { store }, until);
  return {
    runId,
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

export default { runSync };
