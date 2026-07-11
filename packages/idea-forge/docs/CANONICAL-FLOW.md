# Fluxo Canonico — Sistema Agentico de Ideias (IdeaForge)

> Template replicavel. Primeiro instanciado por: **SistemaConstrX** (run `if-20260711120000`).
> Reaplique a QUALQUER nova ideia de QUALQUER operador rodando `idea-forge run`.

## Principio
CLI First -> Observability Second -> UI Third. Todo estagio funciona 100% offline
por **fallback deterministico** (No LLM = no blocker). O LLM apenas enriquece.

## Os 11 estagios (pipeline resumivel — estado no store)

| # | Estagio | Entrada | Saida | Gate |
|---|---------|---------|-------|------|
| 1 | **ingest** | audio/texto de Telegram, WhatsApp, Claude app, Claude Code, Cowork ou arquivo | `RawIdea` (transcrito) | transcricao com passthrough/STT+fallback |
| 2 | **atomize** | RawIdea | `AtomizedIdea` (atomos + S/N) | max sinal / min ruido |
| 3 | **brainstorm** | AtomizedIdea | `BrainstormedIdea` (expande+converge) | S/N nao regride |
| 4 | **steroid** | BrainstormedIdea | `SteroidedIdea` | TGM (7 alavancas) + OP3LIF (LIF) + AF |
| 5 | **architect** | SteroidedIdea | `ProjectBlueprint` (PRD, arch, stories, gates) | AIOX PRO + Artigo IV (No Invention) |
| 6 | **score** | ProjectBlueprint | `ScoredBlueprint` | **>= 95** com alta confianca (self-heal) |
| 7 | **dispatch** | ScoredBlueprint | `DispatchManifest` + KICKOFF.md | bloqueia se score < 95 |
| 8 | **simulate** | Blueprint | `SimulationReport` | loop E2E ate **percentil 99.9%** |
| 9 | **retroforja** | dados reais ou sinteticos | `RetroforjaReport` | validacao de tras pra frente; DB sintetico @95% |
| 10 | **report** | todo o estado | RELATORIO.html + COMO-USAR.md | grafico + linguagem simples |
| 11 | **canonize** | todo o estado | este SPEC | fluxo replicavel |

## Contratos-chave
- Cada estagio: `async (state, ctx) => patch`. O orquestrador salva apos cada um -> **retomavel**.
- Ordem e "proximo" em `src/types.mjs` (STAGES/NEXT).
- Fallback deterministico por estagio em `*Deterministic()`; LLM via `askJson({system,user,fallback})`.

## Loops convergentes (nunca infinitos)
- **score**: self-heal ate 95+ ou max iteracoes; preenche gaps rastreaveis.
- **simulate**: corrige a quebra de maior peso por iteracao ate percentil-alvo ou max iteracoes.
- **retroforja**: predicao->resultado->delta->diagnostico (arquitetural x operacional)->ajuste.

## Como replicar para outro operador/projeto
1. `idea-forge run --source telegram --text "<ideia>"` (ou `--file ideia.txt`, ou `--demo`).
2. Opcional: `ANTHROPIC_API_KEY` liga o enriquecimento por LLM; sem ela, roda 100% offline.
3. Opcional: passe dados reais em `meta.realData` para a RETROFORJA-P usar producao real.
4. Os artefatos saem em `runs/<runId>/`: PRD, ARCHITECTURE, KICKOFF, RELATORIO.html, COMO-USAR, este SPEC.
5. Retome um run interrompido com `idea-forge resume <runId>`.

## Extensao
- Novo canal: adicione um adaptador em `src/ingest/adapters.mjs` (contrato `(payload)=>{text,audioRef,meta}`).
- Novo framework de esteroide: adicione em `src/frameworks/` e componha em `stages/steroid.mjs`.
- Novo gate de qualidade: adicione a dimensao em `stages/score.mjs`.

_Fim do fluxo canonico. Este documento e o output que fecha o MVP e habilita a replicacao._
