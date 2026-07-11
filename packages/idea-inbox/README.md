# @aiox/idea-inbox

Capture front-door do **IdeaForge**: um servidor webhook zero-dependencia que recebe audio/texto do Telegram e WhatsApp (ou de qualquer canal generico), normaliza o payload de cada canal e despacha o pipeline [`@aiox/idea-forge`](../idea-forge) — sem bloquear a resposta HTTP e sem nunca perder uma ideia.

CLI First: o inbox e um processo de servidor, mas toda a inteligencia (normalizacao, verificacao, despacho) roda em Node puro, sem framework HTTP e sem dependencias npm.

Dois modos de execucao:
- **Servidor standalone** (`bin/idea-inbox.mjs`, `node:http`): fire-and-forget — responde 202 e roda o pipeline em segundo plano, persistindo os artefatos em disco. Ideal para VPS/container.
- **Serverless (Vercel)** (`api/*.mjs`): sem processo de fundo — roda o pipeline **sincrono** (offline, ~100ms) e devolve o resumo (score/percentil/RETROFORJA) inline. FS efemero (`/tmp`).

## Deploy (Vercel)

```bash
npm run preflight        # valida prontidao (arquivos, sintaxe, dep, secrets, token)
npm run deploy:preview   # vercel deploy (preview)
npm run deploy           # vercel deploy --prod
```

Configuracao do projeto Vercel: **Root Directory = `packages/idea-inbox`** (monorepo npm workspaces resolve `@aiox/idea-forge`). `vercel.json` mapeia `/health`, `/ingest`, `/webhook/telegram`, `/webhook/whatsapp` para as funcoes em `api/`.

Variaveis de ambiente (Vercel → Settings → Environment Variables):

| Var | Efeito | Recomendacao producao |
|-----|--------|------------------------|
| `TELEGRAM_WEBHOOK_SECRET` | verifica header `x-telegram-bot-api-secret-token` | **defina** (senao aceita sem verificar) |
| `WHATSAPP_APP_SECRET` | verifica HMAC `x-hub-signature-256` | **defina** (senao aceita sem verificar) |
| `IDEAFORGE_DIR` | dir do store (efemero na Vercel) | `/tmp/idea-inbox` |
| `ANTHROPIC_API_KEY` | liga enriquecimento por LLM | opcional |

### Escopo recomendado deste deploy: **Telegram + /ingest**

Endpoints prontos para producao na Vercel: `/webhook/telegram` (token) e `/ingest` (Bearer `INGEST_TOKEN`). Ambos com verificacao fail-closed em producao, rate limit e pipeline bounded.

### Endurecimento de seguranca (pos-auditoria)

| Item | Comportamento |
|------|---------------|
| Fail-closed em producao | Sem secret/token do canal em `VERCEL=1`/`NODE_ENV=production` → **401** (a menos que `IDEAINBOX_ALLOW_UNSIGNED=1`) |
| `/ingest` | Exige `Authorization: Bearer $INGEST_TOKEN` |
| Rate limit | Por IP confiavel (`x-real-ip` / XFF mais a direita, nao spoofavel), `IDEAINBOX_RATE_LIMIT` req/min → **429** |
| Custo por request | Pipeline **bounded ate `dispatch`** (sem a simulacao 99.9% inline); `maxDuration: 10` |
| Corpo | Teto 256KB → **413**; prototype pollution (`__proto__`/`constructor`/`prototype`) → **400** |
| Erro interno | **500** so com `errorId` (stack apenas no log do servidor) |

> ⚠️ **WhatsApp na Vercel (N3):** o HMAC exige o corpo **cru**; se a plataforma pre-parsear o JSON, o handler rejeita (401, fail-closed) em vez de validar errado. Para WhatsApp com HMAC garantido, rode o **servidor standalone** (`bin/idea-inbox.mjs`), que le o corpo cru.
> ⚠️ **Servidor standalone = local/VPS confiavel (N6):** `bin/idea-inbox.mjs`/`src/server.mjs` nao passam pela mesma camada endurecida (`api/_core.mjs`). Nao exponha o standalone na internet publica sem colocar um proxy/auth na frente; para internet publica, use a camada serverless.

## Endpoints

