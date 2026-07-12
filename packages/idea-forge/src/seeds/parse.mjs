// @ts-check
/**
 * Parser do "seed bank" (banco vivo de seeds Pareto³) do operador. Formato
 * MISTO no mesmo arquivo (evolução historica do banco):
 *
 *  - Seeds antigas: blocos separados por linhas "-----", campos YAML-ish
 *    (`id:`, `titulo:`, `destrava:` + bullets, `compoe_com:` + bullets,
 *    `tipo:`, `forja_tier:`, `status:` ...), seguidos de um paragrafo de
 *    corpo (prosa) tambem delimitado por "-----".
 *  - Seeds novas: heading H2 `## SXXX — <titulo>` com campos em negrito
 *    (`**Status:**`, `**Cluster:**`, `**Componível com:**` ...) e corpo em
 *    prosa.
 *
 * Contrato: nunca lanca. Um bloco malformado e simplesmente pulado — o
 * parser prioriza extrair o maximo de sinal do banco real, nao validar
 * schema estrito (Artigo IV — No Invention: nao inventamos campos que nao
 * existem no bloco, so preenchemos default seguro).
 */

/**
 * @typedef {Object} Seed
 * @property {string} id
 * @property {string} titulo
 * @property {string} body
 * @property {string[]} destrava      frentes que a seed destrava (sinal de ASSIMETRIA — C1)
 * @property {string[]} compoeCom     ids de outras seeds com que compoe (sinal de SINERGIA — C2)
 * @property {string|null} tipo
 * @property {number|null} forjaTier
 * @property {string|null} status
 * @property {string|null} cluster    ex "K10" — null se latente/nao-atribuido
 */

const SEED_ID_RE = /S(\d{3,})/g;

/**
 * Extrai os textos de campo em negrito estilo `**Label:** conteudo...` de um
 * bloco H2, parando no proximo campo em negrito de inicio de linha ou no fim
 * do bloco.
 * @param {string} text
 * @param {string} label
 * @returns {string|null}
 */
function extractBoldField(text, label) {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[^\\n*]+:\\*\\*|\\n-{3,}\\s*$|$)`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Extrai IDs de seed (SXXX) unicos de um texto livre, excluindo opcionalmente
 * o proprio id (evita self-reference em "compoe_com"/"componivel com").
 * @param {string|null|undefined} text
 * @param {string} [excludeId]
 * @returns {string[]}
 */
function extractSeedIds(text, excludeId) {
  if (!text) return [];
  const ids = new Set();
  let m;
  SEED_ID_RE.lastIndex = 0;
  while ((m = SEED_ID_RE.exec(text))) {
    const id = `S${m[1]}`;
    if (id !== excludeId) ids.add(id);
  }
  return Array.from(ids);
}

/**
 * Parseia um bloco de metadados estilo YAML-ish (formato antigo). Tolerante
 * a indentacao inconsistente: normaliza cada linha via trim antes de ler.
 * @param {string} chunk
 * @returns {Record<string, string|string[]>}
 */
function parseYamlishMeta(chunk) {
  const lines = chunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  /** @type {Record<string, string|string[]>} */
  const meta = {};
  let listKey = null;
  for (const line of lines) {
    if (line.startsWith("-") && listKey) {
      const val = line.replace(/^-+\s*/, "").trim();
      /** @type {string[]} */ (meta[listKey]).push(val);
      continue;
    }
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) {
      const key = kv[1].toLowerCase();
      const val = kv[2].trim();
      if (key === "destrava" || key === "compoe_com") {
        meta[key] = [];
        listKey = key;
      } else {
        meta[key] = val;
        listKey = null;
      }
    }
    // linhas que nao batem com nada (ruido de markdown) sao ignoradas.
  }
  return meta;
}

/**
 * Divide o markdown em blocos "-----" e retorna as seeds do formato antigo
 * (metadados `id:` seguidos, no bloco seguinte, do corpo em prosa).
 * @param {string} md
 * @returns {Seed[]}
 */
function parseLegacyFormat(md) {
  const chunks = md.split(/\n-{3,}\s*\n/);
  /** @type {Seed[]} */
  const seeds = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const trimmed = chunk.trim();
    if (!/^id:\s*S\d{3,}/im.test(trimmed)) continue;
    try {
      const meta = parseYamlishMeta(chunk);
      const id = typeof meta.id === "string" ? meta.id.trim() : "";
      if (!/^S\d{3,}$/.test(id)) continue;

      // corpo: proximo chunk, se existir e nao for ele mesmo um bloco de
      // metadados novo (heuristica: nao comeca com "id:" nem e heading H2).
      let body = "";
      const next = chunks[i + 1];
      if (next && !/^\s*id:\s*S\d{3,}/im.test(next) && !/^\s*##\s/.test(next.trim())) {
        body = next.trim();
      }

      const destrava = Array.isArray(meta.destrava) ? meta.destrava : [];
      const compoeComRaw = Array.isArray(meta.compoe_com) ? meta.compoe_com : [];
      const compoeCom = compoeComRaw
        .map((item) => extractSeedIds(item, id)[0] || item.trim())
        .filter(Boolean);

      const forjaTierNum = typeof meta.forja_tier === "string" ? parseInt(meta.forja_tier, 10) : NaN;

      seeds.push({
        id,
        titulo: typeof meta.titulo === "string" ? meta.titulo : "",
        body,
        destrava,
        compoeCom,
        tipo: typeof meta.tipo === "string" ? meta.tipo : null,
        forjaTier: Number.isFinite(forjaTierNum) ? forjaTierNum : null,
        status: typeof meta.status === "string" ? meta.status : null,
        cluster: null,
      });
    } catch {
      // bloco malformado: pula, nunca lanca.
      continue;
    }
  }
  return seeds;
}

/**
 * Monta o corpo em prosa de um bloco H2 preferindo os campos narrativos
 * (Origem/Definição/Princípio fundamental); cai para o bloco inteiro (sem o
 * heading) se nenhum desses campos existir.
 * @param {string} text
 * @returns {string}
 */
function bodyFromH2Block(text) {
  const parts = [];
  for (const label of ["Origem", "Definição", "Definicao", "Princípio fundamental", "Principio fundamental"]) {
    const v = extractBoldField(text, label);
    if (v) parts.push(v);
  }
  if (parts.length) return parts.join("\n\n");
  return text
    .replace(/^##[^\n]*\n?/, "")
    .replace(/\*\*[^*\n]+:\*\*/g, "")
    .trim();
}

/**
 * Extrai as seeds do formato novo: heading H2 `## SXXX — titulo` seguido de
 * campos em negrito. Cada bloco vai ate o proximo heading H2 (de qualquer
 * tipo) ou fim do arquivo.
 * @param {string} md
 * @returns {Seed[]}
 */
