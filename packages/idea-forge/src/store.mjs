// @ts-check
/**
 * Persistencia do pipeline + "banco artificial".
 * Zero-dep: estado em JSON no disco (o estado vive no store, nao na memoria —
 * padrao resumivel do offerforge). Tambem provê o gerador de banco sintetico
 * usado pelo RETROFORJA-P quando nao ha dados reais.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** PRNG deterministico (mulberry32) — simulacoes reproduziveis e testaveis. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash estavel de string -> uint32 (para semear o RNG a partir do runId/tese). */
export function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Store {
  /** @param {string} baseDir */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.runsDir = join(baseDir, "runs");
    mkdirSync(this.runsDir, { recursive: true });
  }

  /** @param {string} runId */
  path(runId) {
    return join(this.runsDir, `${runId}.json`);
  }

  /** @param {import("./types.mjs").PipelineState} state */
  save(state) {
    writeFileSync(this.path(state.runId), JSON.stringify(state, null, 2));
    return state;
  }

  /** @param {string} runId @returns {import("./types.mjs").PipelineState} */
  load(runId) {
    const p = this.path(runId);
    if (!existsSync(p)) throw new Error(`run nao encontrado: ${runId}`);
    return JSON.parse(readFileSync(p, "utf8"));
  }

  /** @param {string} runId */
  exists(runId) {
    return existsSync(this.path(runId));
  }

  /**
   * Persiste um artefato auxiliar (relatorio, canon, dispatch) no dir do run.
   * @param {string} runId @param {string} name @param {string} content
   */
  writeArtifact(runId, name, content) {
    const dir = join(this.runsDir, runId);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, name);
    writeFileSync(p, content);
    return p;
  }
}

/**
 * Gera um banco de dados sintetico a partir dos fluxos do blueprint,
 * com nivel de confianca declarado. Usado pelo RETROFORJA-P quando nao
 * ha dados reais de producao. Deterministico (seed = tese do projeto).
 *
 * @param {import("./types.mjs").ProjectBlueprint} blueprint
 * @param {number} confidence 0-100
 * @param {number} [n] quantidade de sessoes sinteticas
 * @returns {{confidence:number, sessions:Array<Record<string, number|boolean|string>>, metrics:Record<string, number>}}
 */
export function synthesizeDatabase(blueprint, confidence, n = 500) {
  const rng = makeRng(seedFrom(blueprint.slug + ":" + confidence));
  const noise = (100 - confidence) / 100; // menos confianca => mais dispersao
  const flows = blueprint.flows.length ? blueprint.flows : ["default-flow"];
  const sessions = [];
  for (let i = 0; i < n; i++) {
    const flow = flows[Math.floor(rng() * flows.length)];
    // taxa de sucesso base alta, perturbada pelo ruido (1 - confianca)
    const base = 0.9;
    const success = rng() < base - noise * (rng() * 0.5);
    sessions.push({
      session_id: `${blueprint.slug}-syn-${i}`,
      flow,
      completed: success,
      steps: 3 + Math.floor(rng() * 6),
      duration_ms: Math.round(4000 + rng() * 12000 + noise * 8000 * rng()),
      error: success ? "" : pick(rng, ["timeout", "validation", "state-desync", "nil-ref"]),
    });
  }
  const completed = sessions.filter((s) => s.completed).length;
  const metrics = {
    completionRate: round2(completed / n),
    avgDurationMs: round2(mean(sessions.map((s) => Number(s.duration_ms)))),
    errorRate: round2(1 - completed / n),
    sampleSize: n,
  };
  return { confidence, sessions, metrics };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
export function stdDev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
export function round2(x) {
  return Math.round(x * 100) / 100;
}

export default { Store, synthesizeDatabase, makeRng, seedFrom, mean, stdDev, round2 };
