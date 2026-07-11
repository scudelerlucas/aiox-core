# PRD — OS-LIFEBOARD

> Painel único de projetos multi-fonte com grafo de dependências e priorização diária "o que faço hoje", paleta ALMA PETRA.

**Encaixe canônico:** Doc de projeto (ALMA PETRA, uso pessoal de Lucas — não Pandora/esteira). Escrito no PRD-TEMPLATE-CANON v1.0 (ADR-20260530-01). Executável por AIOX-PRO v5.0.3 no Claude Code, do gargalo ao deploy, parando só em kill-switch.
**Cadeia:** TNF v4.1 → TGM v4.1 → CHC v2.0 → FORJA v2.1 → OPERADOR v1.0 → RETROFORJA v1.2
**Alvo de build:** `packages/lifeboard/` · pipeline AIOX-PRO: `@pm → @architect → @data-engineer → @ux-design-expert → @sm → @po → @dev → @qa → @devops`

---

## 1. Identidade

**Sigla:** OS-LIFEBOARD · **Versão:** v1.0 · **Prioridade (HIERARQ):** P1 (Artefatos/produtividade, S=125) · **Tipo:** web + api + db + automação · **Status:** novo · **Autonomia:** plena até prod c/ kill-switch

Marca: **ALMA PETRA** (sistema pessoal de Lucas, não Pandora — separação de marca canônica). Paleta: navy `#0A1628`, bone `#F5F2EC`, dourado fosco `#A8895A`.

## 2. Gargalo

O que trava hoje: o estado real dos projetos de Lucas está **fragmentado em 5 fontes que não conversam** — projetos/chats do Claude, pastas do Google Drive, Notas do iPhone, Gmail e (fonte esquecida no pedido, agora incluída) **todas as agendas do Google** onde aparece o nome de Lucas ou eventos marcados com a sigla **LS**. Não existe uma visão única de "o que existe, o que depende de quê, o que faço hoje".

É **gargalo de transferência, não de arquitetura.** A informação existe; falta um agregador que a unifique e imponha uma camada de **dependências (precedência → posterioridade)** que nenhuma das fontes carrega nativamente. A última milha (Lucas → materialização) é onde o valor trava; este OS ataca exatamente isso.

## 3. Objetivo (estado pronto)

Um dashboard ALMA PETRA que, **atualizado ≤1×/dia automaticamente**, mostra num grafo único todos os projetos das 5 fontes com suas tarefas encadeadas por dependência, e responde em <5s à pergunta **"o que eu tenho que fazer e priorizar hoje?"** rodando o motor HIERARQ — sem Lucas costurar fonte na mão.

## 4. Critérios de aceite

- [ ] Ingestão das 3 fontes API-nativas (Google Calendar multi-agenda, Gmail, Drive) roda via MCP conectado, sem intervenção manual.
- [ ] Filtro de calendário aplica a regra "nome de Lucas OU sigla LS no título/descrição" e captura eventos de agendas de terceiros que contenham LS.
- [ ] Fontes sem API (Notas iPhone, chats Claude) entram por caminho semi-manual declarado (colagem/import), com parser que normaliza para o schema — sem fingir automação inexistente.
- [ ] Toda tarefa suporta `predecessor_ids[]` e `successor_ids[]`; o grafo renderiza a cadeia antecedência→posterioridade sem ciclo (validação DAG).
- [ ] O motor de priorização diária ordena tarefas por HIERARQ (S1×S2×S3, desempate S1>S3>S2) e devolve a lista "hoje" com justificativa curta por item.
- [ ] Dashboard renderiza na paleta ALMA PETRA (navy/bone/dourado), dark mode, com o grafo gigante + a lista "hoje".
- [ ] Fase 2: automação n8n dispara 1×/dia, reescreve o estado e o dashboard reflete sem ação de Lucas.
- [ ] Nenhuma credencial Google vai para o bundle client-side (server-side only).

## 5. Decisão arquitetural

**Empacotar, não reinventar.** Três decisões estruturais:

(1) **Modelo de dados único e canônico de "tarefa"** como coluna vertebral — toda fonte heterogênea é normalizada para uma tabela `tasks` com dependências explícitas. É isso que unifica Calendar/Gmail/Drive/Notas/chats. Trade-off: exige um passo de normalização por fonte (adapters), mas é o que torna o grafo possível. Impacto downstream: o motor de priorização e o dashboard leem só o modelo canônico, nunca as fontes cruas.

(2) **Ingestão via MCPs já conectados** (Google Calendar, Gmail, Google Drive, n8n) em vez de SDKs próprios. Trade-off: dependência dos conectores; vantagem: zero infra de auth nova, roda hoje. Impacto: Fase 1 não precisa de backend de OAuth próprio.

