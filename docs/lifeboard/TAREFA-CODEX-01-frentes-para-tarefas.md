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
   - **sessão não encerrada** *(emenda 26/09: e com movimento nos últimos 21 dias, ver §Emenda)* → 1 tarefa · `external_ref = sessao_id` · título = `titulo` (ou `sessao_id` curto) ·
     notas = `precisa_de` / `estado_detalhe` · status pelo `estado` (`blocked`/`need_input` = esperando o Lucas).
   - **PR aberto** → 1 tarefa · `external_ref = repo#numero` · título = `titulo` · status por `checks` e `rascunho`.
   - **branch sem PR** → 1 tarefa · `external_ref = repo:branch` · ~~**só se** tiver `sessao_ids` **ou** commit nos
     últimos 30 dias~~ *(substituída em 26/09, ver §Emenda)* **só se** tiver PR aberto ou sessão viva ligada
     (senão os cartões afogam o grafo; a regra fica declarada em constante, com teste).
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

## Emenda de 26/09/2026 — regra de entrada medida em produção

O 1º deploy (PR #47) seguiu a regra acima ao pé da letra e o grafo recebeu ~530 cartões: 285 das 339 branches têm
`sessao_ids` (de sessões vivas **ou mortas**) e 210 sessões "não encerradas" dos últimos 90 dias. A regra passou a ser
(PR #49, `src/lib/frentes/materializar.ts`):

- [x] **sessão** entra se não está encerrada **e** se mexeu nos últimos `JANELA_SESSAO_DIAS = 21` dias (a mesma janela
      das colunas vivas do quadro Assuntos);
- [x] **branch** entra só com PR aberto **ou** sessão que entrou ligada a ela (`sessao_ids` de sessão morta e commit
      recente sozinho não contam mais);
- [x] testes em `tests/unit/frentes-materializar.test.ts` §(c): os 3 novos falham com a regra antiga.

Mesmo banco, regra nova: ~74 sessões, ~78 branches, 33 PRs. O teste (c) "branch velha sem sessão não aparece" continua
valendo e ficou mais forte.

**Arquivos da tarefa (01 + emenda):** `src/lib/frentes/materializar.ts` · `src/lib/frentes/no-grafo.ts` ·
`src/lib/repositories/factory.ts` · `src/lib/frentes/repository.ts` · `src/types/canonical.ts` ·
`supabase/migrations/0031_sources_kind_registra_github.sql` · `tests/unit/frentes-materializar.test.ts` ·
`tests/unit/frentes-no-grafo.test.ts`.

