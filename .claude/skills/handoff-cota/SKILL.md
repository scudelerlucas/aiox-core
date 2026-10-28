---
name: handoff-cota
description: "!handoff — a sessão escreve o próprio handoff de cota: um arquivo autocontido (pedido · feito · onde parou · o que falta e de quem · decisões já tomadas · PRs e branches · prompt de retomada) no diretório da renovação semanal do hub, para o Lucas continuar sem fricção em outra conta Claude Max. Dispara sozinha quando a cota da conta (janela de 5 h = 'sessão', semana ou por modelo/Fable) está em 0,90 ou mais — lida por `list_events` deste chat, `rate_limit_event`; e sob demanda com `!handoff`. Vale em todo repositório e toda conta (mão 1 da regra `cota-90-handoff`). Ativar em: !handoff, 'handoff de cota', 'cota a 90', 'migrar de conta', 'passar para outra conta', 'limite de uso', 'rate limit', 'sessão quase no limite'."
---

# !handoff — o handoff que a própria sessão escreve (mão 1 da regra `cota-90-handoff`, 14/10/2026)

> Ordem do operador, 14/10/2026 02:16: *"handoff para a nuvem, em todos os repositórios, de tudo o que está acontecendo
> nessa conta quando chegarmos em 90-95% de uso, da cota semanal, da cota do fable ou da cota da sessão (…) autocontido,
> independente, interdependente e sinérgico (…) permanente, e replicável em todas as minhas contas."*
>
> **Ordem permanente** (16/10, gravada pelo operador como memória permanente em 23/10, vale em todo repositório e toda conta):
> *"Preciso fazer um gatilho autônomo de checkpoint e handoff da conta do Claude max inteira para a nuvem, de todos os repositórios, de tudo o que está acontecendo nessa conta quando chegarmos em 90-95% de uso, da cota semanal, da cota do fable ou da cota da sessão. Esse handoff deve ser autocontido, independente, interdependente e sinérgico, e !OP3AFLIF para que eu consiga continuar sem fricção em outra conta do claude max que tenha cota disponível. Use full force do !arsenal, !4z e torne esse gatilho algo permanente, e replicável em todas as minhas contas a partir dessa implantação."*
> O vigia da conta (mão 2, `docs/ops/COTA-90-HANDOFF.md`) passa de 2 em 2 h e lê os chats por fora. Esta skill é a mão 1:
> **quem gastou a cota é quem melhor sabe onde parou** — e lê o número em uma chamada.

## 1. Quando dispara
- **Automático:** ao fim de **todo turno com trabalho real** (o mesmo momento em que a sessão grava memória, empurra
  commit, abre ou atualiza PR), a sessão lê a própria cota (§2). Qualquer janela em **0,90 ou mais** → roda esta skill
  **antes de qualquer outra coisa** no turno seguinte (ou ainda neste, se der). Reescreve só se houve trabalho real desde
  o último handoff; no máximo um por turno.
- **Explícito:** `!handoff` (ou `!handoff <chat|tema>`), em qualquer cota.
- **Nunca:** em resposta trivial sem trabalho; mais de uma vez por turno; para chat arquivado.

## 2. Como ler a cota (uma chamada, nunca de memória)
```
list_events(session_id = <id deste chat, de get_session sem session_id>,
            kinds = ["rate_limit_event"], limit = 20)
```
A página sem cursor é a mais nova; pegar o evento de `created_at` mais novo e ler `rate_limit_info.unifiedWindows`:
`five_hour` (a **sessão** do app), `seven_day` (a **semana**), e qualquer chave por modelo (`seven_day_<modelo>`,
`model_scoped`) — o **Fable**, quando existir. `U = maior utilização` entre as três. `resetsAt` é época em segundos UTC
(`TZ=America/Sao_Paulo date -d @<n>`). `seven_day_overage_included` não é gatilho (vista pela 1ª vez em 14/10; medir
antes de usar). Sem evento nenhum → "sem leitura" (não é zero); fora da nuvem (CLI local sem o servidor Claude Code
Remote) → a skill vale só sob demanda, e a mão 2 cobre.

## 3. O que escrever — um arquivo, autocontido
Caminho: `docs/ops/HANDOFF-COTA/<conta>--<AAAA-MM-DD da renovação da semana>/chats/<AAAA-MM-DD>--<8 últimos do id>.md` (sem o título no nome: o caminho fica no git para sempre)
(`<conta>` = nome antes do `@`; a data é a do `resetsAt` da janela `seven_day`, em São Paulo; a data do arquivo é a de
hoje; o slug são 2–4 palavras do tema). Arquivo já existe para este chat → substituir. Formato (o mesmo dos 125 de 12/10 e
dos 71 de 09/10, que a outra conta já retomou):

