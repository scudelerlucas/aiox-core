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

<!-- HUB-INVARIANTES-START · FONTE ÚNICA. Editar AQUI, no hub; `node scripts/sync-rules.mjs`
     espelha este bloco no AGENTS.md de cada irmão. Nada fora dos marcadores é tocado.
     Só entra aqui invariante que vale em QUALQUER repo — a CLÁUSULA 0 fica fora de propósito:
     ela é escopada por caminho (decisão 4-B) e esses caminhos existem só no hub. -->
## Configuração de rede, segurança e permissão não vira prompt de agente (14/09/2026)

> Achado do Codex no PR #798 (P1), e ele estava certo — **a segunda vez que o mesmo achado
> aparece**: a regra nasceu só em `.claude/` (regra + skill), que o Codex CLI não lê. Invariante de
> segurança que só metade das ferramentas recebe é meia invariante. Mesma correção da CLÁUSULA 0.

Vale para **qualquer CLI, qualquer repo, qualquer caminho** — e desde 15/09 isso é mecânico, não
alegado: o `sync-rules` do hub espelha este bloco no `AGENTS.md` de cada irmão (decisão 1-B do
operador, depois do achado P1 do Codex no PR #799, que mediu que a versão anterior valia só onde já
havia `AGENTS.md`). Repo irmão sem o arquivo **ganha** um, com só este bloco.

> **Este bloco viaja, então toda referência aqui é ABSOLUTA e mora no hub**
> `scudelerlucas/Lucas-Contexto-Geral` — **não** em cópia local. Achado P2 do Codex nos 4 PRs
> irmãos, e ele estava certo: a v1 apontava para `.claude/rules/execucao-remota.md` e para
> `bash scripts/rules-drift.sh`, que **não existem** num irmão — uma sessão Codex em `pandora-ops`
> seguindo o ponteiro não achava nada, e o comando de conferência saía com 127. Ponteiro verdadeiro
> onde foi escrito e falso onde aterrissa é a mesma falha que este bloco existe para corrigir.

**Mudar lista de domínios, nível de acesso à rede, permissão ou política de segurança de um
ambiente de execução — o que amplia o alcance de um agente — não se exporta como missão de agente.
Vira checklist para o dono da conta, que clica.** Um agente que recusar essa classe está
**cumprindo** esta regra: não insistir, não reformular para passar, não trocar de ferramenta. Um
classificador de segurança que bloqueie a edição é a fronteira, não um obstáculo a contornar.

Nasceu de um caso real: um prompt meu mandava o Claude on Chrome mudar o acesso à rede de
*Trusted* para *Custom* e acrescentar 5 domínios. **Ele recusou, com razão** — *"alteração de
configuração de segurança/rede de um ambiente de execução — uma categoria que trato como proibida
para mim mesmo"*. E o documento era pior do que ele viu: registrava que o classificador havia
bloqueado a edição, chamava isso de *"o comportamento certo"*, e na frase seguinte ensinava a
repetir à mão e a replicar nas outras contas.

**O que continua sendo prompt remoto normal** (a fronteira é *"amplia o alcance do agente?"*, não
a palavra "credencial"): painel que exige login, OAuth, máquina local, e **ler** algo que este
ambiente não alcança — inclusive criar app de marketplace com escopo de leitura e gravar o token
em variável do produto, que é config de deploy, não alcance de agente.

**Antes de pedir superfície:** revisar domínio a domínio (cada um com o problema medido que o
justifica, ou fora da lista) e **refazer o `curl` na hora** — *"está bloqueado" é medição de agora,
nunca fato guardado*. E medição de uma sessão vale por **um ambiente**: a lista é por ambiente e
por conta, então declarar rede liberada exige medir cada um, de dentro, em sessão nova.

**Norma completa** (tabela de casos, fronteira "amplia o alcance do agente?", 3 camadas de rede
com as saídas 3a/3b) — **no hub, não neste repositório:**
[`.claude/rules/execucao-remota.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/execucao-remota.md) §"A exceção" e a skill
[`.claude/skills/execucao-remota/SKILL.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/skills/execucao-remota/SKILL.md).

**Conferir o espelho** — também **comandos do hub**, rodados de dentro dele com os irmãos clonados
ao lado; num irmão eles não existem:
[`node scripts/sync-rules.mjs --check`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/scripts/sync-rules.mjs) (relata sem escrever, sai 1 com
divergência) · [`bash scripts/rules-drift.sh`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/scripts/rules-drift.sh) · a Action
[`rules-drift`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.github/workflows/rules-drift.yml), que abre issue quando diverge e fecha
sozinha quando iguala.

<!-- HUB-INVARIANTES-END -->
