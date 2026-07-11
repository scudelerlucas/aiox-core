# Deploy — idea-inbox (Vercel)

Status: **PRONTO E AUDITADO (verdict SHIP)** para o escopo **Telegram + `/ingest`**.
Bloqueio unico: **autenticacao Vercel** (esta sessao nao tem `VERCEL_TOKEN` nem login
interativo). Assim que a auth for fornecida, o deploy e um comando.

## O unico passo que falta (voce escolhe um)

**A) Token (CLI):** gere um token em https://vercel.com/account/tokens e exponha no
ambiente da sessao/projeto como `VERCEL_TOKEN`. Depois:

```bash
cd packages/idea-inbox
npm run preflight
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```

**B) Conector Vercel (Claude):** autorize o conector Vercel nas configuracoes de
conectores do claude.ai. Com ele ativo, o deploy pode ser disparado pelo assistente
via a ferramenta de deploy da Vercel.

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
