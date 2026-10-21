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

## Passo a passo para pessoa é sempre `!PPL` — Passo a Passo de Leigo, v1.1 (16/09/2026)

Ordem do operador (15/09), recalibrada por ele em 16/09 (*"ficou leigo demais… pode ser para um leigo da
minha versão"*), válida em **qualquer CLI e qualquer repo**: todo passo a passo dirigido a uma pessoa (a
seção `🧭 Passo a passo (!PPL)` que fecha toda resposta com trabalho real, e qualquer `!PPL <texto>`) é
escrito para o **Lucas-leigo** — leigo *neste* domínio (git, infra, código), competente em todo o resto,
usuário diário de GitHub, Vercel e claude.ai pela interface. Finalidade: reduzir carga cognitiva e
dissonância cognitiva, nunca ensinar a clicar. **Se ele faz toda semana pela interface, é um passo, sem
cor nem posição de botão · um passo = um objetivo que ele já executa, pelo verbo · link direto · traduz só
o que é novo ou interno (sha, ref, webhook), nunca PR/merge/branch/deploy · "como se sabe que deu certo"
só quando não é óbvio, normalmente um por procedimento · gate só antes de irreversível não rotineiro ·
porquê de 1 linha quando o passo contraria o modelo mental · ≤5 passos.** Régua: ele lê uma vez, executa
sem reler e não se sente subestimado. Segredos nunca no texto.

**Norma completa** — no hub, não neste repositório:
[`.claude/skills/ppl/SKILL.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/skills/ppl/SKILL.md)
(leitor, ciência, antes × depois) e a seção do passo a passo em
[`.claude/rules/response-protocol.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/response-protocol.md).

## Item de frente só entra com dono, data e quem cobra (18/09/2026)

> Achado do Codex no PR #867, e ele estava certo: a 3ª exigência ("quem cobra") existia só em
> `.claude/rules/item-so-entra-com-dono.md`, que o Codex CLI não lê — a mesma sessão que escreveu a
> regra ficaria livre dela num repo aberto por este CLI. Mesma correção da CLÁUSULA 0 e da
> configuração de rede acima.

