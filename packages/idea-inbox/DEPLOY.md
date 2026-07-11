# Deploy — idea-inbox (Vercel)

Status: **PRONTO E AUDITADO (verdict SHIP)** para o escopo **Telegram + `/ingest`**.

Tentativa de deploy nesta sessao: o conector Vercel esta **autorizado** (lista projetos,
consegue deployar), mas o token **nao tem permissao de CRIAR projeto**:

```
Vercel API error 403: "You don't have permission to create a project."
```

Como o projeto `idea-inbox` ainda nao existe na conta, o deploy para. Nao sobrescrevo
projetos existentes. Bloqueio = **permissao de criacao** (so voce levanta). Um dos 3 caminhos:

## O passo que falta (escolha um)

**A) Criar o projeto uma vez (mais rapido):** no dashboard Vercel, New Project → nome
`idea-inbox` (pode criar vazio). Depois eu deployo nele pelo conector (nao precisa criar,
so publicar) — ou voce roda o caminho B.

**B) Token (CLI, sobe o pipeline COMPLETO):** gere um token em
https://vercel.com/account/tokens, exponha como `VERCEL_TOKEN`. O CLI sobe a partir do
disco (sem limite de payload), entao vai a versao com pipeline inline:

```bash
cd packages/idea-inbox
npm run preflight
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```
Config do projeto: Root Directory = `packages/idea-inbox` (workspaces resolve `@aiox/idea-forge`).

**C) Ampliar o conector:** conceda ao conector Vercel a permissao de criar projeto nas
configuracoes de conectores do claude.ai; ai eu disparo direto pelo assistente.

## Configuracao do projeto na Vercel
- **Root Directory:** `packages/idea-inbox` (monorepo npm workspaces resolve `@aiox/idea-forge`).
- `vercel.json` ja define os rewrites (`/health`, `/ingest`, `/webhook/telegram`) e `maxDuration`.

## Variaveis de ambiente (Settings → Environment Variables) — OBRIGATORIAS em producao
| Var | Porque |
|-----|--------|
| `TELEGRAM_WEBHOOK_SECRET` | sem ela, `/webhook/telegram` fail-closa (401) em producao |
| `INGEST_TOKEN` | `/ingest` exige `Authorization: Bearer $INGEST_TOKEN`; sem ela, fail-closa (401) |
| `IDEAINBOX_RATE_LIMIT` | opcional (default 30 req/min/IP) |
| `ANTHROPIC_API_KEY` | opcional (liga enriquecimento por LLM; sem ela roda offline) |

> Sem os secrets, os endpoints **nao vazam nem aceitam anonimo** em producao — apenas
> retornam 401 (fail-closed). Defina-os para o servico ficar funcional.

## Pos-deploy (fechar o laco 99.9% no ambiente real)
O endpoint publico roda o pipeline **ate `dispatch`** (captura + gate 95+). A simulacao
E2E ate percentil 99.9% + RETROFORJA-P rodam no laco assincrono:

```bash
# apos o deploy, com a URL publica:
curl -sX POST https://<app>.vercel.app/ingest \
  -H "authorization: Bearer $INGEST_TOKEN" -H "content-type: application/json" \
  -d '{"text":"sua ideia aqui"}'
# -> { accepted:true, runId, score, passed, branch }

# laco completo (simulacao + retroforja) local a partir de um run:
idea-forge realize <runId> --target ./<projeto>
```

## Verdicts de auditoria
Duas rodadas independentes: DO-NOT-SHIP → correcoes (F1,F2,F3,F4,F5,F8) →
SHIP-WITH-FIXES → correcoes (N1,N2,N4; N3 escopado) → **SHIP** (Telegram + /ingest).
