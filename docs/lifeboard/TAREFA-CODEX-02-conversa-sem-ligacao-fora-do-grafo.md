# Tarefa Codex 02 — conversa sem ligação sai do grafo (fica no quadro Assuntos)

> Decisão do Lucas, 26/09/2026 19:2x (São Paulo), opção **A**: depois do #49 o grafo ainda tem ~200 cartões; a
> próxima alavanca é a que o item 7 da `packages/lifeboard/LINHA-DE-CHEGADA.md` já nomeia — **esconder conversa que
> não tem ligação com nada**. Executa o **Codex** (regra `codex-corrige-claude-valida`: um PR publicado pela
> tarefa, base = a branch deste doc); o Claude valida por fora e mescla. **Um PR. No máximo 2 rodadas.**
> **Dono: Lucas** (publica o PR da tarefa pelo botão e mergeia o #51) · **data proposta: 28/09/2026 10h** (evento no
> calendário LS, lembretes e-mail 1 d + popup 1 d + popup 1 h — desvio declarado, o evento nasceu a ~38 h) · **quem
> cobra: Lucas** (executor é o operador). Registro: hub, `docs/audit/AGENDA-FALSIFICACAO.md`. Codex e Claude são
> ferramentas, não donos.

## O que foi medido (26/09 19:19 SP, banco `hciiilopyivjaekaxfqp`, sincronização das 18:08)