```
# <título do chat no formato titulo-de-chat>
- **Sessão:** session_<id> · https://claude.ai/code/session_<id> (só abre na conta dona) · **conta:** <conta>
- **Estado até:** <AAAA-MM-DD HH:MM São Paulo> · cota na hora: 5 h NN% · semana NN% · modelo NN%/sem evento
- **Repos:** <os que o chat tocou> · **Branches:** <branch> · **PRs:** <owner/repo#n (estado)>
## Pedido de origem
## O que foi feito
## Onde parou
## O que falta — e de quem   (`[Lucas]`, `[Claude]`, `[nome]`; item sem dono é achado, não tarefa)
## Decisões do Lucas já tomadas (não reabrir)
## Prompt de retomada (colar num chat novo da outra conta, com o hub aberto)
> <autocontido: contexto em 3 linhas, o que ler primeiro (caminho na main ou na branch), o que fazer agora,
> o que NÃO fazer, como se sabe que deu certo>
🕒 <hora> (São Paulo) · ✍ <conta> · 💬 <título do chat> · #chat-<6 últimos do id>
```
Régua: o Lucas-leigo lê uma vez e retoma sem reler o chat. Links de PR com repositório (`owner/repo#n`). O estado dos PRs
é o deste turno — "conferir no GitHub antes de agir".

## 4. Onde escrever — três caminhos, nesta ordem
1. **Hub clonado** (`Lucas-Contexto-Geral` na sessão): `git fetch origin`; branch da renovação = a mais nova
   `claude/handoff-cota-<conta>-*` que já tenha o diretório desta renovação; não existindo, criar
   `claude/handoff-cota-<conta>-<renovação>` a partir da `main`. Escrever, `git add` só este arquivo, commit, `git pull
   --rebase` e `push`. Nunca `--force`. Sem PR aberto para a branch → abrir **em rascunho** no hub, com o bloco
   `carimbo-pr`; PR já aberto por outro chat → acrescentar o próprio bloco `carimbo-pr` ao corpo (a Action exige um por
   chat que empurrou).
2. **Hub não clonado, mas no escopo** (todo chat das contas da casa): `create_or_update_file` (GitHub MCP) no hub, na
   mesma branch (se não existir: `create_branch` a partir da `main`), com a mensagem `handoff-cota: <conta> <id8>`.
3. **Hub fora do escopo:** `memoria/<AAAA-MM-DD>--<repo>--handoff-cota-<id8>.md` no repositório atual, mesma forma, na
   branch da sessão. A camada `REPOS.md` do vigia lista a branch; a memória compartilhada também o lê.

## 5. Travas
- **Nunca** segredo, token, senha, chave, nem dado de cliente: pessoa que não é o Lucas (cliente, membro, equipe) vira **iniciais** no arquivo inteiro, título incluído. Antes do commit:
  `grep -nE '(sk-|eyJ[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{12,}|-----BEGIN|password=|senha:)' <arquivo>` tem de voltar vazio.
- O handoff descreve; não executa nada: não mergeia, não arquiva, não interrompe, não mexe na Meta, não manda mensagem
  a pessoa de fora.
- Custo: até US$ 0,50 por handoff sem perguntar (uma leitura, um arquivo, um commit).
- Terminou → título do chat pela regra `titulo-de-chat`, com a ação que falta **na outra conta** quando a cota desta acabou
  (ex.: `✋ !!!! 15/10 · A80 · TEMA → retomar na conta X pelo handoff`). Em 0,95 ou mais sem handoff pronto: `atrasado` no título.

## 6. Como a outra conta usa
Abrir um chat novo com o hub, ler `docs/ops/HANDOFF-COTA/<conta>--<renovação>/README.md` (urgentes primeiro) e colar o
**prompt de retomada** do arquivo do chat. Não precisa do merge: a branch já é legível pelo GitHub. Antes de migrar, olhar
o título do chat `⚙ COTA` da conta destino — cada conta só lê a própria cota.

*Norma: `.claude/rules/cota-90-handoff.md` (hub). Procedimento do vigia (mão 2) e prompt para ligar nas contas:
`docs/ops/COTA-90-HANDOFF.md`. Skill espelhada em todo repositório pelo `scripts/sync-rules.mjs` (3º canal).*

🕒 2026-10-14 02:26 (São Paulo) · ✍ lucasscudeler · 💬 ✋ !!! 16/10 · A85 · COTA HANDOFF v2 → mergear hub e ligar vigia nas 3 contas · #chat-GEXx7x
