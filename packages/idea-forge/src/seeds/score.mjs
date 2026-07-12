// @ts-check
/**
 * Pontua uma ideia (texto final capturado) contra o seed bank do operador,
 * gerando os dois sinais Pareto³ do banco vivo (ver PANDORA SEED BANK,
 * "Criterio de entrada"):
 *
 *   C1 — destrava >=3 frentes            -> ASSIMETRIA (asymmetry_score)
 *   C2 — compoe multiplicativamente com  -> SINERGIA   (synergy_score)
 *        >=2 seeds existentes / clusters
 *
 * Deterministico: nenhuma chamada de LLM, so similaridade de texto (TF
 * cosine) contra o texto de cada seed (titulo + destrava + corpo).
 */
import { tokenize, cosine } from "./similarity.mjs";
import { seedText } from "./parse.mjs";

const DEFAULT_MIN_SIMILARITY = 0.08;
const DEFAULT_TOP_N = 5;

/**
 * @param {string} ideaText
 * @param {import("./parse.mjs").Seed[]} seeds
 * @param {{minSimilarity?:number, topN?:number}} [opts]
 * @returns {{asymmetry_score:number, synergy_score:number, cluster_reach:number, matched:Array<{id:string, titulo:string, cluster:string|null, similarity:number}>}}
 */
export function scoreAgainstSeeds(ideaText, seeds, opts = {}) {
  const minSimilarity = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const list = Array.isArray(seeds) ? seeds : [];

  const ideaTokens = tokenize(ideaText || "");

  const scored = list
    .map((seed) => {
      const similarity = ideaTokens.length ? cosine(ideaTokens, tokenize(seedText(seed))) : 0;
      return { id: seed.id, titulo: seed.titulo || "", cluster: seed.cluster ?? null, similarity };
    })
    .filter((s) => s.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);

  const synergy_score = scored.length
    ? Math.round(100 * (scored.reduce((acc, m) => acc + m.similarity, 0) / scored.length))
    : 0;

  const matched = scored.map((s) => ({ ...s, similarity: round2(s.similarity) }));

  const clusters = new Set(matched.map((m) => m.cluster).filter((c) => c != null));
  const cluster_reach = clusters.size;

  const clusterComponent = Math.round(100 * Math.min(1, cluster_reach / 3));
  const breadthComponent = Math.round(100 * Math.min(1, matched.length / 5));
  const asymmetry_score = Math.round(0.6 * clusterComponent + 0.4 * breadthComponent);

  return { asymmetry_score, synergy_score, cluster_reach, matched };
}

/** @param {number} n */
function round2(n) {
  return Math.round(n * 100) / 100;
}

export default { scoreAgainstSeeds };