Item novo só entra numa frente de trabalho com **três** coisas, nunca duas: **(a)** nome de quem
executa — pessoa real, nunca "a casa", "a sessão" nem um papel disfarçado de nome (ex.: "quem tem
acesso ao painel"); **(b)** data; **(c)** nome de **quem cobra** — alguém que enxerga o calendário
onde a data foi escrita e que recebe o lembrete, distinto de quem executa sempre que o executor não
for o operador. Sem os três, o item não entra na frente: fica registrado no corpo da resposta como
achado, e a ausência **é** a informação. Nasceu da S072 (10 entrevistas do seed bank): tinha data e
calendário, mas o dono da tarefa que travava tudo era um papel ("closer"), não um nome — e a metade
que tinha nome (Aleksandra) não tinha acesso ao calendário onde a data morava. Owner sem cobrador
que a veja é item que tem tudo no papel e não anda.

**Norma completa** — no hub, não neste repositório:
[`.claude/rules/item-so-entra-com-dono.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/item-so-entra-com-dono.md).

## Codex corrige, Claude valida — codificação avançada e projeto longo (24/09/2026)

Ordem do operador, válida em **qualquer repo**: em código avançado (banco, dinheiro, migration, concorrência,
segurança, ou PR já revisado por robô) e em projeto longo (mais de uma sessão ou PRs encadeados), **o Codex corrige o
achado de revisão e o Claude valida, resolve e mergeia**. Fora disso — doc, ajuste trivial de 1 linha e emergência
declarada, **mesmo em PR já revisado por robô** — o Claude corrige direto; a exceção vence a lista. O Codex é chamado por um comentário `@codex` no PR, um por
achado, e responde com estas obrigações: **(1)** reproduzir antes — um teste que falhe sem a correção (nos pacotes com
suíte SQL, um bloco novo registrado no manifesto de blocos e no teste que confere a lista); **(2)** corrigir no menor
escopo; **(3)** rodar as checagens do repositório (lint, tipos, testes, e a suíte de banco quando houver Postgres);
**(4)** commit em português dizendo o achado e a correção, sobre o head atual da branch do PR, e **a entrega é o patch
completo desse commit colado na resposta da própria thread** — `git format-patch -1 --stdout`, dentro de
`<details><summary>patch</summary>`, em bloco ` ```diff `, inteiro (acima de 60 mil caracteres, em respostas numeradas) —
mais o PR publicado pela tarefa quando o ambiente conseguir (ele não tem credencial de escrita para empurrar direto —
decisão A do operador, 26/09/2026). **Resposta sem o patch é não-entrega:** o que fica só dentro da tarefa não chega ao
repositório (ordem do operador, 14/10/2026 — 10 correções certas presas no sandbox em 3 episódios; o Claude aplica o
patch com `git am`, valida por fora e empurra na branch do PR);
**(5)** nunca escrever na `main`, nunca aplicar migration em produção; **(6)** dizer no PR o que rodou e o que não
conseguiu rodar — a validação por fora é do Claude, e ela decide se a thread fecha. Modelo: GPT-6 Astra Pro, esforço
`max`, escolhido pelo operador nas configurações do Codex. Um autor por branch enquanto a tarefa estiver aberta.
Onde uma constituição de framework reservar o `git push` a um agente (no `aiox-core`, o `@devops` — Constitution
Art. II), o push do Codex **não** é um agente AIOX assumindo autoridade alheia: é o executor externo escolhido pelo
operador, na ordem de 24/09, empurrando na branch de PR que ele mesmo mandou corrigir. A `main` continua fora do
alcance de qualquer um deles. Contradição declarada, não escondida — mesma classe da nota sobre story obrigatória
no `CLAUDE.md` do `aiox-core`; se a constituição for revista pelo caminho dela, esta frase cai.

**Norma completa** — no hub, não neste repositório:
[`.claude/rules/codex-corrige-claude-valida.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/codex-corrige-claude-valida.md).

## Carimbo de hora em toda resposta ao operador (25/09/2026)

Ordem do operador: *"todos os meus chats tenham TIME STAMP simples em cada resposta, em todos os repositórios"*.
**Toda resposta, sem exceção de tamanho,** traz `🕒 AAAA-MM-DD HH:MM (São Paulo)` (linha 2 se houver linha de
modelo, senão linha 1), com a hora **medida no mesmo turno** — `TZ=America/Sao_Paulo date '+%Y-%m-%d %H:%M'` — nunca de memória. Sem relógio no ambiente, escreve-se
`🕒 sem relógio nesta sessão`. Vale para resposta ao operador no chat; saída lida por máquina com formato exato (JSON,
retorno de subagente, "responda só OK") fica sem carimbo. Norma completa, no hub:
[`.claude/rules/response-protocol.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/response-protocol.md) §"Carimbo de hora".

## Segredo tem uma fonte só (09/10/2026, decisão 3-A do operador)

Segredo guardado em dois lugares acaba com um deles mentindo. No Radar, o cron assinava com o cofre do banco e a função
conferia contra uma cópia nos segredos das funções. As duas nunca bateram, e o cron registrava "succeeded" por ter
enfileirado o pedido, não porque a função o aceitou. Regra, em qualquer repo: **um segredo tem uma fonte**, e quem confere
pergunta à fonte (no Radar, a RPC `radar_cron_confere`, que devolve só verdadeiro/falso). Cópia que precisar existir é
conferida por **sonda** com o caminho real, nunca pela tela do painel. Enquanto a cópia velha existir, ela ainda vale
como segunda credencial: a fonte só fica única quando a cópia é apagada, depois da sonda verde. E `A || B` não é fallback quando A pode estar presente
e quebrado: teste A, e só então escolha. Norma completa, no hub:
[`.claude/rules/branches-de-agente.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/branches-de-agente.md) §"Segredo quebrado".

## Simulação humana sintética — a checagem é da sessão, não do Lucas (13/10/2026)

Ordem do operador, válida em **qualquer CLI, qualquer repo, qualquer conta**: *"Sempre que for me pedir para checar
algo, vc já checa antes e me tira esse trabalho."* Antes de terminar uma resposta com *confira, teste, abra e veja,
gere um e me avise, pronto quando você…*, a sessão **vira o humano** e faz a checagem no lugar dele — assume a
persona (ele no painel, o visitante da página, o lead do quiz), percorre o **caminho real** (HTTP na prévia ou na
produção, navegador sem tela, rota, banco, script) com a credencial que a persona teria (nunca chave de servidor, que
pula login e regras de acesso) e relata o **medido** numa seção `🧪 Checagem sintética` (persona · caminho · evidência
· veredito · dado de teste recolhido · custo) — da evidência, só o campo que prova o caminho, nunca o corpo inteiro
da resposta nem a linha de cliente da consulta, que entram inteiros no histórico da ferramenta. Com as mesmas travas
do humano: nada irreversível (fora apagar ao fim o dado de teste que a própria checagem criou, achado pelo código
dela), dinheiro só até US$ 0,50 por checagem e US$ 2,00 por dia em cada chat (acima, pergunta antes, com o número),
nada na Meta, nada a pessoa de fora da casa, nada publicado, nada em conta de cliente; navegador, prévia inclusive,
só com o contexto deixando passar, antes da primeira página, o que o caminho testado precisa e mais nada (pixel da
Meta, analytics de terceiros e do próprio domínio, aviso de erro, gravação de sessão: tudo cortado — requisição,
WebSocket, WebRTC, WebTransport e worker; sem como cortar um deles, como no Playwright antes do 1.48, o navegador não
abre), e print só do elemento do teste, nunca da tela inteira; nenhum caminho (navegador ou HTTP, prévia ou produção)
que dispare evento pelo próprio servidor (gatilho ou webhook do banco inclusive), salvo numa prévia provada sem essas
credenciais; credencial nunca escrita no comando, que fica no histórico, nem passada como argumento, que outro
processo lê, nem impressa pelo rastreio do shell (vem de variável já carregada no ambiente e entra pelo stdin ou por
arquivo temporário, com o `set -x` desligado); persona com erro classe A nos últimos 30 dias (lista vigente em
[`docs/ops/SHS-QUARENTENA.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/docs/ops/SHS-QUARENTENA.md),
lida na `main` do hub no GitHub, mais os PRs do hub com `SHS-QUARENTENA` no título atualizados nos últimos 30 dias,
de qualquer estado) pede o "sim" do Lucas antes, e sem como ler essa lista também; dado de teste marcado `shs` com o
código da checagem, dito no chat antes da primeira escrita (a checagem interrompida deixa no histórico o código para
apagar), e apagado ao fim só por esse código, depois que termina, com sinal dela que se veja dentro do limite que a
plataforma impõe e que a encerra (fila vazia não basta), o que o fluxo grava mais tarde (`after()`, fila, webhook), e
com as linhas desse código reconferidas — em produção, a checagem só lê, e só pelo caminho da persona, sem SQL da
sessão no banco (nem pelo MCP do Supabase); gravar em banco, desfazer transação e consultar o banco direto não entram
em checagem nenhuma, em banco nenhum, e viram fronteira (decisões 1-A, 16/10, e 2-A, 17/10/2026, do operador); o
navegador só abre página da casa, e página de terceiro é fronteira (decisão 4-C). Erro classe A da própria checagem
(a lista está na norma) entra nessa lista no mesmo ato, num PR do hub com `SHS-QUARENTENA` no título. Só sobra pedido
quando a fronteira é só dele — credencial ou sessão só dele, gasto acima do teto, juízo humano; Meta, ação
irreversível e mensagem a pessoa de fora não entram na checagem nem com o "sim" — ou quando o ambiente não alcança, e
aí a sessão vai até a borda e pede **um passo só, com o porquê** (`fronteira: fiz até X; falta só Y, porque Z`). Não
confundir com `!mirofish` (população sintética prevê **público**); SHS simula **o operador conferindo**.

**Norma completa e skill** — no hub, não neste repositório:
[`.claude/rules/simulacao-humana-sintetica.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/simulacao-humana-sintetica.md) e
[`.claude/skills/simulacao-humana-sintetica/SKILL.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/skills/simulacao-humana-sintetica/SKILL.md)
(a skill é espelhada em cada irmão pelo `sync-rules`; o hook de parada que barra a resposta sem `🧪` só existe no hub).

## Handoff de cota — a sessão escreve o próprio quando a conta chega a 90% (14/10/2026)

Ordem do operador, válida em **qualquer CLI, qualquer repo, qualquer conta**: *"handoff para a nuvem, em todos os
repositórios, de tudo o que está acontecendo nessa conta quando chegarmos em 90-95% de uso, da cota semanal, da cota do
fable ou da cota da sessão (…) autocontido, independente, interdependente e sinérgico (…) permanente, e replicável em todas
as minhas contas."* Ao fim de todo turno com trabalho real, a sessão lê a própria cota (`list_events` deste chat,
`kinds: ["rate_limit_event"]`, evento mais novo — janelas `five_hour` = a "sessão" do app, `seven_day` = semana, e por
modelo = Fable). Qualquer uma em **0,90 ou mais** → antes de qualquer outra coisa, escreve o **próprio handoff**: um arquivo
autocontido (pedido · feito · onde parou · o que falta e de quem · decisões já tomadas · PRs e branches · prompt de
retomada) em `docs/ops/HANDOFF-COTA/<conta>--<renovação da semana>/chats/` no hub — pela API do GitHub se o hub não
estiver clonado; sem o hub no escopo, em `memoria/` deste repo com prefixo `handoff-cota-` —, sem segredo, token ou dado
de cliente, e diz no título do chat o que falta na outra conta. Reescreve só se houve trabalho real desde o último; no
máximo um por turno. Comando explícito: `!handoff`. O vigia da conta (mão 2, chat `⚙ COTA`, a cada 2 h) lê os chats por
fora, monta o `README.md`, o `REPOS.md` (PRs abertos e branches com trabalho em **todos os repositórios**) e o
`ROTINAS-E-CONTA.md`, gerando antes o handoff leve por script (`scripts/cota-handoff-leve.py`, segundos), e reaproveita o
que a mão 1 gravou. Agente sem o servidor Claude Code Remote (CLI local) não lê a
cota: para ele a skill vale só sob demanda.

