# RUNBOOK — OS-LIFEBOARD · Ordens AIOX-PRO para Claude Code

> Sequência copiável de ordens agênticas. Cada bloco roda uma etapa do pipeline AIOX-PRO v5.0.3. Formato nativo Hermes 2.6 acoplado aos star-commands dos agentes.
> **Origem:** PRD-OS-LIFEBOARD-v1_0.md (formato CANON) + AIOX-PRO-COMPLETE-ARCHITECTURE.md.
> **Marca:** ALMA PETRA · **Alvo:** `packages/lifeboard/` · **Data:** 2026-07-08 · NÃO-CANON (doc de projeto pessoal).

---

## Pré-voo (uma vez)

```
cd <repo-alvo>
npx aiox-core@latest install          # se ainda não instalado no repo
# cole PRD-OS-LIFEBOARD-v1_0.md em packages/lifeboard/PRD.md
```

**Eficiência de tokens (regra global do runbook):** rode cada agente com `*brief` ligado; use `@dev *develop-yolo` só nos épicos sem kill-switch (E3, E5); mantenha `*yolo` OFF em E1, E2 e E6 (tocam schema, credencial e infra). O IDS (`*ids check`) roda antes de cada CREATE para forçar REUSE>ADAPT>CREATE e não gerar código duplicado — é o maior economizador de token do fluxo.

---

## FASE 1 — MVP (E1→E5)

### Ordem 0 — PRD + Arquitetura

```
[AÇÃO] @pm *create-prd a partir de packages/lifeboard/PRD.md; depois @architect *create-full-stack-architecture
[ONDE] packages/lifeboard/
[RESTRIÇÃO] não reescrever o PRD (já está em formato CANON); arquitetura deve empacotar MCPs existentes (Calendar/Gmail/Drive/n8n), não criar OAuth próprio
[PRONTO QUANDO] existe architecture.md + tech-preset validado (@architect *validate-tech-preset) para Next.js+Supabase+Vercel
[MODO] passo-a-passo
```

### Ordem 1 — E1 · Schema (fundação, bloqueia tudo)

```
[AÇÃO] @data-engineer *create-schema: tabelas sources, projects, tasks (com predecessor_ids[]/successor_ids[]), sync_log + RLS owner=auth.uid() + índice tasks(due_date,status) + validação anti-ciclo DAG
[ONDE] Supabase hciiilopyivjaekaxfqp (São Paulo) via migration
[RESTRIÇÃO] NUNCA rodar migration destrutiva sem --confirm-destructive; tokens Google jamais em tabela cliente (vão pro Vault/env); rode *ids check antes de criar
[PRONTO QUANDO] @data-engineer *security-audit passa (RLS verde) + inserir A→B→A é rejeitado pela validação DAG
[MODO] passo-a-passo
```

### Ordem 2 — E2 · Ingestão Google (API-nativa)

```
[AÇÃO] @dev *develop três adapters read-only: Calendar (todas as agendas, filtro título/descrição = nome de Lucas OU sigla "LS", incl. eventos de agendas de terceiros), Gmail (threads com label de projeto), Drive (pastas de projeto). Cada um normaliza → projects/tasks
[ONDE] packages/lifeboard/src/adapters/{calendar,gmail,drive}
[RESTRIÇÃO] usar os MCP conectados (Google Calendar/Gmail/Drive), não SDK novo; zero escrita nas fontes; credencial só server-side; chc-verify: token fora do bundle client
[PRONTO QUANDO] sync real popula tasks das 3 fontes num teste + filtro LS captura evento de agenda de terceiro num caso de teste
[MODO] semi (gate antes da 1ª chamada que toca credencial)
```

### Ordem 3 — E3 · Entrada semi-manual (Notas + chats)

```
[AÇÃO] @dev *develop-yolo endpoint + parser que recebe texto colado (Notas iPhone / export de chat Claude) e normaliza para tasks/projects; parsing estrutural primeiro, LLM só no resíduo de texto livre
[ONDE] packages/lifeboard/src/adapters/manual
[RESTRIÇÃO] append-only (não sobrescreve o que veio das fontes API); LLM com saída estruturada por template + prompt caching; se normalização perde tarefa, cai pro parsing bruto
[PRONTO QUANDO] colar um bloco de Notas real gera as tarefas certas + diff LLM-vs-bruto = 0 tarefas perdidas
[MODO] autônomo
```

### Ordem 4 — E4 · Motor de priorização "hoje" (camada O — inalienável)

