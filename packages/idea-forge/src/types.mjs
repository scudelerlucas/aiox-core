// @ts-check
/**
 * Contratos de dados do pipeline IdeaForge (Sistema Agentico de Ideias).
 * JSDoc typedefs — sem dependencia de TypeScript. `node --check` valida sintaxe.
 *
 * Fluxo canonico (11 estagios):
 *   ingest -> atomize -> brainstorm -> steroid -> architect -> score
 *          -> dispatch -> simulate -> retroforja -> report -> canonize
 */

/**
 * Ordem canonica dos estagios e o "proximo" de cada um (padrao offerforge Etapa/PROXIMA).
 * Pipeline resumivel: o estado vive no store, nao na memoria.
 * @type {readonly string[]}
 */
export const STAGES = Object.freeze([
  "ingest",
  "atomize",
  "brainstorm",
  "steroid",
  "architect",
  "score",
  "dispatch",
  "simulate",
  "retroforja",
  "report",
  "canonize",
]);

/** @type {Record<string, string|null>} proximo estagio (null = terminal) */
export const NEXT = Object.freeze(
  STAGES.reduce((acc, s, i) => {
    acc[s] = STAGES[i + 1] ?? null;
    return acc;
  }, /** @type {Record<string, string|null>} */ ({}))
);

/** Canais de captura suportados. */
export const CHANNELS = Object.freeze([
  "telegram",
  "whatsapp",
  "claude-app",
  "claude-code",
  "cowork",
  "audio-file",
  "text",
]);

/** Limiar de qualidade (score 95+) exigido para liberar o dispatch. */
export const SCORE_GATE = 95;

/** Alvo de robustez do fluxo E2E: percentil 99.9%. */
export const PERCENTILE_TARGET = 99.9;

/** Confianca minima do banco sintetico (RETROFORJA-P sem dados reais). */
export const SYNTHETIC_DB_CONFIDENCE = 95;

/**
 * @typedef {Object} RawIdea
 * @property {string} id
 * @property {string} source            canal de origem (CHANNELS)
 * @property {string} transcript        texto da ideia (transcrito do audio ou digitado)
 * @property {string|null} audioRef      referencia ao audio original (path/url) se houver
 * @property {string} capturedAt         ISO timestamp
 * @property {Record<string, unknown>} meta
 */

/**
 * @typedef {Object} Atom
 * @property {string} text
 * @property {"claim"|"assumption"|"unknown"|"constraint"|"goal"} kind
 * @property {number} signal   0-100 (quanto contribui para o sinal da ideia)
 */

/**
 * @typedef {Object} AtomizedIdea
 * @property {string} coreThesis          a tese irredutivel (Occam)
 * @property {Atom[]} atoms
 * @property {number} signalToNoise       0-100
 * @property {string[]} noiseRemoved      trechos descartados como ruido
 */

/**
 * @typedef {Object} BrainstormedIdea
 * @property {string} sharpenedThesis
 * @property {string[]} variations        expansoes divergentes
 * @property {string[]} converged         as poucas linhas de maior sinal
 * @property {number} signalToNoise
 */

/**
 * @typedef {Object} FailureMode
 * @property {string} id                  F1..Fn
 * @property {string} name
 * @property {string} mechanism           como garante o fracasso (LIF/OP3LIF)
 * @property {boolean} lethal
 * @property {string} vaccine             protecao / antidoto
 */

/**
 * @typedef {Object} SteroidedIdea
 * @property {Object} tgm                 saida das alavancas TGM
 * @property {Object} op3lif              auditoria de modos de fracasso
 * @property {FailureMode[]} failureModes
 * @property {Object} antifragility       opcoes convexas / antifrageis
 * @property {number} confidence          0-100
 */

/**
 * @typedef {Object} StoryItem
 * @property {string} id                  ex "1.1"
 * @property {string} title
 * @property {string[]} acceptanceCriteria
 */

/**
 * @typedef {Object} ProjectBlueprint
 * @property {string} name
 * @property {string} slug
 * @property {string} prd                 markdown
 * @property {string} architecture        markdown
 * @property {StoryItem[]} stories
 * @property {string[]} qualityGates
 * @property {string[]} risks
 * @property {string[]} flows             fluxos E2E nomeados (usados pela simulacao)
 */

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} clarity
 * @property {number} traceability        Artigo IV — No Invention
 * @property {number} architecture
 * @property {number} testability
 * @property {number} antifragility
 */

/**
 * @typedef {Object} ScoredBlueprint
 * @property {number} score               0-100
 * @property {ScoreBreakdown} breakdown
 * @property {number} confidence          0-100
 * @property {boolean} passed             score >= SCORE_GATE
 * @property {string[]} gaps              o que falta para passar
 * @property {number} iterations          ciclos de self-heal ate passar
 */

/**
 * @typedef {Object} DispatchManifest
 * @property {string} projectSlug
 * @property {string} kickoffPrompt       prompt pronto para o Claude Code
 * @property {string[]} filesToCreate
 * @property {string[]} deployTargets
 * @property {string} branch
 */

/**
 * @typedef {Object} SimulationReport
 * @property {number} iterations
 * @property {number} percentile          percentil de fluxo alcancado
 * @property {boolean} reachedTarget       percentile >= PERCENTILE_TARGET
 * @property {Array<{iteration:number, runs:number, passed:number, percentile:number, breaks:string[]}>} history
 * @property {string[]} fixedBreaks        quebras de fluxo corrigidas ao longo dos ciclos
 */

/**
 * @typedef {Object} RetroforjaReport
 * @property {"real"|"synthetic"} dataSource
 * @property {number} dataConfidence       0-100
 * @property {Array<{metric:string, prediction:number, result:number, delta:number, diagnosis:"arquitetural"|"operacional"|"ok"}>} cycles
 * @property {number} backwardScore        0-100 (validacao de tras para frente)
 * @property {string[]} adjustments
 */

/**
 * @typedef {Object} PipelineState
 * @property {string} runId
 * @property {string} createdAt
 * @property {string} stage                 estagio atual/proximo a rodar
 * @property {boolean} done
 * @property {RawIdea} [raw]
 * @property {AtomizedIdea} [atomized]
 * @property {BrainstormedIdea} [brainstormed]
 * @property {SteroidedIdea} [steroided]
 * @property {ProjectBlueprint} [blueprint]
 * @property {ScoredBlueprint} [scored]
 * @property {DispatchManifest} [dispatch]
 * @property {SimulationReport} [simulation]
 * @property {RetroforjaReport} [retroforja]
 * @property {{reportPath:string, guidePath:string}} [report]
 * @property {{canonPath:string}} [canon]
 * @property {string[]} log
 */

export default { STAGES, NEXT, CHANNELS, SCORE_GATE, PERCENTILE_TARGET, SYNTHETIC_DB_CONFIDENCE };
