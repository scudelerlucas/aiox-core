// @ts-check
/**
 * Estagio ARCHITECT: gera artefatos no formato AIOX PRO a partir da ideia esteroidada.
 * Saidas: PRD, arquitetura, epics/stories, quality gates, riscos e fluxos E2E nomeados.
 * Artigo IV (No Invention): todo enunciado rastreia a um atomo / modo de fracasso / alavanca.
 */
import { askJson } from "../llm.mjs";

/**
 * @param {import("../types.mjs").RawIdea} raw
 * @param {import("../types.mjs").BrainstormedIdea} brain
 * @param {import("../types.mjs").SteroidedIdea} ster
 * @returns {import("../types.mjs").ProjectBlueprint}
 */
export function architectDeterministic(raw, brain, ster) {
  const name = deriveName(brain.sharpenedThesis);
  const slug = slugify(name);
  const goals = brain.converged.length ? brain.converged : [brain.sharpenedThesis];
  const flows = goals.slice(0, 4).map((g, i) => flowName(g, i));

  const stories = buildStories(goals, ster);
  const qualityGates = [
    "lint (0 erros)",
    "typecheck / node --check (0 erros)",
    "test (>=80% dos fluxos cobertos)",
    "build (sucesso)",
    "simulacao E2E >= percentil-alvo (99.9%)",
    ...ster.failureModes.map((f) => `gate-vacina ${f.id}: ${f.vaccine}`),
  ];
  const risks = ster.failureModes.map((f) => `${f.id} ${f.name}${f.lethal ? " (LETAL)" : ""} — mitigacao: ${f.vaccine}`);

  const prd = buildPrd({ name, raw, brain, ster, goals, flows });
  const architecture = buildArchitecture({ name, ster, flows, stories });

  return { name, slug, prd, architecture, stories, qualityGates, risks, flows };
}

/** @param {import("../types.mjs").PipelineState} state */
export async function architect(state) {
  const { raw, brainstormed: brain, steroided: ster } = state;
  const fallback = () => architectDeterministic(raw, brain, ster);
  const { value, note } = await askJson({
    system:
      "Voce e o arquiteto AIOX PRO. Gere um blueprint {name, slug, prd(markdown), architecture(markdown), " +
      "stories[{id,title,acceptanceCriteria[]}], qualityGates[], risks[], flows[]}. " +
      "Artigo IV No Invention: cada item rastreia a um atomo, modo de fracasso ou alavanca TGM. Preserve o formato do fallback.",
    user: `Tese: ${brain.sharpenedThesis}\nFluxos-alvo (goals): ${JSON.stringify(brain.converged)}\nModos de fracasso: ${JSON.stringify(ster.failureModes)}`,
    fallback,
    validate: (x) => !!x && typeof (/** @type {any} */ (x).prd) === "string" && Array.isArray(/** @type {any} */ (x).stories) && Array.isArray(/** @type {any} */ (x).flows),
  });
  state.log.push(`[architect] ${note} — ${value.stories.length} stories, ${value.flows.length} fluxos, ${value.qualityGates.length} gates`);
  return { blueprint: value };
}

function buildStories(goals, ster) {
  /** @type {import("../types.mjs").StoryItem[]} */
  const stories = [];
  stories.push({
    id: "1.1",
    title: "Fundacao + observabilidade + fallbacks",
    acceptanceCriteria: [
      "Cada dependencia externa tem fallback deterministico (No LLM = no blocker).",
      "Cada estagio loga entrada/saida (Observability Second).",
    ],
  });
  goals.forEach((g, i) => {
    stories.push({
      id: `1.${i + 2}`,
      title: `Fluxo: ${flowTitle(g)}`,
      acceptanceCriteria: [
        `Implementar o fluxo "${flowTitle(g)}" end-to-end.`,
        "Metrica de sucesso mensuravel definida e verificada (validador).",
        "Teste cobrindo caminho feliz + top-1 modo de falha.",
      ],
    });
  });
  const lethal = ster.failureModes.filter((f) => f.lethal);
  if (lethal.length) {
    stories.push({
      id: `1.${goals.length + 2}`,
      title: "Blindagem contra modos de fracasso letais",
      acceptanceCriteria: lethal.map((f) => `Vacinar ${f.id} ${f.name}: ${f.vaccine}`),
    });
  }
  return stories;
}

