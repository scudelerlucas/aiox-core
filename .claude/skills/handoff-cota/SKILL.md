---
name: handoff-cota
description: "!handoff — a sessão escreve o próprio handoff de cota: um arquivo autocontido (pedido · feito · onde parou · o que falta e de quem · decisões já tomadas · PRs e branches · prompt de retomada) no diretório da renovação semanal do hub, para o Lucas continuar sem fricção em outra conta Claude Max. Dispara sozinha quando a cota da conta (janela de 5 h = 'sessão', semana ou por modelo/Fable) está em 0,90 ou mais — lida por `list_events` deste chat, `rate_limit_event`; e sob demanda com `!handoff`. Vale em todo repositório e toda conta (mão 1 da regra `cota-90-handoff`). Ativar em: !handoff, !reidratar, 'handoff de cota', 'cota a 90', 'migrar de conta', 'passar para outra conta', 'limite de uso', 'rate limit', 'sessão quase no limite'."
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
1. **Hub clonado** (`Lucas-Contexto-Geral` na sessão): `git fetch origin main`; **branch própria deste chat, sempre nova a
   partir da `main`**: `claude/handoff-cota-<conta>-<id8>`. Nela entra **só o arquivo deste chat** (`git add` do caminho, nada
   mais). Commit, `push`, **PR pronto (nunca rascunho)** com o bloco `carimbo-pr`, e **merge pela própria sessão como classe 4**
   (`git-main-protegida`; pré-condição 0 lida na `main`, CI verde no head, título `[classe 4][<conta>]`, comando de volta no PR).
   O handoff só existe quando está na `main`: PR aberto e não mergeado é entrega pela metade.
   **Segundo handoff do mesmo chat** (`!handoff` de novo, ou cota ainda alta depois de mais trabalho): a branch com esse nome
   **já existe** → (a) PR ainda aberto: reutiliza a branch — `git merge origin/main` (nunca rebase), substitui o arquivo, commit, push,
   mesmo PR; (b) PR já mergeado: branch **nova** com sufixo de checkpoint `claude/handoff-cota-<conta>-<id8>-<AAAAMMDD-HHMM>`, a
   partir da `main`, e o arquivo (mesmo nome) é substituído — a `main` guarda a versão mais nova, o histórico guarda as anteriores.
   Só muda o nome entre checkpoints do mesmo chat; **nunca** entra branch de outro chat.
   **Nunca reaproveitar a branch de outro chat** (v1 desta seção mandava usar "a branch da renovação", compartilhada; medido em
   31/10/2026 no PR #2238: 4 chats, 16 commits, 23 arquivos num PR só, conflito contra a `main` e merge devolvido ao operador —
   `docs/audit/FULLFORCE-trava-handoff-branch-compartilhada-2026-10-31.md`). Nunca `--force`.
2. **Hub não clonado, mas no escopo** (todo chat das contas da casa): `create_branch` `claude/handoff-cota-<conta>-<id8>` a
   partir da `main` + `create_or_update_file` (GitHub MCP) com a mensagem `handoff-cota: <conta> <id8>`; PR pronto e merge
   classe 4 como no caminho 1.
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


## 7. Write-ahead e `!reidratar` (v3 do handoff diário, 29/10/2026 — `docs/ops/HANDOFF-DIARIO.md` §15)
- **Write-ahead (não só a 90%):** ao fim de todo turno que **muda o próximo passo** (os gatilhos do título, `titulo-de-chat`), grave o
  arquivo deste chat — o mesmo formato do §3, ~2 mil tokens — em `docs/ops/HANDOFF-COTA/DIARIO/<conta>/chats/<8 últimos do id>.md`, **na
  branch `claude/handoff-diario-<conta>`, pela API do GitHub** (`create_or_update_file`; branch inexistente → `create_branch` a partir da `main`),
  sem clonar. Abra com a linha de foto `🕒 hora SP · ✍ conta · 🧠 modelo · ⛽ livre: 5 h NN% · semana NN% · <modelo> NN% · contexto do chat NNN mil`,
  repita o título e termine com o prompt de retomada, que **nomeia o repositório a abrir** (só ele; o hub só se o trabalho é dele) e fecha com
  `Primeiro ato: renomeie este chat para «<título>».` Mesmas travas do §5 (sem segredo; pessoas em iniciais). O disparo noturno só aponta para o seu arquivo.
  **Guarda da branch fixa (31/10):** nessa branch entra **só** `docs/ops/HANDOFF-COTA/DIARIO/<conta>/**` — nunca commit de trabalho,
  nunca merge de outra branch, nunca arquivo fora da pasta. É isso que a mantém mergeável contra a `main` sem conflito; a branch
  compartilhada da cota (§4 v1) quebrou justamente porque recebia commits de fora (PR #2238).
- **`!reidratar #chat-xxxxxx`:** `scripts/handoff-achar.sh '#chat-xxxxxx'` (no hub clonado; sem ele, `get_file_contents` no caminho que
  `--caminho` indicar) imprime só o arquivo daquele chat. Leia-o, renomeie este chat com o título dele (trocando só o símbolo de vez se
  mudou) e siga o prompt de retomada. Nunca reidratar a partir de `.parcial.md` sem conferir o chat de origem.
