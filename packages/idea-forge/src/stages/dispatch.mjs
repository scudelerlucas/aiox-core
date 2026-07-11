// @ts-check
/**
 * Estagio DISPATCH: empacota o projeto para o Claude Code realizar + deployar.
 * Gera um manifesto de dispatch + um kickoff prompt pronto, e escreve os
 * artefatos (PRD, arquitetura, kickoff) no diretorio do run.
 * Gate: se o score nao passou (95+), o manifesto sai marcado como bloqueado.
 */
import { SCORE_GATE } from "../types.mjs";

/** @param {import("../types.mjs").PipelineState} state @param {{store?:any}} ctx */
export async function dispatch(state, ctx) {
  const bp = state.blueprint;
  const scored = state.scored;
  const branch = `feat/${bp.slug}`;

  const filesToCreate = [
    "package.json",
    "README.md",
    "src/index.mjs",
    ...bp.flows.map((f) => `src/flows/${f}.mjs`),
    ...bp.flows.map((f) => `test/${f}.test.mjs`),
    "docs/PRD.md",
    "docs/ARCHITECTURE.md",
  ];
  const deployTargets = detectDeploy(bp);

  const kickoffPrompt = buildKickoff({ bp, scored, branch, deployTargets });

  /** @type {import("../types.mjs").DispatchManifest & {blocked:boolean, note:string}} */
  const manifest = {
    projectSlug: bp.slug,
    kickoffPrompt,
    filesToCreate,
    deployTargets,
    branch,
    blocked: !scored.passed,
    note: scored.passed
      ? `Liberado: score ${scored.score} >= ${SCORE_GATE}, confianca ${scored.confidence}.`
      : `BLOQUEADO: score ${scored.score} < ${SCORE_GATE}. Gaps: ${scored.gaps.join("; ")}.`,
  };

  if (ctx?.store) {
    ctx.store.writeArtifact(state.runId, "PRD.md", bp.prd);
    ctx.store.writeArtifact(state.runId, "ARCHITECTURE.md", bp.architecture);
    ctx.store.writeArtifact(state.runId, "KICKOFF.md", kickoffPrompt);
    ctx.store.writeArtifact(state.runId, "dispatch-manifest.json", JSON.stringify(manifest, null, 2));
  }

  state.log.push(`[dispatch] ${manifest.blocked ? "BLOQUEADO" : "liberado"} — branch ${branch}, ${filesToCreate.length} arquivos`);
  return { dispatch: manifest };
}

function detectDeploy(bp) {
  const t = (bp.prd + bp.architecture).toLowerCase();
  const targets = [];
  if (/next|react|vercel|dashboard|ui|frontend/.test(t)) targets.push("vercel");
  if (/supabase|postgres|rls|banco|database/.test(t)) targets.push("supabase");
  if (/cli|node|package/.test(t)) targets.push("npm");
  return targets.length ? targets : ["local"];
}

function buildKickoff({ bp, scored, branch, deployTargets }) {
  return `# KICKOFF — ${bp.name}

> Dispatch gerado pelo IdeaForge. Score ${scored.score}/100 (confianca ${scored.confidence}). ${scored.passed ? "APROVADO" : "REVISAR gaps antes de codar"}.

## Instrucoes para o Claude Code
1. Crie/entre na branch \`${branch}\`.
2. Implemente as stories abaixo em ordem, story-driven. Toda dependencia externa precisa de fallback deterministico.
3. Rode os quality gates antes de cada commit: ${bp.qualityGates.slice(0, 5).join(" · ")}.
4. Apos o deploy, rode ciclos de simulacao E2E ate percentil 99.9% e depois RETROFORJA-P.
5. Deploy alvo: ${deployTargets.join(", ")}.

## Stories
${bp.stories.map((s) => `### ${s.id} ${s.title}\n${s.acceptanceCriteria.map((a) => `- [ ] ${a}`).join("\n")}`).join("\n\n")}

## Fluxos E2E a validar
${bp.flows.map((f) => `- \`${f}\``).join("\n")}

## Riscos / vacinas
${bp.risks.map((r) => `- ${r}`).join("\n")}

---
_PRD completo em \`docs/PRD.md\`, arquitetura em \`docs/ARCHITECTURE.md\`._
`;
}

export default { dispatch };
