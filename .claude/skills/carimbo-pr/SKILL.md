---
name: carimbo-pr
description: Carimbo obrigatório em todo PR aberto por sessão do Claude — hora de São Paulo, conta Max (nome antes do @), título do chat com link, hashtag única do chat para busca e de onde a sessão rodou; o modelo vem do trailer Co-Authored-By que o ambiente escreve em cada commit, nunca da mão da sessão. Ativar SEMPRE antes de criar ou editar o corpo de um PR (create_pull_request, update_pull_request), em qualquer repositório. A Action `carimbo-pr` reprova PR de branch `claude/` sem ele e commit de sessão sem o modelo.
---

# Carimbo de PR (ordem do operador, 13/10/2026; v2 no mesmo dia)

Palavras dele: *"Preciso desse stamp da conta, do nome do chat, do time stamp e talvez do local."* E, na v2:
*"Sempre publique com time stamp, assinatura da conta do Claude max - nome antes do @, título do chat, hashtag
do chat para buscar e achar com 99% de assertividade."*
Motivo: em 13/10 não deu para saber qual conta Max tinha feito o PR #1620 — o corpo só trazia o link da sessão,
e o link só abre na conta dona. O carimbo diz a conta em texto, sem precisar abrir nada.
Em 25/10 ele pediu o terceiro campo: *"cada PR coloque uma assinatura da conta que publicou, assim como o modelo
do Claude que publicou e o timestamp"* — a seção "Modelo" abaixo diz de onde ele vem.

## Onde vai
No **fim do corpo de todo PR** que a sessão abrir, logo antes das linhas de atribuição. Se o PR já existir e
estiver sem carimbo (ou com carimbo de outra sessão que o retomou), a sessão acrescenta um novo carimbo — não
apaga o antigo: cada sessão que mexeu no PR deixa o seu.

**Um carimbo por chat que empurrou commit** (decisão 2-A do operador, 13/10/2026): a Action lê o trailer
`Claude-Session:` de cada commit do PR e exige um bloco v2 cujo link do `Chat:` seja aquela sessão. Se entraram no
PR commits de **outro** chat (merge de outra branch, PR retomado), a sessão acrescenta também o bloco dele, com o que
souber; o que não souber vai nas formas de ausência da tabela (`não informada pelo ambiente`, `sem título`, `não medido`).

## O bloco — copiar exatamente estas linhas, trocando só os valores

```
<!-- carimbo-pr v2 -->
**Carimbo da sessão**
- Hora: <AAAA-MM-DD HH:MM> (São Paulo)
- Conta: <nome da conta Max, só a parte antes do @>
- Chat: <título do chat> · https://claude.ai/code/session_<id>
- Busca: #chat-<6 últimos caracteres do id da sessão>
- Onde: <de onde rodou>
<!-- /carimbo-pr -->
```

## De onde vem cada valor — medido no mesmo turno, nunca de memória

| Campo | Fonte | Se não houver |
|---|---|---|
| Hora | `TZ=America/Sao_Paulo date '+%Y-%m-%d %H:%M'` | `sem relógio nesta sessão` |
| Conta | o e-mail da conta que o ambiente anexa ao contexto da sessão (`userEmail`), **só a parte antes do @** (`almapetra.ltda@gmail.com` → `almapetra.ltda`) | `não informada pelo ambiente` |
| Chat | `get_session` sem `session_id` (servidor Claude Code Remote): campo `title` e `id` | o link da sessão que já vai na atribuição; título `sem título` |
| Busca | `#chat-` + os **6 últimos** caracteres do id da sessão, com a caixa original (`session_…VCGszhT` → `#chat-CGszhT`) — a mesma hashtag da regra `carimbo-de-publicacao` | — (sem id de sessão não há PR de sessão) |
| Onde | `get_session`: `environment_kind` (`anthropic_cloud` → "nuvem Anthropic") + `origin` (ios, web, desktop…) — ex.: `nuvem Anthropic · aberto pelo iOS`. Sessão local: `máquina local (<hostname>)` | `não medido` |