**Norma completa e skill** — no hub, não neste repositório:
[`.claude/rules/cota-90-handoff.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/cota-90-handoff.md),
[`docs/ops/COTA-90-HANDOFF.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/docs/ops/COTA-90-HANDOFF.md) e
[`.claude/skills/handoff-cota/SKILL.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/skills/handoff-cota/SKILL.md)
(a skill é espelhada em cada irmão pelo `sync-rules`).

## Aviso automático de PR ou de ferramenta: silêncio, salvo estado novo (18/10/2026)

Ordem do operador, válida em **qualquer CLI, qualquer repo, qualquer conta**. Notificação que chega sozinha (Vercel, CodeRabbit,
Codex, Actions, lembrete do harness) não vira resposta ao operador, a menos que **aquele evento** traga um estado novo ainda não
relatado: ação da sessão (CI vermelho, conflito, achado a corrigir), resultado final (CI que acabou de ficar verde, merge feito,
PR fechado) ou decisão nova que dependa dele. Sem isso, a resposta é só a linha de hora `🕒 AAAA-MM-DD HH:MM (São Paulo)`, sem
recapitular o PR nem repetir decisões abertas. Pergunta direta do operador sempre tem resposta completa. Norma no hub:
[`.claude/rules/response-protocol.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/response-protocol.md).