function parseH2Format(md) {
  const lines = md.split(/\r?\n/);
  const headingIdx = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+S\d{3,}\b/.test(lines[i])) headingIdx.push(i);
  }
  /** @type {Seed[]} */
  const seeds = [];
  for (const start of headingIdx) {
    try {
      let end = lines.length;
      for (let j = start + 1; j < lines.length; j++) {
        if (/^##\s+/.test(lines[j])) {
          end = j;
          break;
        }
      }
      const block = lines.slice(start, end).join("\n");
      const headingMatch = lines[start].match(/^##\s+(S\d{3,})\s*[—\-:]?\s*(.*)$/);
      if (!headingMatch) continue;
      const id = headingMatch[1];
      const titulo = (headingMatch[2] || "").trim();

      const statusField = extractBoldField(block, "Status");
      const clusterField = extractBoldField(block, "Cluster");
      const componivelField =
        extractBoldField(block, "Componível com") || extractBoldField(block, "Componivel com");

      const clusterMatch = clusterField ? clusterField.match(/K\d+/) : null;

      seeds.push({
        id,
        titulo,
        body: bodyFromH2Block(block),
        destrava: [],
        compoeCom: extractSeedIds(componivelField, id),
        tipo: null,
        forjaTier: null,
        status: statusField,
        cluster: clusterMatch ? clusterMatch[0] : null,
      });
    } catch {
      // bloco malformado: pula, nunca lanca.
      continue;
    }
  }
  return seeds;
}

/**
 * Parseia o seed bank inteiro (ambos os formatos, misturados no mesmo
 * arquivo). Nunca lanca — blocos malformados sao pulados.
 * @param {string} md
 * @returns {Seed[]}
 */
export function parseSeedBank(md) {
  if (typeof md !== "string" || !md.trim()) return [];
  let legacy = [];
  let h2 = [];
  try {
    legacy = parseLegacyFormat(md);
  } catch {
    legacy = [];
  }
  try {
    h2 = parseH2Format(md);
  } catch {
    h2 = [];
  }
  // dedup por id (formato novo tem precedencia — pode ser um patch/refinamento
  // de uma seed que tambem aparece, por algum motivo, em bloco antigo).
  /** @type {Map<string, Seed>} */
  const byId = new Map();
  for (const s of legacy) byId.set(s.id, s);
  for (const s of h2) byId.set(s.id, s);
  return Array.from(byId.values());
}

/**
 * Texto usado para similaridade: titulo + frentes que destrava + corpo.
 * @param {Seed} seed
 * @returns {string}
 */
export function seedText(seed) {
  const destrava = Array.isArray(seed.destrava) ? seed.destrava.join(" ") : "";
  return `${seed.titulo || ""} ${destrava} ${seed.body || ""}`.trim();
}

export default { parseSeedBank, seedText };