**Por que a hashtag é assim:** sai do id da sessão, que nunca muda (o título muda a cada turno). Usa os 6
**últimos** caracteres porque os primeiros são a hora em que o chat foi criado: dois chats abertos no mesmo minuto
teriam o mesmo começo. É a mesma hashtag da regra `carimbo-de-publicacao` (arquivos, comentários, agenda, cofre), então
uma busca só por `#chat-CGszhT` acha tudo o que o chat publicou, em qualquer lugar. No PR, a linha de carimbo daquela
regra vai logo abaixo deste bloco.

"Onde" é o lugar da **sessão**, não a localização física do Lucas — o ambiente não informa essa, e ela não
se inventa.

## Modelo — vem do commit, não da mão (ordem do operador, 25/10/2026)

O modelo do Claude que fez cada commit **já está no commit**: o ambiente escreve em todo commit de sessão o trailer
`Co-Authored-By: Claude <modelo> <versão> <noreply@anthropic.com>` (ex.: `Claude Fable 5.1`, `Claude Sonnet 5.5`),
a partir do modelo que **de fato serviu o turno** — e acompanha a troca no meio do chat (o chat que escreveu esta
seção rodou Haiku 4.5, Sonnet 5.5 e Fable 5.1 no mesmo dia; cada commit leva o seu). Medido na `main` do hub em
25/10: 125 dos últimos 200 commits trazem o trailer, 5 modelos diferentes.

Por isso o bloco **não tem linha `Modelo:`** e a sessão **não escreve o modelo à mão** em PR, commit ou arquivo:
o ambiente proíbe, e a sessão não tem como garantir qual modelo a está servindo naquele turno — uma linha escrita
por ela seria o único campo do carimbo que pode mentir sem querer. A fonte é o trailer; a Action lê e mostra.

| Onde ler o modelo | Como |
|---|---|
| No PR, aba Checks → "Carimbo de PR" → resumo do job | tabela *chat → modelo → nº de commits*, uma linha por combinação |
| Na página de cada commit no GitHub | o trailer está no fim da mensagem |
| No clone | `git log --format='%h %(trailers:key=Co-Authored-By,valueonly)'` |

Commit de sessão (com `Claude-Session:`) **sem** o trailer do modelo, feito a partir de 26/10/2026 00:00 UTC, reprova
o PR: é sinal de commit escrito fora do caminho normal (mensagem montada à mão sem os trailers do ambiente). Corrige-se
refazendo a mensagem do commit **só se a branch for da própria sessão** (`branches-de-agente`); branch alheia não se reescreve —
aí a sessão diz no PR qual commit é e por quê, e o operador decide.

## O que não entra
Nome do modelo escrito pela sessão (ver acima), token, segredo, dado de cliente.

## A checagem
`.github/workflows/carimbo-pr.yml` (espelhada do hub para os irmãos pelo `scripts/sync-rules.mjs`, 3º canal)
reprova PR de branch `claude/` aberto a partir de 13/10/2026 22:00 UTC sem as linhas `Hora:`, `Conta:` (sem o
`@`), `Chat:` com link de sessão e `Busca: #chat-…` dentro dos marcadores — e confere que a hashtag bate com o id
da sessão do link (hashtag copiada de outro chat dá vermelho). O carimbo v1 (sem `Busca`) só vale para PR
aberto antes de 13/10/2026 23:00 UTC. Branch de pessoa, do Codex (`codex/`, `chatgpt/`) e do Dependabot não
é conferida. Desde 14/10/2026 01:00 UTC ela também lê os commits do PR (até 250, pela API do GitHub) e reprova se
algum chat com trailer `Claude-Session:` em commit dessa data em diante ficou sem o próprio bloco; se não conseguir
ler os commits, reprova em vez de passar calada. Vermelho por falta de carimbo se corrige editando o corpo do PR — a Action roda de novo sozinha.
Desde 26/10/2026 00:00 UTC ela também lê o trailer `Co-Authored-By` de cada commit de sessão, publica no resumo do job
a tabela chat → modelo → commits, e reprova commit de sessão dessa data em diante que esteja sem o modelo.

🕒 2026-10-13 22:45 (São Paulo) · ✍ almapetra.ltda · 💬 !! 15/10 · A70 · CARIMBO POR CHAT → mergear o PR do trailer · #chat-CGszhT

🕒 2026-10-25 14:52 (São Paulo) · ✍ lucasscudeler · 💬 !! 27/10 · A70 · CARIMBO MODELO → mergear PR do modelo no carimbo · #chat-PoZoAa