function buildPrd({ name, raw, brain, ster, goals, flows }) {
  return `# PRD — ${name}

## Origem
- Capturado via: **${raw.source}**${raw.audioRef ? ` (audio: ${raw.audioRef})` : ""}
- Ideia bruta (transcrita): "${short(raw.transcript, 240)}"

## Tese central (Occam)
${ster.op3lif.occam}

## Tese afiada
${brain.sharpenedThesis}

## Objetivos / Fluxos (traceabilidade — Artigo IV)
${goals.map((g, i) => `- **FR-${i + 1}** ${g}  \n  _fluxo:_ \`${flows[i] || flowName(g, i)}\``).join("\n")}

## Concentracao de valor (Pareto³)
- **Pareto¹ (nucleo):** ${list(ster.op3lif.pareto3.p1)}
- **Pareto² (impacto):** ${list(ster.op3lif.pareto3.p2)}
- **Pareto³ (dreno de energia):** ${ster.op3lif.pareto3.p3}

## Modos de fracasso (OP3LIF / LIF) e vacinas
${ster.failureModes.map((f) => `- **${f.id} ${f.name}**${f.lethal ? " ⚠️ LETAL" : ""}: ${f.mechanism}  \n  _vacina:_ ${f.vaccine}`).join("\n") || "- Nenhum modo critico detectado."}

## Antifragilidade (AF)
- ${ster.antifragility.barbell}
${ster.antifragility.convexResponses.map((c) => `- **[${c.type}]** ${c.action}`).join("\n")}

## Nao-objetivos
- Nada fora dos fluxos FR-* acima (sem invencao).

## Metrica de aceite global
- Simulacao E2E atinge **percentil 99.9%** e RETROFORJA-P valida de tras para frente.
`;
}

function buildArchitecture({ name, ster, flows, stories }) {
  const iso = ster.tgm.isomorfismos[0] || "pipeline resumivel";
  return `# Arquitetura — ${name}

## Padrao estrutural (Composicao de Isomorfismos — TGM A3)
Isomorfico a: **${iso}**. Reusar o padrao em vez de inventar.
${ster.tgm.isomorfismos.map((i) => `- ${i}`).join("\n")}

## Lacuna Assimetrica (TGM A4 — onde focar o MVP)
${ster.tgm.lacunaAssimetrica}

## Orquestracao (MAESTRO — TGM A7)
${ster.tgm.maestro}

## Componentes -> Stories
${stories.map((s) => `- **${s.id}** ${s.title}`).join("\n")}

## Fluxos E2E (alvos da simulacao)
${flows.map((f) => `- \`${f}\``).join("\n")}

## Principios (Constituicao AIOX)
- CLI First: toda funcionalidade roda 100% via CLI antes de qualquer UI.
- Observability Second: cada estagio observavel/logado.
- No LLM = no blocker: fallback deterministico obrigatorio por dependencia.

## Loop de fechamento (RETROFORJA — TGM A6)
${ster.tgm.retroforjaHook}
`;
}

// helpers
function deriveName(thesis) {
  const verb = (String(thesis).match(/(gera|cria|construi|automat|transform|simula|valida)\w*/i) || ["Forge"])[0];
  const noun = (String(thesis).match(/\b(ideia|projeto|fluxo|sistema|deploy|quiz|conteudo|dados)\b/i) || ["Idea"])[0];
  return cap(noun) + cap(verb).slice(0, 6) + "X";
}
function flowName(g, i) {
  return slugify(flowTitle(g)) || `flow-${i + 1}`;
}
function flowTitle(g) {
  return String(g).replace(/^[-\s]*/, "").split(/[.,;:]/)[0].trim().slice(0, 48) || "fluxo-principal";
}
function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
function short(s, n) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
}
function list(xs) {
  return (xs || []).filter(Boolean).join("; ") || "—";
}
function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

export default { architect, architectDeterministic };
