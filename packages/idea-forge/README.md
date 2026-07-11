# 🔨 IdeaForge — Sistema Agêntico de Ideias

> Da **ideia falada** ao **projeto validado e pronto para deploy** — em um pipeline único, resumível e 100% observável.
> `@aiox/idea-forge` · CLI First · zero-dependência · offline por fallback determinístico.

Você grava um áudio (ou digita) uma ideia. O IdeaForge **atomiza → esteroida (TGM + OP3LIF + Antifragilidade) → arquiteta em AIOX PRO → pontua (gate 95+) → despacha para o Claude Code → simula E2E até percentil 99.9% → valida de trás para frente com RETROFORJA-P → entrega relatório gráfico + guia simples → canoniza o fluxo** para replicar em outros operadores e projetos.

## Instalação / uso

Zero dependências. Requer Node ≥ 20.

```bash
# do diretório do package
node bin/idea-forge.mjs run --demo            # roda o pipeline completo na ideia-demo
node bin/idea-forge.mjs run --text "minha ideia..."
node bin/idea-forge.mjs run --file ideia.txt
node bin/idea-forge.mjs run --source telegram --text "..."   # define o canal
node bin/idea-forge.mjs resume <runId>        # retoma um run interrompido
node bin/idea-forge.mjs show <runId>          # resumo + log
node bin/idea-forge.mjs stages                # lista os 11 estágios

npm test                                       # 19 testes (node:test), 0 deps
```

### LLM opcional
Sem `ANTHROPIC_API_KEY`, roda 100% offline com fallback determinístico (constitucional: **No LLM = no blocker**). Com a chave, cada estágio é **enriquecido** pelo LLM (default Sonnet), mantendo o mesmo contrato de saída.

| Env | Efeito |
|-----|--------|
| `ANTHROPIC_API_KEY` | liga o enriquecimento por LLM |
| `IDEAFORGE_OFFLINE=1` | força offline (só fallback determinístico) |
| `IDEAFORGE_MODEL` | override do modelo (default `claude-sonnet-5`) |
| `IDEAFORGE_DIR` | diretório base dos runs (default `.idea-forge`) |
| `IDEAFORGE_STT_URL` | provedor de transcrição (áudio → texto) |

## Os 11 estágios (fluxo canônico)

| # | Estágio | O que faz |
|---|---------|-----------|
| 1 | **ingest** | Áudio/texto de Telegram, WhatsApp, Claude app, Claude Code, Cowork ou arquivo → `RawIdea` (transcrito) |
| 2 | **atomize** | Decompõe em átomos, máximo sinal / mínimo ruído |
| 3 | **brainstorm** | Expande por 5 lentes e converge |
| 4 | **steroid** | TGM (7 alavancas) + OP3LIF (auditoria de modos de fracasso) + Antifragilidade |
| 5 | **architect** | PRD, arquitetura, stories, quality gates (AIOX PRO, Artigo IV — No Invention) |
| 6 | **score** | Pontua 5 dimensões; gate **95+** com self-heal |
| 7 | **dispatch** | Manifesto + `KICKOFF.md` pronto para o Claude Code |
| 8 | **simulate** | Loop E2E adaptativo até **percentil 99.9%**, corrigindo quebras de fluxo |
| 9 | **retroforja** | RETROFORJA-P: valida de trás para frente com dados reais **ou** banco sintético @95% |
| 10 | **report** | `RELATORIO.html` (gráfico, SVG inline) + `COMO-USAR.md` (linguagem simples) |
| 11 | **canonize** | `CANONICAL-FLOW.md` — o template replicável |

## Arquitetura

- **Pipeline resumível** (padrão *offerforge*): o estado vive no store (JSON), não na memória. `STAGES`/`NEXT` em `src/types.mjs`.
- **Fallback determinístico por estágio** (`*Deterministic()`), com o LLM plugável via `askJson({system,user,fallback})`.
- **Loops convergentes** (nunca infinitos): `score` (self-heal), `simulate` (corrige a quebra de maior peso por iteração), `retroforja` (predição→resultado→delta→diagnóstico→ajuste).
- **Determinismo**: PRNG semeado (mulberry32) → simulações e testes reproduzíveis.

```
src/
  types.mjs            contratos + STAGES/NEXT + limiares (SCORE_GATE, PERCENTILE_TARGET)
  orchestrator.mjs     pipeline resumível (createRun/step/runAll)
  store.mjs            persistência JSON + banco sintético + PRNG
  llm.mjs              cliente LLM + fallback determinístico (offline)
  ingest/              adapters (6 canais) + transcrição
  frameworks/          tgm.mjs · op3lif.mjs · antifragility.mjs
  stages/              atomize · brainstorm · steroid · architect · score · dispatch · simulate · retroforja · report · canonize
test/                  units.test.mjs + e2e.test.mjs (19 testes)
```

## Extensão
- **Novo canal**: adaptador em `src/ingest/adapters.mjs` (`(payload) => {text, audioRef, meta}`).
- **Novo framework de esteroide**: `src/frameworks/` + compor em `stages/steroid.mjs`.
- **Novo gate**: dimensão em `stages/score.mjs`.

## Referências canônicas
- TGM v4.1 OS, OP3LIF, RETROFORJA, Antifragilidade (Taleb) — `Lucas-Contexto-Geral/docs/frameworks/` e `pandora-quiz-AIOX/skills/user/`.
- Constituição AIOX (`.aiox-core/constitution.md`): CLI First, No Invention, Quality First.

---
_MVP do Sistema Agêntico de Ideias. O fluxo canônico (`docs/CANONICAL-FLOW.md`) fecha o MVP e habilita replicação para outros operadores._
