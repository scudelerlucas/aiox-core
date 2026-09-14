# AGENTS.md - Synkra AIOX

Este arquivo configura o comportamento esperado de agentes no Codex CLI neste repositorio.

## Constitution

Siga `.aiox-core/constitution.md` como fonte de verdade:
- CLI First
- Agent Authority
- Story-Driven Development
- No Invention
- Quality First
- Absolute Imports

## Workflow Obrigatorio

1. Entenda o escopo pedido e implemente apenas ele
2. Quando houver uma story associada, siga os acceptance criteria dela e mantenha checklist (`[ ]` -> `[x]`) e file list atualizados
3. Execute quality gates antes de concluir

> **Sobre story obrigatoria (decisao do operador, 14/09/2026).** O passo 1 exigia
> "inicie por uma story em `docs/stories/`". A exigencia foi retirada porque o
> repositorio nao a pratica: `docs/stories/` nao existe, nenhuma story existe no
> caminho exigido, e os PRs #15 a #21 foram todos mergeados sem. O gate
> `Story Checkbox Validation` do CI tambem passa verde sem story, entao a regra
> nao era conferida por mecanismo nenhum — era honra, e ninguem a cumpria.
>
> Uma regra que nenhum PR cumpre e nenhum gate confere nao protege nada: ela so
> gera achado de revisao em todo PR e ensina a ignorar o documento. Story
> continua sendo bem-vinda quando existir, e o passo 2 diz o que fazer nesse
> caso.
>
> **A Constitution (`.aiox-core/constitution.md`, Artigo III) continua exigindo
> story como MUST.** Ela e L1 (framework core, nao modificavel por PR), entao a
> contradicao entre os dois documentos e real e consciente. Para resolver de
> vez, ou o Artigo III muda pelo caminho proprio dele, ou `docs/stories/` passa
> a existir com template e gate que confira.

## Quality Gates

```bash
npm run lint
npm run typecheck
npm test
```

## Estrutura Principal

- Core framework: `.aiox-core/`
- CLI: `bin/`
- Pacotes: `packages/`
- Testes: `tests/`
- Documentacao: `docs/`

## IDE/Agent Sync

- Sincronizar regras/agentes: `npm run sync:ide`
- Validar drift: `npm run sync:ide:check`
- Rodar paridade multi-IDE (Claude/Codex/Gemini): `npm run validate:parity`
- Sync Claude Code: `npm run sync:ide:claude`
- Sincronizar Gemini CLI: `npm run sync:ide:gemini`
- Validar Codex sync/integration: `npm run validate:codex-sync && npm run validate:codex-integration`
- Gerar skills locais do Codex: `npm run sync:skills:codex`
- Este repositorio usa **local-first**: prefira `.codex/skills` versionado no projeto
- Use `sync:skills:codex:global` apenas para testes fora deste repo

## Agent Shortcuts (Codex)

Preferencia de ativacao no Codex CLI:
1. Use `/skills` e selecione `aiox-<agent-id>` vindo de `.codex/skills` (ex.: `aiox-architect`)
2. Se preferir, use os atalhos abaixo (`@architect`, `/architect`, etc.)

Quando a mensagem do usuario for um atalho de agente, carregue o arquivo correspondente em `.aiox-core/development/agents/` (fallback: `.codex/agents/`), renderize o greeting via `generate-greeting.js` e assuma a persona ate receber `*exit`.

Atalhos aceitos por agente:
- `@aiox-master`, `/aiox-master`, `/aiox-master.md` -> `.aiox-core/development/agents/aiox-master.md`
- `@analyst`, `/analyst`, `/analyst.md` -> `.aiox-core/development/agents/analyst.md`
- `@architect`, `/architect`, `/architect.md` -> `.aiox-core/development/agents/architect.md`
- `@data-engineer`, `/data-engineer`, `/data-engineer.md` -> `.aiox-core/development/agents/data-engineer.md`
- `@dev`, `/dev`, `/dev.md` -> `.aiox-core/development/agents/dev.md`
- `@devops`, `/devops`, `/devops.md` -> `.aiox-core/development/agents/devops.md`
- `@pm`, `/pm`, `/pm.md` -> `.aiox-core/development/agents/pm.md`
- `@po`, `/po`, `/po.md` -> `.aiox-core/development/agents/po.md`
- `@qa`, `/qa`, `/qa.md` -> `.aiox-core/development/agents/qa.md`
- `@sm`, `/sm`, `/sm.md` -> `.aiox-core/development/agents/sm.md`
- `@squad-creator`, `/squad-creator`, `/squad-creator.md` -> `.aiox-core/development/agents/squad-creator.md`
- `@ux-design-expert`, `/ux-design-expert`, `/ux-design-expert.md` -> `.aiox-core/development/agents/ux-design-expert.md`

Resposta esperada ao ativar atalho:
1. Confirmar agente ativado
2. Mostrar 3-6 comandos principais (`*help`, etc.)
3. Seguir na persona do agente
