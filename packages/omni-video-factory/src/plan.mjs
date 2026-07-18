/**
 * plan.mjs — Ponte Editor OS → máquina de vídeos.
 *
 * O EDITOR OS (radar-editor-ia, modo=plano) emite um plano de edição
 * shot-by-shot em texto pipe-delimitado, um corte por linha:
 *
 *   [0-3s] — O QUE APARECE (emoção) | BLOCO: hook | ZOOM | TEXTO NA TELA | TRILHA | TRANSIÇÃO | 🎬 BROLL: query em inglês
 *
 * Este módulo converte esse texto (ou o JSON nativo `editor-os.plan/v1`) num
 * objeto estruturado e determinístico, e mapeia cada corte para a geração de
 * clipe da fábrica. É a INTERFACE ÚNICA que fecha o loop radar→roteiro→editor
 * →vídeo sem depender de reparsear texto livre em cada estágio.
 *
 * Sem rede, sem LLM: parser puro e testável.
 *
 * @module plan
 */

/**
 * @typedef {Object} PlanCut
 * @property {number} index
 * @property {number} start            segundos
 * @property {number} end              segundos
 * @property {number} duration         end - start
 * @property {"talking_head"|"broll"|"ai_clip"} sourceType
 * @property {string} visual           o que aparece
 * @property {string} emotion          emoção do corte
 * @property {string|null} block       BlockKey do Creative OS (hook, lead, ...) p/ atribuição de retenção
 * @property {string|null} brollQuery  query de B-roll em inglês (null = talking head)
 * @property {string} onScreenText     texto na tela (legenda/kinetic)
 * @property {string} zoom             efeito de zoom
 * @property {string} track            trilha/áudio
 * @property {string} transition       transição de entrada
 * @property {string} raw              linha original
 */

/**
 * @typedef {Object} EditorPlan
 * @property {"editor-os.plan/v1"} schema
 * @property {string} tema
 * @property {import("./formats.mjs").AspectRatio} aspectRatio
 * @property {string} language
 * @property {string[]} captions
 * @property {PlanCut[]} cuts
 * @property {string[]} checklist
 * @property {number} totalSeconds
 */

const BLOCK_KEYS = new Set([
  "hook", "lead", "problem", "agitation", "backstory", "mechanism",
  "proof", "offer", "value", "guarantee", "scarcity", "cta",
]);

/**
 * Converte o texto pipe-delimitado do Editor OS em EditorPlan.
 * Tolerante: identifica campos por rótulo (BLOCO:, BROLL:) quando presentes e
 * por posição quando não; nunca lança — linhas inválidas viram cortes "raw".
 *
 * @param {string} text
 * @param {{tema?: string, aspectRatio?: import("./formats.mjs").AspectRatio, language?: string, captions?: string[]}} [meta]
 * @returns {EditorPlan}
 */
export function parseEditorPlan(text, meta = {}) {
  const lines = String(text || "").split(/\r?\n/);
  const cuts = [];
  const checklist = [];
  let inChecklist = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    // Detecção de seção de checklist (heurística leve).
    if (/checklist/i.test(t) && !/^\[/.test(t)) {
      inChecklist = true;
      continue;
    }

    if (isCutLine(t)) {
      inChecklist = false;
      const cut = parseCut(t, cuts.length);
      if (cut) cuts.push(cut);
      continue;
    }

    if (inChecklist && /^[-*•\d]/.test(t)) {
      checklist.push(t.replace(/^[-*•\d.)\s]+/, "").trim());
    }
  }

  const totalSeconds = cuts.reduce((s, c) => Math.max(s, c.end), 0);
  return {
    schema: "editor-os.plan/v1",
    tema: meta.tema || "",
    aspectRatio: meta.aspectRatio || "9:16",
    language: meta.language || "pt-BR",
    captions: meta.captions || [],
    cuts,
    checklist,
    totalSeconds,
  };
}

/** Normaliza um JSON já no formato v1 (valida + preenche defaults). */
export function normalizePlan(obj) {
  if (obj && obj.schema === "editor-os.plan/v1" && Array.isArray(obj.cuts)) {
    return {
      ...obj,
      cuts: obj.cuts.map((c, i) => ({ index: i, duration: (c.end ?? 0) - (c.start ?? 0), ...c })),
      totalSeconds: obj.cuts.reduce((s, c) => Math.max(s, c.end ?? 0), 0),
    };
  }
  // Se veio {texto} do edge function, parseia.
  if (obj && typeof obj.texto === "string") {
    return parseEditorPlan(obj.texto, obj);
  }
  throw new Error("Plano inválido: esperado editor-os.plan/v1 ou {texto}");
}

