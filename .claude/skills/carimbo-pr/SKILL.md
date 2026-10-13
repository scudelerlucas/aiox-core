---
name: carimbo-pr
description: Carimbo obrigatório em todo PR aberto por sessão do Claude — conta Max, nome do chat com link, hora de São Paulo e de onde a sessão rodou. Ativar SEMPRE antes de criar ou editar o corpo de um PR (create_pull_request, update_pull_request), em qualquer repositório. A Action `carimbo-pr` reprova PR de branch `claude/` sem ele.
---

# Carimbo de PR (ordem do operador, 13/10/2026)

Palavras dele: *"Preciso desse stamp da conta, do nome do chat, do time stamp e talvez do local."*
Motivo: em 13/10 não deu para saber qual conta Max tinha feito o PR #1620 — o corpo só trazia o link da sessão,
e o link só abre na conta dona. O carimbo diz a conta em texto, sem precisar abrir nada.

## Onde vai
No **fim do corpo de todo PR** que a sessão abrir, logo antes das linhas de atribuição. Se o PR já existir e
estiver sem carimbo (ou com carimbo de outra sessão que o retomou), a sessão acrescenta um novo carimbo — não
apaga o antigo: cada sessão que mexeu no PR deixa o seu.

## O bloco — copiar exatamente estas linhas, trocando só os valores

```
<!-- carimbo-pr v1 -->
**Carimbo da sessão**
- Conta: <e-mail da conta Max>
- Chat: <título do chat> · https://claude.ai/code/session_<id>
- Hora: <AAAA-MM-DD HH:MM> (São Paulo)
- Onde: <de onde rodou>
<!-- /carimbo-pr -->
```

## De onde vem cada valor — medido no mesmo turno, nunca de memória

| Campo | Fonte | Se não houver |
|---|---|---|
| Conta | o e-mail da conta que o ambiente anexa ao contexto da sessão (`userEmail`) | `não informada pelo ambiente` |
| Chat | `get_session` sem `session_id` (servidor Claude Code Remote): campo `title` e `id` | o link da sessão que já vai na atribuição; título `sem título` |
| Hora | `TZ=America/Sao_Paulo date '+%Y-%m-%d %H:%M'` | `sem relógio nesta sessão` |
| Onde | `get_session`: `environment_kind` (`anthropic_cloud` → "nuvem Anthropic") + `origin` (ios, web, desktop…) — ex.: `nuvem Anthropic · aberto pelo iOS`. Sessão local: `máquina local (<hostname>)` | `não medido` |

"Onde" é o lugar da **sessão**, não a localização física do Lucas — o ambiente não informa essa, e ela não
se inventa.

## O que não entra
Nome ou identificador do modelo (proibido em PR pelo ambiente), token, segredo, dado de cliente.

## A checagem
`.github/workflows/carimbo-pr.yml` (espelhada do hub para os irmãos pelo `scripts/sync-rules.mjs`, 3º canal)
reprova PR de branch `claude/` aberto a partir de 13/10/2026 22:00 UTC sem as linhas `Conta:`, `Chat:` com link
de sessão e `Hora:` dentro dos marcadores. Branch de pessoa, do Codex (`codex/`, `chatgpt/`) e do Dependabot não
é conferida. Vermelho por falta de carimbo se corrige editando o corpo do PR — a Action roda de novo sozinha.