| Metodo | Rota                | Descricao                                                        | Resposta                              |
|--------|----------------------|-------------------------------------------------------------------|----------------------------------------|
| GET    | `/health`             | Liveness check                                                     | `200 { ok: true }`                     |
| POST   | `/webhook/telegram`   | Update do Telegram Bot API (voice/audio/texto/caption)             | `202 { runId, accepted, queued? }`     |
| POST   | `/webhook/whatsapp`   | Webhook do WhatsApp Cloud API (audio/texto)                        | `202 { runId, accepted, queued? }`     |
| POST   | `/ingest`             | Canal generico: `{ text, audioRef?, source? }`                     | `202 { runId, accepted, queued? }`     |
| *      | qualquer outra rota    | —                                                                   | `404 { error }`                        |

Erros de payload/assinatura nunca derrubam o processo:
- JSON invalido -> `400 { error }`
- Assinatura de webhook invalida (quando o secret esta configurado) -> `401 { error }`
- Corpo acima do limite (10MB) ou erro inesperado -> `500 { error }` (logado, processo segue vivo)

## Variaveis de ambiente

| Variavel                    | Efeito                                                                                     |
|------------------------------|----------------------------------------------------------------------------------------------|
| `PORT`                        | Porta HTTP (default `8787`, sobrescrita por `--port`)                                        |
| `TELEGRAM_WEBHOOK_SECRET`     | Se definido, valida o header `x-telegram-bot-api-secret-token`. Se **ausente**, verificacao e pulada (modo dev). |
| `WHATSAPP_APP_SECRET`         | Se definido, valida `x-hub-signature-256` (HMAC-SHA256 do corpo). Se **ausente**, verificacao e pulada (modo dev). |
| `ANTHROPIC_API_KEY`           | Repassada ao idea-forge — se ausente, o pipeline roda 100% offline (fallback deterministico). |

## Como rodar

```bash
cd packages/idea-inbox
npm start                       # porta 8787, dir .idea-inbox
node bin/idea-inbox.mjs --port 3000 --dir /var/data/idea-inbox
```

Smoke test manual:

```bash
curl http://localhost:8787/health
curl -X POST http://localhost:8787/ingest \
  -H 'content-type: application/json' \
  -d '{"text":"minha ideia de teste"}'
```

## Como despacha o idea-forge

Cada requisicao aceita:

1. `src/normalize.mjs` normaliza o payload do canal para `{ source, text, audioRef, meta }`.
2. `src/inbox.mjs#handleIngest` gera um `runId` (`ib-<timestamp>-<seq>`), chama `createRun(...)` do idea-forge e persiste o estado inicial no `Store` (mesmo formato de `.idea-forge/runs/<runId>.json`, aqui sob `<dir>/runs/`).
3. `runAll(state, { store })` e disparado **de forma assincrona (fire-and-forget)** — a resposta HTTP `202` volta imediatamente, sem esperar o pipeline (11 estagios: ingest → atomize → brainstorm → steroid → architect → score → dispatch → simulate → retroforja → report → canonize).
4. O pipeline roda **offline** por padrao (sem `ANTHROPIC_API_KEY` = fallback deterministico em todos os estagios — Constitution: "No LLM = no blocker").

## Fallback: fila de ideias cruas

Se `normalize`/`createRun` lancar por qualquer motivo (payload corrompido, canal desconhecido, etc.), ou se o pipeline assincrono falhar, a ideia crua e **sempre** persistida — nunca descartada silenciosamente:

```
<dir>/inbox-queue.jsonl
```

Uma linha JSON por ideia enfileirada: `{ queuedAt, channel, payload }`. Nesse caso a resposta HTTP ainda e `202 { runId: null, accepted: true, queued: true }` — o cliente do webhook (Telegram/WhatsApp) nunca ve erro, mesmo quando o processamento interno falha.

## Estrutura

```
src/normalize.mjs   canal -> { source, text, audioRef, meta }
src/verify.mjs       verificacao de assinatura por canal (com fallback dev)
src/inbox.mjs         handleIngest, enqueueRaw, newRunId/buildRunId
src/server.mjs        node:http server + rotas
bin/idea-inbox.mjs     CLI: sobe o servidor
test/inbox.test.mjs   node:test — contrato HTTP + unidades
```