## Preço sem avareza — todo preço da casa passa pela pergunta de São Bento (20/10/2026)

Decisões D2-A (15/10) e D5-A (20/10/2026) do operador, válidas em **qualquer CLI, qualquer repo, qualquer conta**. Quem cria ou
muda **preço, oferta, tabela, cupom, checkout, proposta comercial ou escada de produto** escreve, no próprio artefato (doc da
oferta, config do checkout ou corpo do PR), uma linha `🪙 RB 57: (1) valor/mercado: … · (2) comprador sabendo tudo: … · (3) de
quem eu amo: … → avareza: não | sim, e o que muda`, respondendo a três perguntas: (1) o preço sai do valor entregue e do mercado
limpo (sem fraude, monopólio nem coação), não do medo de faltar; (2) o comprador, sabendo tudo o que eu sei, acharia justo;
(3) eu cobraria o mesmo de quem eu amo. A regra **obriga a pergunta e a resposta escrita**; não decide número, não é teto nem
fórmula — a decisão continua do operador. Fonte: *Regula Benedicti*, cap. 57 (texto latino conferido em 15/10). O santo é
patrono, nunca argumento de venda: a pergunta fica no artefato interno; página, oferta e VSL públicas não o citam. Convive com
`versionamento-fosso-publico` (quanto cada classe cobra e a distância pública); esta diz por quê este número.

**Norma completa e história** — no hub, não neste repositório:
[`.claude/rules/preco-sem-avareza.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/preco-sem-avareza.md) e
[`docs/regras/historico/preco-sem-avareza.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/docs/regras/historico/preco-sem-avareza.md)
(no hub, o hook de parada `colegiado-santo-gate.sh` barra resposta que propõe preço em R$ sem a pergunta escrita; nos irmãos vale este bloco).

<!-- HUB-INVARIANTES-END -->

🕒 2026-10-17 17:48 (São Paulo) · ✍ lucasscudeler · 💬 !! 18/10 · A75 · CANON SHS → aplicar 2-A/4-AC e plano de gasto do Actions · #chat-4BNJMe