(3) **Dependências declaradas, não inferidas** na v1.0. Nenhuma fonte carrega relação "B depende de A"; a v1.0 deixa Lucas declarar (ou a IA sugerir num passo de curadoria opt-in). Trade-off: curadoria manual inicial; evita o anti-padrão de inferência mágica frágil. Débito nomeado: inferência automática de dependências fica para v2.

## 6. Matriz de blindagem CHC

Sistema pessoal, dado só de Lucas — blindagem aqui é de **dado privado**, não de IP licenciável. Ainda assim herda a matriz:

| Camada | Conteúdo | Distribuição |
|------|--------|-----------------------------------|
| E | UI do dashboard, grafo, lista "hoje" | licenciável |
| C | Histórico de tarefas/projetos consolidado | licenciável (histórico) |
| R | Regras de normalização por fonte (adapters) | licenciável (sênior) |
| O | Lógica do motor HIERARQ (pesos S1/S2/S3, desempate) | **INALIENÁVEL** (_core-inalienavel) |
| G | Credenciais/tokens Google + conteúdo bruto privado (Gmail/Notas) | **INALIENÁVEL** (_core-inalienavel) |

> chc-verify roda antes de qualquer deploy; O e G nunca no bundle. Como é single-user, "distribuível" = qualquer artefato que saia da máquina/servidor de Lucas.

## 7. Dados / Schema

Stack: Supabase (projeto `hciiilopyivjaekaxfqp`, São Paulo) + Next.js + Vercel.

Tabelas:
- **`sources`** — `id, kind (calendar|gmail|drive|notes|claude_chat), label, auth_mode (api|manual), last_sync_at`.
- **`projects`** — `id, source_id, external_ref, title, status, updated_at`.
- **`tasks`** — `id, project_id, title, notes, due_date, status, priority_hierarq (jsonb: s1,s2,s3), predecessor_ids uuid[], successor_ids uuid[], source_id, external_ref, updated_at`.
- **`sync_log`** — `id, source_id, run_at, items_ingested, ok bool, error`.

RLS: tudo `owner = auth.uid()` (single-user, dado pessoal — RLS trava por dono). Cripto: tokens Google **nunca** em tabela cliente; ficam em Supabase Vault / env server-side (camada G). Particionamento: desnecessário no volume single-user; índice em `tasks(due_date)` e `tasks(status)` basta.

## 8. Épicos → Stories

**FASE 1 — MVP estático diário (roda com as 3 fontes Google + semi-manual). E1→E5.**

- **E1 — Fundação de dados (bloqueia tudo).** `@data-engineer *create-schema`: as 4 tabelas + RLS + índices + validação DAG (trigger/check que rejeita ciclo em predecessor/successor). Kill-switch: migração destrutiva → `--confirm-destructive`.
- **E2 — Ingestão Google (API-nativa).** Adapters Calendar (multi-agenda + filtro "Lucas | LS"), Gmail (threads marcadas/label), Drive (pastas de projeto). Cada adapter normaliza → `tasks`/`projects`. Depende de E1. Kill-switch: token no bundle → ABORTA.
- **E3 — Entrada semi-manual (Notas + chats Claude).** Endpoint + parser de colagem/import que normaliza texto colado para o schema. Depende de E1. Sem gate destrutivo (append-only).
- **E4 — Motor de priorização "hoje".** Serviço que roda HIERARQ sobre `tasks`, respeita dependências (não sugere tarefa cujo predecessor está aberto), devolve lista ordenada + justificativa. Depende de E1-E3. Camada O (inalienável).
- **E5 — Dashboard ALMA PETRA.** Next.js: grafo de dependências (DAG render) + lista "hoje" + filtro por fonte. Tokens de design paleta ALMA PETRA. Depende de E4. `@ux-design-expert *create-front-end-spec` antes de `@dev`.

**FASE 2 — Automação viva. E6.**

- **E6 — Cron diário n8n.** Workflow n8n (`n8n.lucasscudeler.com.br`) que dispara 1×/dia, chama os adapters de E2, reescreve `tasks`/`projects`, loga em `sync_log`; dashboard reflete no próximo load. Notas/chats seguem semi-manual (sem API — atalho iPhone→Drive opcional empurra Notas para a fonte Drive). Depende de E1-E5 verdes. Kill-switch: custo de infra > cap → PARA; falha 2× → alerta e mantém último estado bom.

## 9. Patch de escala

Single-user, escala trivial, mas herda o padrão: cache de leitura no dashboard (estado do dia servido de `tasks` já normalizada, não recomputa grafo a cada request) + degradação graciosa (se uma fonte falha no sync, dashboard mostra as demais + flag "fonte X desatualizada desde …"). Sem fila assíncrona necessária (sync diário, não tempo-real). maxTierTested = 1k tarefas (folga de ~50× sobre o volume real esperado); prod ≤ tier verde.

## 10. Patch de tokens

