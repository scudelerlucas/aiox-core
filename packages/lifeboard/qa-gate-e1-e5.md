# QA Gate — OS-LIFEBOARD E1→E5 (rodada autônoma, fixtures)

```yaml
schema: 1
storyId: OS-LIFEBOARD-E1-E5
gate: CONCERNS
verdict: CONCERNS
status_reason: >
  E1→E5 verdes com fixtures: 54 testes passam, typecheck e build limpos, chc-verify
  confirma bundle client sem segredos nem motor HIERARQ. Uma observação de fronteira
  CHC de baixa severidade (score S recomputado client-side) e os itens PAUSADOS por
  decisão do operador (migration/credenciais/deploy) impedem um PASS pleno nesta rodada.
reviewer: Quinn (Test Architect & Quality Advisor)
updated: 2026-07-09T05:22:00Z
scope_note: >
  Rodada overnight E1→E5 com DADOS SINTÉTICOS. Migration real no Supabase,
  credenciais Google reais e deploy Vercel/n8n estão PAUSADOS por decisão explícita
  do operador — categorizados como "fora de escopo", NÃO como falha.
```

## 1. Execução da suíte (item 1)

| Check | Comando | Resultado |
|-------|---------|-----------|
| Unit + Integração | `npx vitest run` | ✅ 7 arquivos, **54 testes** passam (46 pré-existentes + 8 de integração escritos neste gate) |
| Tipos | `npx tsc --noEmit` | ✅ exit 0, zero erros |
| Build produção | `npx next build` | ✅ compila; 6 rotas; `/` 168 kB First Load JS |

Detalhe da suíte: `dag.test.ts` (13) · `hierarq.test.ts` (7) · `normalize.manual.test.ts` (12) · `normalize.calendar.test.ts` (8) · `normalize.gmail.test.ts` (3) · `normalize.drive.test.ts` (3) · **`integration/sync.test.ts` (8, novo)**.

## 2. Stress tests do PRD §11 (item 2)

| # | Stress | Veredito | Evidência |
|---|--------|----------|-----------|
| 1 | Integridade / DAG (A→B→A rejeitado) | ✅ VERDE | `dag.test.ts` (ciclo via predecessor, via successor, auto-referência, ciclo-não-derruba-serviço) + trigger SQL `lifeboard_check_task_dag` em `0001_init.sql` (CTE recursiva, dupla representação). Camada app + camada banco. |
| 2 | Fluxo até "hoje" (schema vazio → 3 fontes → grafo → lista hoje) | ✅ VERDE | **Escrito neste gate**: `integration/sync.test.ts` cobre repo vazio → `FixtureXClient.fetchRaw` → `adapter.normalize` → repo mock (upsert idempotente) → `buildTodayList`. Confirma 8 tarefas (Calendar 3 pós-filtro + Gmail 2 + Drive 3), evento LS de terceiro capturado, no-match/newsletter descartados, idempotência (2× sync = 8 não 16), e curadoria declarada reordena "hoje". |
| 3 | Blindagem / não-regressão | ✅ VERDE | (a) **chc-verify** (ver §3): grep nos chunks `.next/static` → motor HIERARQ (`compareHierarq`/`resolveActionable`/`buildTodayList`), clientes MCP e segredos AUSENTES do bundle client. (b) Não-regressão de normalização: `normalize.manual.test.ts` prova diff LLM-vs-bruto = 0 (guarda inviolável PRD §10 dispara e resgata tarefa). |
| 4 | Degradação (uma fonte falha → resto de pé + flag) | ✅ VERDE | **Escrito neste gate**: `integration/sync.test.ts` — `FailingDriveClient` lança; sync isola em try/catch; Calendar+Gmail ingerem (5 tarefas), `sync_log.ok=false` só no Drive; `computeSourceStatuses` marca Drive `severity: 'error'` com a mensagem de erro; lista "hoje" segue funcionando. |

## 3. chc-verify — bundle client limpo (item 2, stress 3)

**Método:** `next build` gerou 19 chunks JS em `.next/static`. Rodei greps direcionados sobre os chunks CLIENT:

