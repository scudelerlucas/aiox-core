// @ts-check
/**
 * TGM v4.1 — Motor de Serendipidade (engine deterministico das 7 alavancas).
 * Fonte canonica: docs/frameworks/TGM-v4.1-OS-canonico.md (Lucas-Contexto-Geral).
 * Alavancas: Radar Passivo, Grafo de Cruzamentos, Composicao de Isomorfismos,
 * Lacuna Assimetrica, Calibracao CQRG, RETROFORJA, MAESTRO.
 *
 * Este engine gera o SCAFFOLD deterministico (fallback). O LLM enriquece por cima.
 */

/** Padroes estruturais conhecidos p/ composicao de isomorfismos. */
const ISOMORPHISMS = [
  { pattern: "pipeline resumivel (estagios + estado no store)", when: /(fluxo|etapa|estagio|pipeline|processo|passo)/i },
  { pattern: "controlador PID (predicao -> resultado -> delta -> ajuste)", when: /(calibr|feedback|ajust|retro|melhora|loop)/i },
  { pattern: "loop adversarial convergente (tribunal com criterio de parada)", when: /(estress|valid|audit|critic|teste|qualidade)/i },
  { pattern: "maquina de estados com transicoes validas", when: /(estado|status|transic|etapa)/i },
  { pattern: "marketplace / rede de dois lados", when: /(operador|cliente|match|conecta|rede|marketplace)/i },
];

/**
 * @param {{thesis:string, atoms?:import("../types.mjs").Atom[], converged?:string[]}} idea
 */
export function tgm(idea) {
  const atoms = idea.atoms || [];
  const text = (idea.thesis || "") + " " + atoms.map((a) => a.text).join(" ");
  const terms = keyTerms(text);

  // A1 — Radar Passivo: sinais adjacentes emergentes (nao buscados ativamente)
  const radarPassivo = atoms
    .filter((a) => a.kind === "unknown" || a.kind === "assumption")
    .slice(0, 4)
    .map((a) => `Sinal latente: ${a.text}`);

  // A2 — Grafo de Cruzamentos: arestas nao-obvias entre termos-chave
  const grafoCruzamentos = crossings(terms).slice(0, 5);

  // A3 — Composicao de Isomorfismos: mapear a estrutura a um padrao que funciona
  const isomorfismos = ISOMORPHISMS.filter((i) => i.when.test(text)).map((i) => i.pattern);

  // A4 — Lacuna Assimetrica: onde pouco esforco gera retorno desproporcional
  const lacunaAssimetrica =
    (idea.converged && idea.converged[0]) ||
    (atoms.find((a) => a.kind === "goal")?.text ?? "Automatizar o passo manual mais repetido do fluxo.");

  // A5 — Calibracao CQRG: colapso/decisao de comprometimento
  const calibracaoCQRG = `Comprometer com o menor fluxo E2E que prove a tese "${short(idea.thesis)}" antes de qualquer expansao.`;

  // A6 — RETROFORJA: gancho do loop de feedback (usado no estagio retroforja)
  const retroforjaHook = "Declarar predicao de metrica por fluxo -> medir -> delta -> diagnostico (arquitetural x operacional).";

  // A7 — MAESTRO: orquestracao das alavancas
  const maestro = `Ordem: isomorfismo define a arquitetura; lacuna assimetrica define o MVP; CQRG define o corte; RETROFORJA fecha o loop.`;

  return {
    radarPassivo,
    grafoCruzamentos,
    isomorfismos: isomorfismos.length ? isomorfismos : [ISOMORPHISMS[0].pattern],
    lacunaAssimetrica,
    calibracaoCQRG,
    retroforjaHook,
    maestro,
  };
}

function keyTerms(text) {
  const stop = new Set(["para", "como", "esse", "essa", "isso", "sistema", "ideia", "quero", "preciso", "deve", "então", "entao", "mais", "cada", "todos", "todas", "onde", "aonde", "with", "that", "this", "from"]);
  const freq = new Map();
  for (const w of String(text).toLowerCase().match(/[a-záàâãéêíóôõúç0-9]{4,}/gi) || []) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

function crossings(terms) {
  const out = [];
  for (let i = 0; i < terms.length; i++)
    for (let j = i + 1; j < terms.length; j++) out.push(`${terms[i]} x ${terms[j]}`);
  return out;
}
function short(s) {
  return String(s || "").slice(0, 60);
}

export default { tgm };
