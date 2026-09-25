# Tarefa Codex 01 — as frentes (GitHub + sessões) viram tarefas ligadas no grafo

> Decisão do Lucas, 25/09/2026: *"A primeira tarefa do Codex deve ser ligar o que já está no banco ao grafo
> (GitHub + sessões das contas). É o ganho mais rápido, não depende de nenhuma rotina nova e faz o grafo
> deixar de ter zero ligações."* Itens A1b + A1c da `packages/lifeboard/LINHA-DE-CHEGADA.md`.
> Roda no **iMac**, via `/codex:rescue`, com o Claude conferindo. **Um PR. No máximo 2 rodadas de revisão.**

## O que existe hoje (medido em 25/09 no banco `hciiilopyivjaekaxfqp`)

| Tabela | Linhas que interessam | Já traz a ligação? |
|---|---|---|
| `painel_frentes_prs` | **34** PRs abertos | **32** têm `sessao_ids` |
| `painel_frentes_branches` | **304** branches sem PR | **251** têm `sessao_ids` |
| `painel_frentes_sessoes` | **211** sessões não encerradas (4 contas) | **28** têm `branches` |
| `tasks` | 18 tarefas (agenda de 09/07) | **0** com `predecessor_ids`/`successor_ids` |

O LifeBoard já lê as três primeiras em `src/lib/frentes/repository.ts` (aba Assuntos) e já desenha o grafo a
partir de `tasks` (`src/components/graph/dependency-graph.tsx`). **Nada novo de fonte; é junção.**

## O que entregar

1. **Um materializador server-side** (`src/lib/frentes/materializar.ts` ou nome melhor, puro e testável) que, a
   partir de `DadosFrentes`, produz tarefas canônicas (`src/types/canonical.ts`) com estas regras:
   - **sessão não encerrada** → 1 tarefa · `external_ref = sessao_id` · título = `titulo` (ou `sessao_id` curto) ·
     notas = `precisa_de` / `estado_detalhe` · status pelo `estado` (`blocked`/`need_input` = esperando o Lucas).
   - **PR aberto** → 1 tarefa · `external_ref = repo#numero` · título = `titulo` · status por `checks` e `rascunho`.
   - **branch sem PR** → 1 tarefa · `external_ref = repo:branch` · **só se** tiver `sessao_ids` **ou** commit nos
     últimos 30 dias (senão 304 cartões afogam o grafo; a regra fica declarada em constante, com teste).
   - **Arestas, declaradas a partir do dado, não inferidas:** sessão → branch (`sessoes.branches` ∋ branch ou
     `branches.sessao_ids` ∋ sessão) · branch → PR (`prs.branch = branch` no mesmo repo) · sessão → PR
     (`prs.sessao_ids` ∋ sessão). Sentido: quem produziu vem antes.
   - Idempotente: rodar 2× não duplica (chave `(source_id, external_ref)` já é única no schema).
2. **Fontes** para essas tarefas: ler as migrations antes de mexer no `check` de `sources.kind` — em produção já
   existe `kind = 'lms'`, então a lista do `0001_init.sql` **já foi ampliada** em alguma migration posterior.
   Se faltar `github`, uma migration nova no repo (**não aplicar em produção**; aplicar é passo do Lucas).
3. **Onde roda:** no mesmo caminho que hoje carrega o grafo (`getTasksRepository`), unindo o que vem das
   frentes ao que está em `tasks` — sem cron novo, sem gravar de volta nas tabelas `painel_*` (são só leitura).
   Se o Codex preferir gravar em `tasks` via `lifeboard_load`/RPC, justificar no PR e manter idempotência.
4. **Testes** (vitest, em `tests/`): (a) fixture 1 sessão → 1 branch → 1 PR gera 3 tarefas e 2 arestas;
   (b) sessão encerrada e PR mergeado **não** aparecem; (c) branch velha sem sessão **não** aparece;
   (d) 2 execuções = mesmas tarefas; (e) ciclo impossível: o trigger `lifeboard_check_task_dag` continua
   rejeitando A→B→A (teste já existe em `tests/unit/dag.test.ts`, só não regredir).
   **Teste que falha antes e passa depois**: (a) é esse.
5. `tsc --noEmit` limpo · `vitest run` verde (hoje: 1488/1488) · `/api/health` continua `degraded`, não `down`.

## NÃO FAÇA

- Não tocar em Vercel, Supabase de produção, Google. Não aplicar migration. Não fazer push para a `main`.
- Não inferir dependência por texto/IA (PRD §5.3: declarada, não inferida). Só as três arestas acima.
- Não reescrever a aba Assuntos nem o grafo: o grafo já sabe desenhar `tasks` com arestas.
- Não somar as 304 branches sem filtro.
- Não abrir 3ª rodada de revisão: o que sobrar vira item da v2 na `LINHA-DE-CHEGADA.md`.

## PRONTO QUANDO

- PR aberto a partir da branch da sessão, testes (a)–(e) verdes, e o print do grafo em produção **depois do
  merge e da migration aplicada pelo Lucas** mostra ao menos 1 aresta sessão → branch → PR real.