- **Camada O (motor HIERARQ inalienável):** procura por `scoreHierarq|compareHierarq|detectCycleIds|resolveActionable|buildTodayList|s1 * s2 * s3` → **nenhuma correspondência**. O algoritmo (ordenação, desempate S1>S3>S2, resolução DAG, gating de dependência) NÃO está no client.
- **Camada G (credenciais/MCP):** procura por `McpCalendarClient|McpGmailClient|McpDriveClient|list_calendars|mcp__Google|GOOGLE_OAUTH|REFRESH_TOKEN|CLIENT_SECRET|SERVICE_ROLE|eyJ...|refresh_token|client_secret|hciiilopyivjaekaxfqp` → **nenhuma correspondência**.
- **Garantia estrutural:** `import "server-only"` no topo de `core/prioritize/*` e `adapters/*/client.mcp.ts`; o `next build` PASSOU, o que prova que nenhum Client Component importa essas fronteiras (senão o build quebraria). Kill-switch nº 3 é garantia de compilação, não disciplina manual.

**Achado (única correspondência relacionada):** o chunk `app/page-*.js` contém `function(e){let{s1:t,s2:s,s3:a}=e.priorityHierarq;return t*s*a}` — o componente client `task-node.tsx` RECALCULA o produto `S = s1*s2*s3` para exibir o badge "S {score}", e o DTO (`TodayItemDTO`) envia os fatores brutos `{s1,s2,s3}`. **Avaliação:** baixa severidade. O produto é aritmética trivial de exibição (front-end-spec §1.1 pede "S" nos nós); o motor inalienável de verdade (ordenação + desempate + DAG) permanece server-only. Ainda assim, é um leve vazamento de fronteira: o ideal é o servidor enviar o `score` já computado no DTO e reter os fatores. Ver ARCH-001 abaixo.

**Veredito chc-verify:** ✅ PASS (com nota de baixa severidade ARCH-001).

## 4. Auditoria de segredos (item 3)

Comando: `grep -rnE "hciiilopyivjaekaxfqp|SUPABASE_SERVICE_ROLE|GOOGLE_.*SECRET|GOOGLE_.*TOKEN|GOOGLE_.*CLIENT_ID" .env* src`

- `.env.example`: apenas NOMES de variável comentados, sem valores (`# GOOGLE_OAUTH_CLIENT_ID=`, etc.) — correto (camada G).
- `src/types/database.ts:11`: contém o project-ref `hciiilopyivjaekaxfqp` num COMENTÁRIO de documentação (comando `supabase gen types`). O project-ref é identificador público da URL Supabase, não credencial; e não vaza ao client (confirmado no §3).
- Nenhum service-role key, token OAuth, ou secret com VALOR em lugar algum. ✅ Limpo.

## 5. Critérios de aceite do PRD §4 (item 4)

| # | Critério | Status nesta rodada | Categoria |
|---|----------|---------------------|-----------|
| 1 | Ingestão das 3 fontes Google via MCP, sem intervenção manual | ⏸️ SATISFEITO COM FIXTURE / conexão MCP real PAUSADA | Lógica de adapter+factory+normalize pronta e provada (fixtures); flip `LIFEBOARD_DATA_MODE=live` + credenciais é a parte pausada. Depende de: credenciais reais. |
| 2 | Filtro "Lucas OU LS" captura eventos de terceiros com LS | ✅ SATISFEITO (fixture) | `filter.ts` + `normalize.calendar.test` + `integration/sync.test` (evento LS de terceiro capturado, no-match rejeitado). |
| 3 | Fontes sem API (Notas/chats) semi-manual com parser | ✅ SATISFEITO | `manual/parser.ts` + `manual/normalize.ts` + `/api/ingest/manual` + 12 testes; guarda de fidelidade provada. |
| 4 | `predecessor_ids[]`/`successor_ids[]`; grafo sem ciclo (DAG) | ✅ SATISFEITO | schema arrays + trigger anti-ciclo + `dag.ts` + `dependency-graph.tsx`; ciclo rejeitado em app e banco. |
| 5 | HIERARQ ordena S1×S2×S3, desempate S1>S3>S2, + justificativa | ✅ SATISFEITO | `hierarq.ts` + `today.ts` + `/api/today`; desempate exaustivamente testado. |
| 6 | Dashboard ALMA PETRA (navy/bone/dourado), dark, grafo + lista hoje | ✅ SATISFEITO (fixture) / deploy visual PAUSADO | `page.tsx`, `dashboard-client`, `dependency-graph`, `today-list`, tokens Tailwind; build OK. Render real depende de deploy (pausado). |
| 7 | Fase 2: automação n8n 1×/dia reescreve estado | ⛔ FORA DE ESCOPO | E6/Fase 2 — explicitamente não iniciada nesta rodada. |
| 8 | Nenhuma credencial Google no bundle client (server-side only) | ✅ SATISFEITO | chc-verify §3 — bundle client limpo; `server-only` guards; `.env.example` sem valores. |

