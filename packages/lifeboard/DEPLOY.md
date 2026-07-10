# OS-LIFEBOARD — Deploy (Vercel + Supabase)

Estado atual: **schema aplicado no Supabase real, 18 tarefas reais do Calendar já
ingeridas, código live testado (54/54) e pushed.** Falta só o deploy na Vercel,
que precisa das env vars serem configuradas por Lucas (segredos não vão pro git).

## Passo a passo (~3 min)

1. **Vercel → New Project → Import Git Repository →** `scudelerlucas/aiox-core`
2. **Root Directory:** `packages/lifeboard`
3. **Branch:** `claude/autonomous-implementation-p00mc8` (ou `main`, depois do merge do PR #1)
4. **Framework Preset:** Next.js (auto-detectado)
5. **Environment Variables** (Production) — cole os 5 nomes abaixo com os valores
   que Lucas tem (o Claude te passou os valores no chat; NÃO ficam versionados):

   | Nome | O que é |
   |------|---------|
   | `LIFEBOARD_DATA_MODE` | `live` (liga a leitura do Supabase real) |
   | `SUPABASE_URL` | URL do projeto Supabase (`https://hciiilopyivjaekaxfqp.supabase.co`) |
   | `SUPABASE_ANON_KEY` | chave anon/publishable do projeto (server-only aqui) |
   | `LIFEBOARD_LOAD_SECRET` | segredo que destrava a RPC `lifeboard_load` |
   | `LIFEBOARD_ACCESS_SECRET` | senha do Basic Auth do dashboard |

6. **Deploy.**

## Depois do deploy

- Abrir a URL → o navegador pede login (Basic Auth): **usuário qualquer**, senha =
  o valor de `LIFEBOARD_ACCESS_SECRET`.
- Dentro: dashboard ALMA PETRA com as **18 tarefas reais do Calendar**, grafo de
  dependências e lista "hoje" (motor HIERARQ).
- Health-check público (sem auth): `https://SUA-URL/api/health` → deve responder
  `{ "status": "ok"|"degraded", ... }`.

## Como a leitura live funciona (sem vazar credencial)

O app NÃO usa a service_role key nem afrouxa a RLS. Lê tudo por UMA função
Postgres `SECURITY DEFINER` protegida por segredo — `lifeboard_load(p_secret)` —
que só devolve as linhas do dono (Lucas) e só se o segredo bater (mesmo padrão do
`offerforge_load` já usado no ecossistema). Segredos e chave vivem só em env
server-side / Vercel, nunca no git nem no bundle client (`import 'server-only'`,
kill-switch nº 3 do PRD / camada G do CHC).

## Rollback

Vercel instant rollback. O `/api/health` é a sonda do rollback automático
(kill-switch nº 6): se falhar 2×, reverter o deployment.

## Fase 2 (E6 — automação n8n)

Só depois de alguns dias de uso real da Fase 1 em prod (dependência dura do PRD
§8). Não iniciada.
