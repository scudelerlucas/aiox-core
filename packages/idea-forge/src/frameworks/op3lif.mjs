// @ts-check
/**
 * OP3LIF — auditoria por modos de fracasso (engine deterministico).
 * Metodo canonico (skill pandora-op3lif-audit): Occam -> Pareto3 -> LIF
 * (Inversao do Fracasso) -> Sintese -> Resgate Assimetrico.
 *
 * Aqui adaptado para auditar uma IDEIA DE PROJETO (nao uma escola de pensamento):
 * a pergunta-mestra da LIF vira "se eu quisesse GARANTIR que este projeto
 * fracasse, o que eu faria?" — e cada mecanismo ganha uma vacina.
 */

/**
 * Catalogo de mecanismos de fracasso recorrentes em projetos (referencia, nao checklist).
 * `detect(ctx)` -> true se o mecanismo esta presente/nao-mitigado no texto da ideia.
 */
const CATALOG = [
  {
    id: "F-VAL",
    name: "Ausencia de validador",
    mechanism: "Construir sem um criterio objetivo de sucesso; nunca saber se funciona.",
    lethal: true,
    vaccine: "Definir 1 metrica de sucesso mensuravel por fluxo antes de codar.",
    detect: (c) => !/(metric|kpi|valid|medi|conver|taxa|test)/i.test(c.text),
  },
  {
    id: "F-SPOF",
    name: "Ponto unico de falha",
    mechanism: "Um componente/pessoa/API cuja queda derruba todo o fluxo.",
    lethal: true,
    vaccine: "Fallback deterministico para cada dependencia externa (No LLM = no blocker).",
    detect: (c) => !/(fallback|redund|degrad|offline|resilien)/i.test(c.text),
  },
  {
    id: "F-SCOPE",
    name: "Escopo inflado",
    mechanism: "Tentar tudo de uma vez; nunca chegar a um MVP entregavel.",
    lethal: false,
    vaccine: "Pareto: cortar para o 20% que gera 80% do valor; MVP primeiro.",
    detect: (c) => c.atomCount > 12 || /(tudo|completo|todos os|full|end.?to.?end).*(e|,).*(tambem|alem)/i.test(c.text),
  },
  {
    id: "F-USER",
    name: "Usuario indefinido",
    mechanism: "Nao se sabe quem usa nem qual dor resolve; solucao a procura de problema.",
    lethal: false,
    vaccine: "Nomear o operador/ICP e a dor no PRD (Artigo IV — No Invention).",
    detect: (c) => !/(usuario|operador|cliente|lead|persona|quem|para\s+\w+\s+que)/i.test(c.text),
  },
  {
    id: "F-SCALE",
    name: "Escala prematura",
    mechanism: "Otimizar/escalar antes de provar o fluxo no percentil basico.",
    lethal: false,
    vaccine: "Make it work -> right -> fast. So escalar apos simulacao E2E passar.",
    detect: (c) => /(escal|milhoes|viral|todos os operadores|replicar)/i.test(c.text) && !/(mvp|primeiro|depois)/i.test(c.text),
  },
  {
    id: "F-OPAQUE",
    name: "Opacidade como profundidade",
    mechanism: "Complexidade que impede observar/depurar o que o sistema faz.",
    lethal: false,
    vaccine: "Observability Second: logar cada estagio; relatorio em linguagem simples.",
    detect: (c) => !/(log|observ|relatorio|report|transpar|debug)/i.test(c.text),
  },
  {
    id: "F-LOOP",
    name: "Loop sem convergencia",
    mechanism: "Ciclos de melhoria/estresse que nunca terminam (nao-deterministicos).",
    lethal: false,
    vaccine: "Loop convergente: alvo de percentil + max iteracoes + criterio de saida.",
    detect: (c) => /(loop|ciclo|itera|simula|estress)/i.test(c.text) && !/(percentil|max|criterio|alvo|ate)/i.test(c.text),
  },
];

/**
 * @param {{thesis:string, atoms?:import("../types.mjs").Atom[]}} idea
 * @returns {{occam:string, pareto3:{p1:string[],p2:string[],p3:string}, failureModes:import("../types.mjs").FailureMode[], synthesis:string, rescue:{keep:string[],replace:string[],vaccinate:string[]}}}
 */
export function op3lif(idea) {
  const text = (idea.thesis || "") + " " + (idea.atoms || []).map((a) => a.text).join(" ");
  const ctx = { text, atomCount: (idea.atoms || []).length };

  // 1. OCCAM — premissa irredutivel
  const occam = `Se removermos "${firstClause(idea.thesis)}", a ideia colapsa. Essa e a premissa irredutivel.`;

  // 2. PARETO3
  const atoms = (idea.atoms || []).slice().sort((a, b) => b.signal - a.signal);
  const p1 = atoms.slice(0, 5).map((a) => a.text);
  const p2 = atoms.filter((a) => a.kind === "goal" || a.kind === "claim").slice(0, 3).map((a) => a.text);
  const pareto3 = {
    p1,
    p2: p2.length ? p2 : p1.slice(0, 2),
    p3: "Energia desproporcional tende a ir para auto-legitimacao/refino do sistema, nao para o valor entregue.",
  };

  // 3. LIF — inversao do fracasso
  const failureModes = CATALOG.filter((m) => safeDetect(m.detect, ctx)).map((m) => ({
    id: m.id,
    name: m.name,
    mechanism: m.mechanism,
    lethal: m.lethal,
    vaccine: m.vaccine,
  }));

  // 4. SINTESE
  const lethal = failureModes.filter((f) => f.lethal);
  const synthesis = failureModes.length
    ? `${failureModes.length} mecanismos de fracasso detectados${lethal.length ? `, ${lethal.length} letais (${lethal.map((l) => l.id).join(", ")})` : ""}. Vacinar antes de arquitetar.`
    : "Nenhum mecanismo de fracasso critico detectado no texto; auditar novamente apos o blueprint.";

  // 5. RESGATE ASSIMETRICO
  const rescue = {
    keep: p1,
    replace: failureModes.filter((f) => !f.lethal).map((f) => `${f.name} -> ${f.vaccine}`),
    vaccinate: failureModes.map((f) => `${f.id}: ${f.vaccine}`),
  };

  return { occam, pareto3, failureModes, synthesis, rescue };
}

function safeDetect(fn, ctx) {
  try {
    return !!fn(ctx);
  } catch {
    return false;
  }
}
function firstClause(s) {
  return String(s || "").split(/[.,;]/)[0].trim().slice(0, 80) || "a tese central";
}

export default { op3lif };