```
[AÇÃO] @dev *develop o serviço que roda HIERARQ (S1×S2×S3, desempate S1>S3>S2) sobre tasks, respeita dependências (não sugere tarefa com predecessor aberto) e devolve lista "hoje" ordenada + justificativa curta por item
[ONDE] packages/lifeboard/src/core/prioritize (marcar _core-inalienavel)
[RESTRIÇÃO] esta lógica é camada O do CHC: NUNCA vai pro bundle client, roda server-side; sem hardcode de dado pessoal
[PRONTO QUANDO] dado um grafo de teste, a lista "hoje" bate com o esperado e nenhuma tarefa bloqueada aparece como acionável
[MODO] passo-a-passo
```

### Ordem 5 — E5 · Dashboard ALMA PETRA

```
[AÇÃO] @ux-design-expert *create-front-end-spec com tokens ALMA PETRA (navy #0A1628, bone #F5F2EC, dourado fosco #A8895A, dark mode); depois @dev *develop-yolo o dashboard: grafo de dependências (DAG) + lista "hoje" + filtro por fonte
[ONDE] packages/lifeboard/src/app
[RESTRIÇÃO] só lê o modelo canônico (tasks já normalizada), nunca as fontes cruas; grafo servido de cache do dia (não recomputa por request)
[PRONTO QUANDO] dashboard renderiza grafo + "hoje" com dados reais das 3 fontes, na paleta ALMA PETRA
[MODO] autônomo
```

### Ordem 6 — Gate de qualidade + deploy Fase 1

```
[AÇÃO] @qa *gate (roda os 4 stress tests do PRD §11) → @qa *nfr-assess → @devops *pre-push → @devops *push → preview deploy → smoke → prod
[ONDE] packages/lifeboard/ + Vercel + Supabase
[RESTRIÇÃO] só @devops faz push (Art. II); chc-verify obrigatório antes do deploy (O/G fora do bundle); prod ≤ maxTierTested (1k tasks); health-check /api/health verde
[PRONTO QUANDO] DoD do PRD fechado: 4 stress verdes + chc-verify + merge + prod + health-check OK + rollback testado
[MODO] passo-a-passo
```

---

## FASE 2 — Automação viva (E6)

> Só inicia com Fase 1 verde em prod (dependência dura do PRD §8).

### Ordem 7 — E6 · Cron diário n8n

```
[AÇÃO] @dev *develop o workflow n8n que dispara 1×/dia, chama os adapters de E2, reescreve projects/tasks, loga em sync_log; @devops *add-mcp / gerencia o MCP n8n
[ONDE] n8n.lucasscudeler.com.br + packages/lifeboard/src/adapters
[RESTRIÇÃO] custo de infra > cap do budget.json → PARA; falha 2× → mantém último estado bom + alerta; Notas/chats seguem semi-manual (atalho iPhone→Drive opcional empurra Notas pra fonte Drive); não abrir porta pública
[PRONTO QUANDO] cron roda sozinho num ciclo real, dashboard reflete no load seguinte sem ação de Lucas, sync_log.ok=true
[MODO] semi (gate antes de subir o cron em prod)
```

### Ordem 8 — Fechamento Fase 2

```
[AÇÃO] @qa *review-build do fluxo automatizado → @devops *push → *release
[ONDE] packages/lifeboard/ + n8n
[RESTRIÇÃO] health-check inclui checagem de sync_log.ok do último ciclo; rollback = desligar workflow n8n volta ao dashboard estático da Fase 1
[PRONTO QUANDO] 3 ciclos diários consecutivos verdes + rollback testado (desligar n8n não quebra o dashboard)
[MODO] passo-a-passo
```

---

## Sequência recomendada de envio ao Claude Code

Ordem 0 → 1 → 2 → 3 → 4 → 5 → 6 (Fase 1 fecha e vai a prod) → **valida uso diário real por alguns dias** → 7 → 8 (Fase 2).

E3 pode rodar em paralelo a E2 (independentes, ambos só dependem de E1). E4 espera E2+E3. E5 espera E4.

**Gate de decisão entre fases (VERE/`!atom`):** subir a Fase 2 é Classe 1 (reversível — desligar n8n volta ao estado bom), então o próprio agente decide seguir se a Fase 1 provou uso diário. Custo de infra novo passa pelo kill-switch de budget (LV1 Dinheiro só trava acima de R$500).

---

*RUNBOOK OS-LIFEBOARD v1.0 — Lucas Scudeler — ALMA PETRA — Julho 2026 · formato Hermes 2.6 + star-commands AIOX-PRO v5.0.3 · NÃO-CANON (projeto pessoal).*