**Resumo:** 5 de 8 SATISFEITOS nesta rodada (2,3,4,5,8); 2 SATISFEITOS-COM-FIXTURE dependentes da parte pausada (1,6); 1 FORA DE ESCOPO (7). Nenhum critério em FALHA dentro do escopo autônomo.

## 6. Issues (item 6)

| id | severidade | categoria | achado | ação sugerida |
|----|-----------|-----------|--------|---------------|
| ARCH-001 | low | architecture / CHC | `task-node.tsx` (Client Component) recomputa `score = s1*s2*s3` e o DTO `TodayItemDTO` transporta os fatores brutos `{s1,s2,s3}` ao client. O motor inalienável (ordenação/desempate/DAG) NÃO vaza, mas o cálculo do score e os fatores ficam expostos. | Enviar `score` já computado pelo servidor no DTO (`/api/today`) e reter `priorityHierarq` no server; UI consome só o número. Fortalece a fronteira camada-O sem mudar UX. NÃO corrigido aqui: toca contrato de DTO + múltiplos componentes (não é fix trivial) e está fora da autoridade @qa de editar source de app. Encaminhado a @dev. |

Nenhum bug funcional real encontrado. Nenhuma correção de source aplicada (o único achado é de fronteira/design, não defeito; e excede o escopo de "fix pequeno"). A única escrita foi o teste de integração `tests/integration/sync.test.ts` (autoridade @qa sobre suítes de teste).

## 7. Pendências para revisão manual (fora de escopo autônomo)

Estas ficaram PAUSADAS por decisão explícita do operador e devem ser executadas/validadas manualmente de manhã:

1. **Aplicar a migration `supabase/migrations/0001_init.sql` no Supabase real** (`hciiilopyivjaekaxfqp`, São Paulo) — kill-switch nº 1 exige `--confirm-destructive` se destrutiva; a migration é não-destrutiva (IF NOT EXISTS, sem DROP), mas a aplicação ao projeto real não foi feita.
2. **Conectar as credenciais Google reais** (Calendar/Gmail/Drive) na camada G (Vault/env server-side) e trocar `LIFEBOARD_DATA_MODE` de `fixture` para `live` — ativa os `client.mcp.ts` (hoje esqueletos que lançam). Validar a transcrição MCP→`Raw` (único trecho não coberto por fixture). Nota: `src/lib/mcp/credentials.ts` e `google.ts` (referenciados na arquitetura §3/§6) ainda NÃO existem — precisam ser criados junto com a ativação live.
3. **Deploy real Vercel (front + API routes) + Supabase + health-check `/api/health`** — a rota `/api/health` prevista na arquitetura §7 ainda NÃO existe (só `/api/today`, `/api/sources`, `/api/ingest/manual`); criar antes do deploy. Rodar chc-verify contra o bundle da Vercel (não só dry-run local) antes de publicar.
4. **Fase 2 / E6 — cron diário n8n** (`n8n.lucasscudeler.com.br`) — nem iniciada; depende de E1-E5 verdes + credenciais reais.

## 8. Gate decision

**Veredito: CONCERNS** (aprova com observações, não bloqueia).

- Todo o escopo autônomo E1→E5 (fixtures) está verde: 54 testes, tipos, build, chc-verify, 4 stress tests, auditoria de segredos.
- CONCERNS (não PASS) por: (a) ARCH-001 (fronteira CHC de baixa severidade a endereçar); (b) a conclusão plena dos AC 1 e 6 depende da parte PAUSADA (credenciais/deploy) — correto para esta rodada, mas o DoD do PRD §12 só fecha após migration + deploy + health-check reais.
- Não é FAIL: nenhum critério em falha dentro do escopo, nenhum teste quebrado, nenhum segredo vazado, nenhum defeito funcional.

**Próximo passo:** revisão manual da manhã executa as 4 pendências do §7; @dev endereça ARCH-001; então re-gate para PASS + DoD completo.

— Quinn, guardião da qualidade 🛡️
