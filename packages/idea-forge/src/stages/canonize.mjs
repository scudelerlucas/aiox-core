// @ts-check
/**
 * Estagio CANONIZE: emite o SPEC canonico do fluxo — o template replicavel para
 * outros operadores e projetos. Ultimo estagio: fecha o MVP transformando a
 * execucao concreta em um padrao reaplicavel.
 */
import { STAGES, SCORE_GATE, PERCENTILE_TARGET, SYNTHETIC_DB_CONFIDENCE } from "../types.mjs";

/** @param {import("../types.mjs").PipelineState} state @param {{store?:any}} ctx */
export async function canonize(state, ctx) {
  const spec = generateCanon(state);
  let canonPath = "(memoria)";
  if (ctx?.store) {
    canonPath = ctx.store.writeArtifact(state.runId, "CANONICAL-FLOW.md", spec);
  }
  state.log.push(`[canonize] fluxo canonizado (${STAGES.length} estagios) — replicavel`);
  return { canon: { canonPath } };
}

/** @param {import("../types.mjs").PipelineState} state */
export function generateCanon(state) {
  const bp = state.blueprint;
  return `# Fluxo Canonico — Sistema Agentico de Ideias (IdeaForge)

> Template replicavel. Primeiro instanciado por: **${bp?.name || "MVP"}** (run \`${state.runId}\`).
> Reaplique a QUALQUER nova ideia de QUALQUER operador rodando \`idea-forge run\`.

## Principio
CLI First -> Observability Second -> UI Third. Todo estagio funciona 100% offline
por **fallback deterministico** (No LLM = no blocker). O LLM apenas enriquece.

## Os ${STAGES.length} estagios (pipeline resumivel — estado no store)

| # | Estagio | Entrada | Saida | Gate |
|---|---------|---------|-------|------|
| 1 | **ingest** | audio/texto de Telegram, WhatsApp, Claude app, Claude Code, Cowork ou arquivo | \`RawIdea\` (transcrito) | transcricao com passthrough/STT+fallback |
| 2 | **atomize** | RawIdea | \`AtomizedIdea\` (atomos + S/N) | max sinal / min ruido |
| 3 | **brainstorm** | AtomizedIdea | \`BrainstormedIdea\` (expande+converge) | S/N nao regride |
| 4 | **steroid** | BrainstormedIdea | \`SteroidedIdea\` | TGM (7 alavancas) + OP3LIF (LIF) + AF |
| 5 | **architect** | SteroidedIdea | \`ProjectBlueprint\` (PRD, arch, stories, gates) | AIOX PRO + Artigo IV (No Invention) |
| 6 | **score** | ProjectBlueprint | \`ScoredBlueprint\` | **>= ${SCORE_GATE}** com alta confianca (self-heal) |
| 7 | **dispatch** | ScoredBlueprint | \`DispatchManifest\` + KICKOFF.md | bloqueia se score < ${SCORE_GATE} |
| 8 | **simulate** | Blueprint | \`SimulationReport\` | loop E2E ate **percentil ${PERCENTILE_TARGET}%** |
| 9 | **retroforja** | dados reais ou sinteticos | \`RetroforjaReport\` | validacao de tras pra frente; DB sintetico @${SYNTHETIC_DB_CONFIDENCE}% |
| 10 | **report** | todo o estado | RELATORIO.html + COMO-USAR.md | grafico + linguagem simples |
| 11 | **canonize** | todo o estado | este SPEC | fluxo replicavel |

## Contratos-chave
- Cada estagio: \`async (state, ctx) => patch\`. O orquestrador salva apos cada um -> **retomavel**.
- Ordem e "proximo" em \`src/types.mjs\` (STAGES/NEXT).
- Fallback deterministico por estagio em \`*Deterministic()\`; LLM via \`askJson({system,user,fallback})\`.

## Loops convergentes (nunca infinitos)
- **score**: self-heal ate ${SCORE_GATE}+ ou max iteracoes; preenche gaps rastreaveis.
- **simulate**: corrige a quebra de maior peso por iteracao ate percentil-alvo ou max iteracoes.
- **retroforja**: predicao->resultado->delta->diagnostico (arquitetural x operacional)->ajuste.

## Como replicar para outro operador/projeto
1. \`idea-forge run --source telegram --text "<ideia>"\` (ou \`--file ideia.txt\`, ou \`--demo\`).
2. Opcional: \`ANTHROPIC_API_KEY\` liga o enriquecimento por LLM; sem ela, roda 100% offline.
3. Opcional: passe dados reais em \`meta.realData\` para a RETROFORJA-P usar producao real.
4. Os artefatos saem em \`runs/<runId>/\`: PRD, ARCHITECTURE, KICKOFF, RELATORIO.html, COMO-USAR, este SPEC.
5. Retome um run interrompido com \`idea-forge resume <runId>\`.

## Extensao
- Novo canal: adicione um adaptador em \`src/ingest/adapters.mjs\` (contrato \`(payload)=>{text,audioRef,meta}\`).
- Novo framework de esteroide: adicione em \`src/frameworks/\` e componha em \`stages/steroid.mjs\`.
- Novo gate de qualidade: adicione a dimensao em \`stages/score.mjs\`.

_Fim do fluxo canonico. Este documento e o output que fecha o MVP e habilita a replicacao._
`;
}

export default { canonize, generateCanon };