O único ponto com LLM é o passo opcional de **sugestão de dependências / normalização de texto colado** (E3/E4). Roteamento: determinístico fora do LLM sempre que possível (parsing de Calendar/Gmail/Drive é estrutural, zero token); LLM só no texto livre de Notas/chats. Prompt caching do contexto fixo (schema + regras). Saída estruturada por template (JSON de tarefa). Batch API para a sugestão de dependências (não-tempo-real, roda no cron). **Alvo ≥60% redução vs. mandar tudo pro LLM, 0 regressão** na fidelidade da normalização.

> Guarda inviolável: se a normalização perde fidelidade (tarefa some ou vira errada), reverte para parsing bruto sem LLM. Token-saving sem quality-gate é proibido.

## 11. Stress tests (≥3, verdes)

1. **Integridade / DAG:** inserir dependência cíclica (A→B→A) → sistema rejeita, grafo nunca renderiza ciclo.
2. **Fluxo até deploy:** de schema vazio → ingestão das 3 fontes Google (dados reais de teste) → grafo renderizado → lista "hoje" correta, tudo verde antes do PR.
3. **Blindagem / não-regressão:** chc-verify confirma token Google e conteúdo bruto Gmail fora do bundle client; normalização com LLM vs. sem LLM não perde nenhuma tarefa (diff = 0).
4. **Degradação:** derrubar uma fonte (ex.: Drive) no sync → dashboard segue de pé com as outras + flag de desatualização.

## 12. Deploy + Definition of Done

Deploy: Vercel (front + API routes) + Supabase (db/RLS) + n8n self-hosted (Fase 2). Health-check: rota `/api/health` valida conexão Supabase + último `sync_log.ok`. Rollback: Vercel instant rollback + n8n workflow desligável (volta ao dashboard estático da Fase 1).

DoD fecha quando: todos os AC marcados (incl. escala e tokens) · ≥3 stress verdes · chc-verify passou (O,G fora do bundle) · maxTierTested declarado · não-regressão de normalização verde · kill-switches presentes · PR CodeRabbit + merge · prod + health-check OK + rollback testado · não duplica IP (ecossistema auditado: nada no aiox-core faz isso).

---

## Máquina de estados (execução autônoma)

```
read-prd → plan → implement → stress-test(≥3 verde) → chc-verify → load-test(tier-green) → quality-no-regression → open-pr → CodeRabbit → merge → preview-deploy → smoke → prod-deploy → health-check
```

O agente percorre sozinho. Para EXCLUSIVAMENTE nos kill-switches.

## Kill-switches (herdados)

1. Migração destrutiva (perda de dados) → exige `--confirm-destructive`
2. Custo de infra > cap do budget.json → PARA
3. Vazamento de `_core-inalienavel` (token Google, motor HIERARQ) no bundle → ABORTA
4. Blindagem CHC falha → ABORTA deploy
5. Deploy de prod acima do maxTierTested → PARA
6. Health-check prod falha 2× → rollback automático

## Definition of Done (checklist canônico)

- [ ] Todos os critérios de aceite (incl. escala e tokens) marcados.
- [ ] ≥3 stress tests verdes, limpos, sem erros.
- [ ] chc-verify passou (O,G fora do bundle).
- [ ] maxTierTested declarado; prod limitado a ele.
- [ ] Teste de não-regressão de qualidade (normalização) verde.
- [ ] Kill-switches presentes cobrindo destrutivo/custo/IP/CHC/tier/health.
- [ ] PR revisado (CodeRabbit) + merge.
- [ ] Deploy prod + health-check OK; rollback testado.
- [ ] Não duplica IP existente (aiox-core auditado — nada faz agregação multi-fonte pessoal).

---

*PRD OS-LIFEBOARD v1.0 — Lucas Scudeler — ALMA PETRA — Julho 2026*
*Escrito no PRD-TEMPLATE-CANON v1.0 (ADR-20260530-01). Para execução via AIOX-PRO v5.0.3 no Claude Code.*
*Prioridade HIERARQ P1. Marca ALMA PETRA (uso pessoal, não Pandora).*

---

## Nota de execução autônoma (sessão overnight)

Decisão do operador para esta rodada autônoma (sem check-in até a manhã):

- **Repo/alvo confirmado:** `aiox-core/packages/lifeboard/`, branch `claude/autonomous-implementation-p00mc8`.
- **Escopo autônomo desta rodada:** E1→E5 completos (schema, adapters, motor HIERARQ, dashboard) com **dados sintéticos de teste** — sem tocar o Supabase real (`hciiilopyivjaekaxfqp`), sem conectar OAuth real de Calendar/Gmail/Drive, sem deploy real em Vercel/n8n.
- **Pausado para revisão manual de manhã:** aplicar a migration no Supabase real, conectar as credenciais Google reais, e o deploy de produção (E6/Fase 2 nem começa).
