// @ts-check
/**
 * Similaridade de texto deterministica, zero-dependencia (TF cosine sobre
 * bag-of-words). Sem embeddings/LLM — mesma filosofia de fallback
 * deterministico usada no resto do IdeaForge (ver src/llm.mjs).
 */

/** Stopwords pt/en de alta frequencia — nao carregam sinal para similaridade. */
const STOPWORDS = new Set([
  // portugues
  "para", "com", "uma", "um", "que", "nao", "sim", "por", "sobre", "como",
  "mais", "menos", "sao", "ser", "esta", "este", "esse", "essa", "isso",
  "seu", "sua", "seus", "suas", "dos", "das", "num", "numa", "nos", "nas",
  "pelo", "pela", "pelos", "pelas", "tem", "tem", "ate", "entre", "quando",
  "onde", "todo", "toda", "todos", "todas", "muito", "muita", "muitos",
  "muitas", "outro", "outra", "outros", "outras", "mesmo", "mesma", "ainda",
  "apenas", "tambem", "assim", "aqui", "ali", "cada", "qual", "quais",
  "porque", "pois", "entao", "voce", "eles", "elas", "nosso", "nossa",
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
  "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
  "man", "new", "now", "old", "see", "two", "way", "who", "boy", "did",
  "its", "let", "put", "say", "she", "too", "use", "with", "that", "this",
  "from", "have", "will", "your", "about", "into", "than", "then", "them",
  "these", "those", "what", "when", "where", "which",
]);

/**
 * Remove acentos/diacriticos de uma string (NFD + strip de combining marks).
 * @param {string} s
 * @returns {string}
 */
function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Tokeniza: minusculas, sem acento, split em nao-alfanumerico, remove
 * stopwords e tokens curtos (<3 chars).
 * @param {string} s
 * @returns {string[]}
 */
export function tokenize(s) {
  if (typeof s !== "string" || !s) return [];
  const normalized = stripAccents(s.toLowerCase());
  const raw = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  return raw.filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * @param {string[]} tokens
 * @returns {Map<string, number>}
 */
function termFreq(tokens) {
  /** @type {Map<string, number>} */
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return freq;
}

/**
 * Similaridade de cosseno entre dois bags-of-words (TF, sem IDF — banco
 * pequeno, IDF adicionaria complexidade sem ganho relevante aqui).
 * @param {string[]} aTokens
 * @param {string[]} bTokens
 * @returns {number} 0..1
 */
export function cosine(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = termFreq(aTokens);
  const b = termFreq(bTokens);
  let dot = 0;
  for (const [term, freqA] of a) {
    const freqB = b.get(term);
    if (freqB) dot += freqA * freqB;
  }
  if (dot === 0) return 0;
  const normA = Math.sqrt(Array.from(a.values()).reduce((acc, f) => acc + f * f, 0));
  const normB = Math.sqrt(Array.from(b.values()).reduce((acc, f) => acc + f * f, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export default { tokenize, cosine };
