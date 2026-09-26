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

> **v3 (26/09 20:2x — três achados da 2ª revisão automática do Codex, aceitos):** a poda precisa de **proveniência**
> (uma linha do banco pode ter `externalRef = sessao_id` e nunca pode ser podada), a projeção do grafo vira uma
> função **testável** (senão `page.tsx` pode esquecer de usá-la e tudo fica verde), e o **build** entra nos gates.
> **v4 (20:3x — 3ª revisão, três achados aceitos):** a proveniência já diz *quem é conversa*, então a poda **não precisa
> de predicado nenhum** (e `materializar.ts` só ganha um campo aditivo, sem mudar testes); a guarda de fiação também
> confere que a proveniência chega à projeção; e os **gates da raiz** (`npm run lint` · `npm run typecheck` · `npm test`)
> entram, com a régua de comparação contra a base.

1. **Proveniência, sem mudar `listAll()` nem o tipo `Task`.** `materializarFrentes` já sabe quais tarefas são
   conversa (`idDaSessao`): o retorno `Materializacao` ganha **um campo aditivo**, `idsDeConversa: Set<string>` —
   nada mais muda nesse arquivo, e os testes (a)–(e) continuam intactos. `unirFrentesAoGrafo` (`no-grafo.ts`)
   remapeia esse conjunto por `mapaId` e guarda só o que **não** foi substituído pela linha do banco
   (`mapaId.get(id) === id`) em `GrafoUnido.conversasMaterializadas: Set<string>`; o repositório da união expõe
   `listConversasMaterializadas(): Promise<Set<string>>` — método **opcional** em `TasksRepository`
   (`tasks.fixture.ts`; a fixture devolve conjunto vazio). A união em si, as arestas e o remapeamento **não mudam**.
2. **A função pura da poda**, `src/lib/frentes/podar-soltas.ts`:
   `podarConversasSoltas(tasks, edges, conversasMaterializadas)` devolve as tarefas **sem** as que são, ao mesmo
   tempo, (i) conversa materializada (id ∈ `conversasMaterializadas` — a proveniência já diz o que é conversa, **sem
   predicado por `externalRef`**) e (ii) de grau zero em `edges`. **Linha do banco nunca é podada, por construção**
   — ela não está no conjunto; branch e mudança materializadas também não. Constante declarada e comentada com a
   medição desta página.
3. **A projeção do grafo vira função**, `src/lib/frentes/grafo-da-home.ts`: `montarGrafoDaHome({ tasks, edges,
   conversasMaterializadas })` faz, nesta ordem, a poda → o `goalId` (mesma regra determinística de hoje) → `caminhoCritico`
   → `scoreAssimetriaLote` → `serializaGrafoV3`, e devolve `{ tasksDoGrafo, grafoV3 }`. `src/app/page.tsx` passa a
   chamar só ela para o que vai ao `DashboardClient` como `tasks` e `grafoV3`. **`hoje = buildTodayList(tasks)`
   continua com a lista inteira.** `materializar.ts`, `compose.ts`, `/api/today`, `/api/health`, linha do tempo,
   prompts e página da tarefa: **intocados**.
4. **Testes** (vitest):
   - `tests/unit/frentes-podar-soltas.test.ts`: conversa materializada sem aresta → **sai** (**o teste que falha
     antes e passa depois**: sem a função, a lista volta igual) · conversa com aresta para branch ou mudança → fica,
     e a aresta continua válida · branch e mudança materializadas sem aresta → ficam · **tarefa do banco com
     `externalRef` de sessão e grau zero → fica** (não está em `conversasMaterializadas`) · conjunto vazio → nada
     muda;
   - em `frentes-materializar.test.ts` **nada muda**; o campo novo `idsDeConversa` é coberto num teste **novo** em
     `frentes-podar-soltas.test.ts` (fixture 1 conversa → 1 branch → 1 mudança devolve exatamente o id da conversa);
   - `tests/unit/frentes-grafo-da-home.test.ts`: a projeção devolve `tasksDoGrafo` sem a conversa solta, e o
     `grafoV3` (caminho crítico e scores) é calculado **sobre a lista podada**, não sobre a inteira;
   - **guarda de fiação** no mesmo arquivo (no estilo de `tarefa-escritas-varredura.test.ts`): lê
     `src/app/page.tsx` como texto e exige (1) que `DashboardClient` receba `tasks={tasksDoGrafo}` e `grafoV3`
     **vindos de `montarGrafoDaHome`**, (2) que `buildTodayList` receba a lista inteira e (3) que a página chame
     `listConversasMaterializadas()` do repositório e passe o resultado a `montarGrafoDaHome` como
     `conversasMaterializadas` — conjunto vazio ou fixo no lugar dele fica vermelho com o nome do arquivo;
   - `tests/unit/frentes-materializar.test.ts` (a)–(e): **sem alteração nenhuma** (`git diff` vazio).
5. `LINHA-DE-CHEGADA.md`, item 7: acrescentar a linha da medição do PR (cartões do grafo antes → depois, no banco de
   produção, só leitura) e marcar `[x]` nos critérios abaixo que a entrega cumprir.
6. Checagens do pacote, em `packages/lifeboard`: `npx tsc --noEmit` · `npx vitest run` (hoje 1536/1536) ·
   `npm run contraste` · eslint nos arquivos tocados · **`npm run build`** (é `next build`; erro de fronteira
   servidor/cliente ou de rota passa pelos quatro anteriores e derruba o deploy).
