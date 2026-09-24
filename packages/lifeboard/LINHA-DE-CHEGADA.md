# LifeBoard v1 — linha de chegada

> **Medido em 24/09/2026** contra o `PRD.md` (§4 critérios de aceite + Definition of Done = 17 caixas).
> Passo 2 do prompt `docs/lifeboard/00-PROMPT-MELHORADO-codex-astra-no-claude-code-v1.0.md`.
> **Estado desta página: PROPOSTA.** Os cortes para a v2 só valem depois do "aprovo" do Lucas.
>
> Base da medição: `main` em `b4dbcf6` (PR #42) · `tsc --noEmit` exit 0 · vitest **1488/1488** (74 arquivos) ·
> produção `aiox-core-lifeboard.vercel.app` no banco `hciiilopyivjaekaxfqp` desde 24/09 ·
> `/api/health` = `degraded` (banco de pé, fontes atrasadas) · login Google provado pelo Lucas em 24/09.

## Em uma frase

O painel está pronto. **O que falta é a comida dele:** ninguém busca agenda, Gmail e Drive sozinho.
Os três conectores "reais" são esqueletos que param com `PAUSADO` (`src/adapters/*/client.mcp.ts`), e o
desenho do PRD supunha que um site na Vercel usaria os conectores do Google que moram nas sessões do
Claude, o que ele **não alcança**. Por isso as fontes estão paradas desde 09/07 e a caixa 1 nunca fechou.

## As 17 caixas

| # | Item do PRD | Status | Prova | Dono do que falta |
|---|---|---|---|---|
| A1 | Ingestão automática de agenda, Gmail e Drive | **FALTA** | `src/adapters/{calendar,gmail,drive}/client.mcp.ts` lançam "PAUSADO"; `/api/health`: agendas com última sincronização em 09/07 | **Lucas decide o caminho (D-A1)** → depois Codex |
| A2 | Filtro "Lucas ou LS", inclusive agenda de terceiros | FEITO | `src/adapters/calendar/filter.ts` + `tests/unit/normalize.calendar.test.ts`; o painel de 24/09 mostra cartões "LS …" de agenda de terceiro | — |
| A3 | Notas e chats por colagem, com parser | FEITO | `src/app/api/ingest/manual/route.ts`, `src/adapters/manual/*`, `tests/unit/normalize.manual.test.ts` | — |
| A4 | Dependências (antes → depois) sem ciclo | FEITO | trigger `lifeboard_check_task_dag` (`0001_init.sql`), `tests/unit/dag.test.ts`, `src/components/task/relacoes-painel.tsx` | uso: os dados reais têm **0 ligações** (é declarar, não programar) |
| A5 | Lista "hoje" pelo HIERARQ, com justificativa | FEITO | `src/core/prioritize/{hierarq,today}.ts`, `tests/unit/hierarq.test.ts`, `/api/today` | — |
| A6 | Painel na paleta ALMA PETRA, escuro, grafo + "hoje" | FEITO | print do Lucas, 24/09 | — |
| A7 | Fase 2: atualização 1×/dia sem ação do Lucas | **FALTA** | `DEPLOY.md` §"Fase 2": "Não iniciada" | **mesmo caminho do A1** (proposta: fundir com A1) |
| A8 | Nenhuma credencial Google no bundle do navegador | FEITO | `import "server-only"` em todo cliente de fonte; chc-verify de 09/07 (`qa-gate-e1-e5.md` §3) | — |
| D1 | Todos os critérios marcados | FALTA | consequência de A1 e A7 | fecha sozinho |
| D2 | ≥3 stress tests verdes | FEITO (com dados de teste) | `qa-gate-e1-e5.md` §2: 4 de 4 verdes; `tests/integration/sync.test.ts` | stress 2 com dado real volta a valer quando A1 fechar |
| D3 | chc-verify passou (motor e segredo fora do bundle) | **FALTA** | última prova 09/07; 67 commits depois, o bundle mudou e é conferido à mão | **Claude**: virar script e rodar no build atual |
| D4 | maxTierTested declarado (1k tarefas) | **CORTADO PARA v2** (proposta) | nenhum teste com 1.000 tarefas; volume real hoje ≈ 18 cartões | — |
| D5 | Não-regressão da normalização | FEITO | `tests/unit/normalize.manual.test.ts` (diferença com LLM × sem LLM = 0) | — |
| D6 | Kill-switches presentes | FEITO nos que se aplicam; **2 e 5 CORTADOS PARA v2** (proposta) | nº 3 `server-only`; nº 6 `/api/health`; nº 1: migração só roda à mão no SQL Editor (gate humano). Nº 2 (teto de custo de infra) e nº 5 (tier) não têm infra paga nem volume que os justifique | — |
| D7 | PR revisado + merge | FEITO | PRs #21, #24, #30, #41, #42 mergeados | — |
| D8 | Produção + health ok + rollback testado | **FALTA** | produção no ar e login ok (24/09); health = `degraded` até A1; rollback nunca exercitado | **Lucas**: 1 rollback de teste na Vercel (e voltar) |
| D9 | Não duplica IP existente | FEITO | declaração do PRD, conferida: nada no `aiox-core` faz agregação multi-fonte pessoal | — |

**Contagem (17):** 11 FEITO (o D6 com parte cortada) · 5 FALTA (A1, A7, D1, D3, D8) · 1 CORTADO PARA v2 (D4), ainda como proposta.
Dos 5 FALTA, **A1 destrava A7, D1 e metade do D8.** É a única caixa grande.

## Decisão que só o Lucas toma — D-A1: como a comida chega

| | Caminho | O que exige de você | Código (dono Codex) |
|---|---|---|---|
| **A** | **Uma rotina diária do Claude** (Routine, sessão nova por disparo) lê agenda, Gmail e Drive pelos conectores **que já estão ligados** e manda o bruto para uma rota nova do LifeBoard, protegida pelo segredo que já existe; o servidor normaliza com os adaptadores prontos e grava o `sync_log` | só aprovar a rotina (1×) | rota `POST /api/ingest/google` + testes; os `normalize` já existem |
| B | Login Google próprio do app (Client ID/Secret no Google Cloud, token guardado no servidor) + Vercel Cron | criar credencial no Google Cloud e colar na Vercel | clientes reais das 3 fontes + cron + renovação de token |
| C | n8n, como o PRD original | confirmar que `n8n.lucasscudeler.com.br` está vivo e montar o fluxo | rota de entrada igual à do A |

**Recomendação: A.** Usa o que a casa já paga e já tem ligado, não cria credencial nova e reaproveita
os adaptadores prontos. O custo é depender da conta Claude e dos conectores dela.

## Cortes propostos para a v2 (aprovar ou recusar)

1. **D4 — teste com 1.000 tarefas.** Volume real ≈ 18. Volta quando passar de 200.
2. **D6 nº 2 e nº 5 — teto de custo de infra e tier.** Não há infra paga nem volume.
3. **Inferência automática de dependências** — já era v2 no PRD §5(3); só registrando.

## Ordem depois do "aprovo"

1. Lucas: decide D-A1 e aprova (ou recusa) os cortes.
2. Codex (via `/codex:rescue`, no iMac): a rota de ingestão do caminho escolhido, com teste que falha antes e passa depois.
3. Claude: confere, abre o PR, no máximo 2 rodadas de revisão; D3 vira script no mesmo PR ou no seguinte.
4. Lucas: aprova a rotina diária (se A) e faz 1 rollback de teste (D8).