function isCutLine(t) {
  // Começa com marcador de tempo: [0-3s], [0s], [00:03], [3], etc.
  return /^\[\s*\d/.test(t);
}

function parseCut(line, index) {
  const segs = line.split("|").map((s) => s.trim());
  const head = segs.shift() || "";

  // [tempo] — visual (emoção)
  const timeMatch = head.match(/^\[\s*([0-9:.]+)\s*[-–—a]?\s*([0-9:.]+)?\s*s?\s*\]/i);
  const start = timeMatch ? toSeconds(timeMatch[1]) : index * 3;
  const end = timeMatch && timeMatch[2] ? toSeconds(timeMatch[2]) : start + 3;
  const afterBracket = head.replace(/^\[[^\]]*\]\s*[—–-]?\s*/, "");
  const emotion = (afterBracket.match(/\(([^)]+)\)/)?.[1] || "").trim();
  const visual = afterBracket.replace(/\(([^)]+)\)/, "").trim();

  const cut = {
    index,
    start,
    end: end > start ? end : start + 3,
    duration: (end > start ? end : start + 3) - start,
    sourceType: "talking_head",
    visual,
    emotion,
    block: null,
    brollQuery: null,
    onScreenText: "",
    zoom: "",
    track: "",
    transition: "",
    raw: line,
  };

  // Só BLOCO e BROLL são rotulados no formato do Editor OS; o resto é posicional
  // (o texto-na-tela é o VALOR do segmento, não vem com prefixo "TEXTO:").
  const unlabeled = [];
  for (const seg of segs) {
    const bloco = seg.match(/^BLOCO\s*:?\s*([a-z_]+)/i);
    const broll = seg.match(/(?:🎬\s*)?B-?ROLL\s*:?\s*(.+)/i);
    if (bloco) {
      const key = bloco[1].toLowerCase();
      cut.block = BLOCK_KEYS.has(key) ? key : null;
    } else if (broll) {
      const q = broll[1].trim();
      if (q && q !== "—" && q !== "-") {
        cut.brollQuery = q;
        cut.sourceType = "broll";
      }
    } else {
      unlabeled.push(seg);
    }
  }
  // Posicional para os não-rotulados: zoom, texto-na-tela, trilha, transição.
  if (unlabeled[0]) cut.zoom = unlabeled[0];
  if (unlabeled[1]) cut.onScreenText = unlabeled[1];
  if (unlabeled[2]) cut.track = unlabeled[2];
  if (unlabeled[3]) cut.transition = unlabeled[3];

  return cut;
}

/** "0", "3", "00:03", "1:05" → segundos. */
function toSeconds(s) {
  const str = String(s).trim();
  if (str.includes(":")) {
    const [m, sec] = str.split(":").map(Number);
    return (m || 0) * 60 + (sec || 0);
  }
  return Math.round(parseFloat(str) || 0);
}

/**
 * Mapeia um EditorPlan para os inputs de geração da fábrica: um "clip spec" por
 * corte. Cortes talking_head usam a persona ("comigo"); cortes broll/ai_clip
 * usam a query/visual como prompt de geração.
 *
 * @param {EditorPlan} plan
 * @param {import("./persona.mjs").Persona} persona
 * @returns {Array<{index:number,durationSeconds:number,aspectRatio:string,prompt:string,sourceType:string,block:string|null,onScreenText:string,references:any[]}>}
 */
export function planToClipSpecs(plan, persona) {
  return plan.cuts.map((cut) => {
    const isTalkingHead = cut.sourceType === "talking_head";
    const prompt = isTalkingHead
      ? `${persona.loaded ? `A mesma pessoa das referências (${persona.name})` : persona.description}, ${cut.visual || "falando para a câmera"}${cut.emotion ? ` (${cut.emotion})` : ""}. Enquadramento ${plan.aspectRatio}, fala em ${plan.language}.`
      : `${cut.brollQuery || cut.visual}${cut.emotion ? ` (${cut.emotion})` : ""}, cinematic B-roll, ${plan.aspectRatio}.`;
    return {
      index: cut.index,
      durationSeconds: Math.max(2, Math.min(10, Math.round(cut.duration) || 3)),
      aspectRatio: plan.aspectRatio,
      prompt,
      sourceType: cut.sourceType,
      block: cut.block,
      onScreenText: cut.onScreenText,
      references: isTalkingHead ? persona.references : [],
    };
  });
}