7. **Gates da raiz** (`AGENTS.md` §Quality Gates), na raiz do repositório: `npm run lint` · `npm run typecheck` ·
   `npm test`. Régua: falha em suíte **fora** do Lifeboard só conta contra este PR se **não** reproduzir na branch
   base no mesmo ambiente (comparar antes de atribuir); o árbitro final é a CI do GitHub sobre o head do PR.
   Warnings preexistentes do lint não bloqueiam; erro novo bloqueia.

## Critérios de aceite (checklist da story — o PR do Codex marca o que cumpriu)

- [ ] conversa materializada sem aresta não aparece no grafo (teste vermelho antes, verde depois)
- [ ] conversa com aresta para branch ou mudança continua no grafo, com a aresta
- [ ] branch e mudança materializadas nunca são podadas
- [ ] **linha do banco nunca é podada**, mesmo com `externalRef` de sessão e grau zero (proveniência)
- [ ] o caminho crítico e os scores do `grafoV3` são calculados sobre a lista podada
- [ ] guarda de fiação: `page.tsx` passa ao grafo só o que sai de `montarGrafoDaHome`, a lista inteira a `buildTodayList`,
      e `listConversasMaterializadas()` chega à projeção como `conversasMaterializadas`
- [ ] `getTasksRepository().listAll()`, `/api/today`, `/api/health`, linha do tempo, prompts e página da tarefa
      continuam mostrando a conversa solta (nada muda fora do grafo)
- [ ] `frentes-materializar.test.ts` (a)–(e) intactos e verdes
- [ ] item 7 da linha de chegada com a medição antes → depois
- [ ] pacote: `tsc` · `vitest` · `contraste` · eslint · **`npm run build`** verdes
- [ ] raiz: `npm run lint` · `npm run typecheck` · `npm test` verdes (ou falha fora do Lifeboard reproduzida na base, escrita no PR)

## Lista de arquivos (File List — o PR do Codex a mantém)

| Arquivo | O quê |
|---|---|
| `packages/lifeboard/src/lib/frentes/materializar.ts` | **só aditivo**: campo `idsDeConversa` em `Materializacao` (vem de `idDaSessao`); nenhuma regra, teste ou expectativa muda |
| `packages/lifeboard/src/lib/frentes/no-grafo.ts` | só a proveniência: `conversasMaterializadas` em `GrafoUnido` + `listConversasMaterializadas()` no repositório da união |
| `packages/lifeboard/src/lib/repositories/tasks.fixture.ts` | método opcional `listConversasMaterializadas?()` na interface; fixture devolve conjunto vazio |
| `packages/lifeboard/src/lib/frentes/podar-soltas.ts` | **novo** — a função pura da poda e a constante comentada |
| `packages/lifeboard/src/lib/frentes/grafo-da-home.ts` | **novo** — a projeção do grafo (poda → goal → CPM → scores → v3) |
| `packages/lifeboard/src/app/page.tsx` | chama `montarGrafoDaHome`; `buildTodayList` segue com a lista inteira |
| `packages/lifeboard/tests/unit/frentes-podar-soltas.test.ts` | **novo** — testes do item 4, 1º bloco |
| `packages/lifeboard/tests/unit/frentes-grafo-da-home.test.ts` | **novo** — projeção + guarda de fiação |
| `packages/lifeboard/LINHA-DE-CHEGADA.md` | item 7, medição antes → depois |
| `docs/lifeboard/TAREFA-CODEX-02-conversa-sem-ligacao-fora-do-grafo.md` | esta página (checklist marcado) |

## Como a entrega é validada por fora (Claude)

Merge local do PR do Codex com a base · as cinco checagens do pacote (tsc, vitest, contraste, eslint, **build**) · os três
gates da raiz (lint, typecheck, `npm test`; falha fora do Lifeboard comparada com a base) · o teste da poda rodado sem a
função aplicada (tem que ficar vermelho) · o teste da linha do banco com `externalRef` de sessão (tem que ficar) · a guarda
de fiação com `page.tsx` sabotado duas vezes — passando `tasks` cru ao grafo, e passando `new Set()` no lugar de
`listConversasMaterializadas()` (as duas têm que ficar vermelhas) · `frentes-materializar.test.ts` idêntico ao da base
(`git diff` vazio) · a mesma medição desta página refeita sobre o head do Codex (esperado ≈ 137 cartões de
frentes com o dado de 26/09; o número do dia pode variar com a sincronização). Verde → merge commit na branch deste
doc, thread resolvida com o resultado escrito; o operador mergeia na `main`.

## Não faça

- Não mexer na regra de branch (#49) nem em `JANELA_SESSAO_DIAS`.
- Não mudar regra nenhuma em `materializar.ts` (só o campo aditivo `idsDeConversa`), nem `compose.ts`/quadro Assuntos,
  nem os testes (a)–(e): a conversa solta continua em toda lista; só o grafo a esconde. Em `no-grafo.ts`, só a
  proveniência — a união, as arestas e o remapeamento ficam.
- Não decidir "é conversa" pelo `externalRef` em lugar nenhum da poda: quem diz é a proveniência; sem ela, uma linha do
  banco seria podada.
- Não inferir ligação por texto (título, mensagem de commit).
- Não aplicar nada em produção; não empurrar na `main`; não fazer rebase/força na branch base.