Rodei `materializarFrentes` (a função que está em produção desde o merge do #49) sobre exatamente o que
`src/lib/frentes/repository.ts` carrega: 32 mudanças abertas · 338 branches · 335 conversas dos últimos 90 dias.

| | Cartões |
|---|---|
| Antes do #49 (1º deploy) | ~530 |
| Hoje, com a regra do #49 | **183** = 74 conversas · 77 branches · 32 mudanças (+ 18 tarefas do dono em `tasks`) |
| Ligações | 92 |
| Conversas **sem nenhuma ligação** (grau 0 no grafo materializado) | **46 de 74** |
| Branches sem ligação | 0 (por construção: branch só entra ligada a algo) |
| Se a conversa solta sair | **137** cartões de frentes (~155 com as do dono) |

O item 7 estimava "43 das 74 têm ligação"; a medição de hoje dá 28 com ligação e 46 sem. Os dois números vêm do
mesmo banco em horas diferentes; vale o medido no dia da entrega, e o PR do Codex deve trazer o dele.

## A regra nova (uma frase)

**Conversa só vira cartão do grafo se está ligada a pelo menos uma branch ou mudança que também entrou.**
Conversa viva e solta continua existindo no quadro Assuntos (`compose.ts`, coluna do estado dela) **e em toda outra
tela que lê a lista de tarefas** (Hoje / `/api/today`, linha do tempo, prompts, página da tarefa) — o grafo é o lugar
das ligações, o quadro e as listas são o lugar da lista. Nada some do sistema; muda só onde aparece.

> **Emenda (26/09 20:2x, achado P1 da revisão automática do Codex no #51, correto):** a primeira versão desta página
> mandava remover a conversa dentro de `materializarFrentes`. Isso tiraria a conversa do `TasksRepository`
> compartilhado (`no-grafo.ts`), e com ela de Hoje, `/api/today`, linha do tempo, prompts e página da tarefa — o
> oposto do que a regra promete. **O filtro vive só no caminho do grafo.** `materializar.ts` e seus testes (a)–(e)
> **não mudam**.

Consequências que precisam continuar verdadeiras:
- branch continua entrando **só** ligada a mudança aberta ou conversa viva (regra do #49) — e a conversa que
  segura a branch, por definição, tem ligação, então fica;
- as arestas continuam declaradas a partir do dado (`sessoes.branches`, `branches.sessao_ids`, `prs.sessao_ids`,
  `prs.branch`), nunca inferidas por texto;
- `JANELA_SESSAO_DIAS` (21 dias) continua valendo **antes** desta regra: conversa velha nem chega a ser candidata.
- `getTasksRepository().listAll()` devolve **as mesmas tarefas de hoje**; `/api/today` e `/api/health` não mudam.

## O que entregar

1. **Uma função pura nova**, `src/lib/frentes/podar-soltas.ts` (ou nome melhor, no mesmo estilo de `materializar.ts`):
   `podarConversasSoltas(tasks, edges)` devolve as tarefas **sem** as conversas de grau zero (nenhuma aresta de
   origem nem de destino em `edges`). Conversa = tarefa cujo `externalRef` é um `sessao_id` (a mesma chave que
   `materializar.ts` usa; exportar o predicado de lá se ajudar, sem mudar comportamento). Branch, mudança e tarefa do
   dono (`tasks` do banco) **nunca** são podadas. Constante declarada e comentada com a medição desta página.
2. **Aplicada só onde o grafo nasce**: em `src/app/page.tsx`, o que vai para `DashboardClient` como `tasks` (a prop
   documentada como *"Universo de tarefas (grafo)"*) e para `caminhoCritico`/`scoreAssimetriaLote`/`serializaGrafoV3`
   passa a ser a lista podada. **`hoje = buildTodayList(tasks)` continua com a lista inteira.** Se `DashboardClient`
   usar a prop `tasks` para algo além do grafo (conferir `dashboard-client.tsx` antes), separar em duas props em vez
   de podar a lista inteira. `materializar.ts`, `no-grafo.ts`, `compose.ts`, `/api/today`, linha do tempo, prompts e
   página da tarefa: **intocados**.
3. **Testes** (vitest): arquivo novo `tests/unit/frentes-podar-soltas.test.ts`:
   - conversa viva sem aresta → **sai** (**é o teste que falha antes e passa depois**: sem a função, a lista volta
     igual);
   - conversa com aresta para branch ou para mudança → fica, e a aresta continua válida (as duas pontas existem);
   - branch, mudança e tarefa do dono sem aresta → **ficam** (a poda é só de conversa);
   - `tests/unit/frentes-materializar.test.ts` (a)–(e): **sem alteração nenhuma** (nem de expectativa) — se algum
     ficar vermelho, a poda vazou para o lugar errado.
4. `LINHA-DE-CHEGADA.md`, item 7: acrescentar a linha da medição do PR (cartões do grafo antes → depois, no banco de
   produção, só leitura) e marcar `[x]` nos critérios abaixo que a entrega cumprir.
5. Checagens do repo, em `packages/lifeboard`: `npx tsc --noEmit` · `npx vitest run` (hoje 1536/1536) ·
   `npm run contraste` · eslint nos arquivos tocados.

## Critérios de aceite (checklist da story — o PR do Codex marca o que cumpriu)

- [ ] conversa viva sem aresta não aparece no grafo (teste vermelho antes, verde depois)
- [ ] conversa com aresta para branch ou mudança continua no grafo, com a aresta
- [ ] branch, mudança e tarefa do dono nunca são podadas
- [ ] `getTasksRepository().listAll()`, `/api/today`, `/api/health`, linha do tempo, prompts e página da tarefa
      continuam mostrando a conversa solta (nada muda fora do grafo)
- [ ] `frentes-materializar.test.ts` (a)–(e) intactos e verdes
- [ ] item 7 da linha de chegada com a medição antes → depois
- [ ] `tsc` · `vitest` · `contraste` · eslint verdes

## Lista de arquivos (File List — o PR do Codex a mantém)

| Arquivo | O quê |
|---|---|
| `packages/lifeboard/src/lib/frentes/podar-soltas.ts` | **novo** — a função pura e a constante comentada |
| `packages/lifeboard/src/app/page.tsx` | aplica a poda só ao que alimenta o grafo |
| `packages/lifeboard/src/components/dashboard/dashboard-client.tsx` | só se a prop `tasks` precisar virar duas |
| `packages/lifeboard/tests/unit/frentes-podar-soltas.test.ts` | **novo** — os testes do item 3 |
| `packages/lifeboard/LINHA-DE-CHEGADA.md` | item 7, medição antes → depois |
| `docs/lifeboard/TAREFA-CODEX-02-conversa-sem-ligacao-fora-do-grafo.md` | esta página (checklist marcado) |

## Como a entrega é validada por fora (Claude)

Merge local do PR do Codex com a base · as quatro checagens · o teste da poda rodado sem a função aplicada
(tem que ficar vermelho) · `frentes-materializar.test.ts` idêntico ao da base (`git diff` vazio) · a mesma medição desta página refeita sobre o head do Codex (esperado ≈ 137 cartões de
frentes com o dado de 26/09; o número do dia pode variar com a sincronização). Verde → merge commit na branch deste
doc, thread resolvida com o resultado escrito; o operador mergeia na `main`.

## Não faça

- Não mexer na regra de branch (#49) nem em `JANELA_SESSAO_DIAS`.
- Não tocar em `materializar.ts`, `no-grafo.ts`, `compose.ts`/quadro Assuntos nem nos testes (a)–(e): a conversa
  solta continua em toda lista; só o grafo a esconde.
- Não inferir ligação por texto (título, mensagem de commit).
- Não aplicar nada em produção; não empurrar na `main`; não fazer rebase/força na branch base.
