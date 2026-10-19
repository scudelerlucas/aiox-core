# Tarefa Codex 04 — branch com mudança aberta não ganha cartão próprio no grafo: a mudança a representa

> Decisão do Lucas, 02/10/2026 18:4x (São Paulo), **2-A**: depois da Tarefa 02 o grafo ainda tem ~345 cartões de frentes,
> e 84 deles repetem trabalho — a branch e a mudança aberta dela aparecem como dois cartões. Executa o **Codex** (regra
> `codex-corrige-claude-valida`: um PR publicado pela tarefa, base = a branch deste doc); o Claude valida por fora e
> mescla. **Um PR. No máximo 2 rodadas de revisão.**
>
> | Executa (pessoa) | Data | Quem cobra |
> |---|---|---|
> | **Lucas** — publica o PR da tarefa pelo botão do Codex e mergeia o PR deste doc na `main` depois da validação. Codex e Claude são ferramentas, não donos. | **06/10/2026, 10h** (data proposta; evento no calendário LS com e-mail e aviso 1 dia antes e aviso 1 h antes — desvio declarado do aviso de 7 dias, o prazo nasce a ~3,6 dias) | **Lucas** |

## O que foi medido (01/10/2026 13:01 SP, banco `hciiilopyivjaekaxfqp`, só leitura, código da Tarefa 02)

| | Cartões de frentes no grafo |
|---|---|
| Antes da Tarefa 02 | 362 = 75 conversas · 201 branches · 86 mudanças abertas (250 ligações) |
| Depois da Tarefa 02 (17 conversas soltas saem) | 345 |
| Branches cuja `repo:branch` é a branch de uma mudança aberta | **84 de 201** (182 das 201 são do hub) |
| Esperado depois desta tarefa | ~260 (o número do dia pode variar; o PR traz o dele) |

## A regra nova (uma frase)

**No grafo, a branch que tem exatamente uma mudança aberta materializada não ganha cartão próprio: suas ligações passam
para o cartão da mudança.** Fora do grafo nada muda: Hoje (`/api/today`), linha do tempo, prompts, página da tarefa e o
quadro Assuntos continuam vendo a branch, porque leem `getTasksRepository().listAll()`, que **não muda**.

Consequências que precisam continuar verdadeiras:
- **Religar, nunca soltar.** Hoje a ligação vai conversa → branch → mudança. Tirar a branch sem religar deixaria a
  conversa de grau zero, e a poda da Tarefa 02 a tiraria do grafo. A ligação que chegava na branch passa a chegar na
  mudança (conversa → mudança), e a aresta branch → mudança some (vira laço e é descartada).
- **Só branch com exatamente UMA mudança aberta.** Branch com duas ou mais mudanças abertas é um ponto real de
  bifurcação e fica como cartão. Branch com mudança só fechada/mergeada fica.
- **Só o que foi materializado agora.** Branch ou mudança que veio do banco (linha de `tasks`, chave casada na união) não
  entra na colagem, nem como origem nem como destino.
- A regra de entrada da branch (#49) e `JANELA_SESSAO_DIAS` não mudam; a poda da Tarefa 02 continua, e roda **depois**
  desta colagem.

## O que entregar

1. **Proveniência, aditiva.** `materializarFrentes` já sabe quais branches têm mudança aberta (`prsPorRepoBranch`): o
   retorno `Materializacao` ganha **um campo aditivo**, `branchParaMudanca: Map<string, string>` (id da tarefa da branch →
   id da tarefa da mudança), preenchido **só** quando a branch tem **exatamente uma** mudança aberta materializada. Nada
   mais muda nesse arquivo; os testes (a)–(e) de `frentes-materializar.test.ts` ficam intactos.
2. **A união carrega a proveniência pela chave, nunca pelo id.** `unirFrentesAoGrafo` guarda em
   `GrafoUnido.branchesColadas: Map<string, string>` só os pares em que **as duas pontas** foram materializadas e **não**
   casaram com linha do banco pela chave `(sourceId, externalRef)` — o mesmo critério de `conversasMaterializadas`,
   inclusive a guarda de id já ocupado por `base.tasks`. O repositório da união expõe `listBranchesColadas():
   Promise<Map<string, string>>`, método **opcional** em `TasksRepository` (a fixture devolve mapa vazio).
3. **A colagem vive na conta única do grafo.** Função pura nova `colarBranchesNaMudanca(tasks, edges, branchesColadas)`
   em `src/lib/frentes/colar-branches.ts`: devolve `{ tasks, edges }` em que (i) a branch colada sai da lista, (ii) toda
   aresta que tocava a branch é redirecionada para a mudança, (iii) aresta que vira laço (origem = destino) sai, (iv)
   aresta duplicada `(origem, destino, tipo)` sai, ficando a primeira, e (v) `predecessorIds`/`successorIds` são **preservados e remapeados**, nunca reconstruídos só das arestas: em cada lista, o id de uma branch colada vira o id da mudança dela, o próprio id da tarefa sai (laço), o que não está mais no grafo sai, e repetição sai — **todo o resto da lista fica**. As listas são uma das três fontes do caminho crítico (`caminho-critico.ts` §2: listas ∪ arestas `predecessor`), e muita precedência das tarefas do dono vive **só** nelas. **Com o mapa de colagem vazio, a saída é idêntica à entrada** (mesmas tarefas, mesmas listas, mesmas arestas). *(v5.1, 02/10, achado da validação por fora: a 1ª entrega reconstruía as listas só das arestas e, com o mapa vazio, a demonstração perdia 7 elos — caminho crítico de preparar → construir → publicar, 4 dias, para publicar → revisar, 2 dias.)*
   `montarGrafoDoDia(tasks, edges, proveniencia)` passa a receber `proveniencia: { conversasMaterializadas, branchesColadas }`
   (**obrigatório**; mapas/conjuntos vazios explícitos = nada muda) e faz, nesta ordem: **colagem → poda das conversas
   soltas → goal → caminho crítico → scores → serialização**, devolvendo também `edgesDoGrafo`.
4. **Os dois chamadores, do mesmo jeito.** `src/app/page.tsx` e `src/app/api/grafo-bruto/route.ts` leem
   `listBranchesColadas()` e passam a proveniência inteira a `montarGrafoDoDia`. A rota serializa `tarefas` de
   `tasksDoGrafo` **e `arestas` de `edgesDoGrafo`** (hoje serializa `edges` cru — depois da colagem isso divergiria do
   canvas e a guarda P4 acusaria). `buildTodayList(tasks)` continua com a lista inteira.
5. **Testes** (vitest):
   - `tests/unit/frentes-colar-branches.test.ts` (**novo**): conversa → branch → mudança vira conversa → mudança, com a
     branch fora (**o teste que falha antes**) · branch com duas mudanças abertas fica · branch com mudança só mergeada
     fica · branch do banco (chave casada) fica · mudança do banco (chave casada) não recebe colagem · laço e duplicata
     somem · `predecessorIds`/`successorIds` sem id de branch colada · a conversa que só se ligava pela branch **não**
     é podada depois (colagem antes da poda);
   - `materializar`: o campo `branchParaMudanca` coberto num teste **novo** (fixture conversa → branch → 1 mudança aberta
     devolve o par; com 2 mudanças abertas devolve vazio);
   - `tests/unit/frentes-no-grafo.test.ts`: os três casos de colisão da Tarefa 02 repetidos para `branchesColadas`
     (chave igual com id diferente · chave igual com o mesmo UUID · id igual com chave diferente) — o par sai da proveniência;
   - `tests/unit/grafo-do-dia-poda.test.ts`: a ordem colagem → poda, e o CPM calculado sobre `tasksDoGrafo`/`edgesDoGrafo`;
     a **guarda de fiação** passa a exigir, na página e na rota, `listBranchesColadas()` chegando a `montarGrafoDoDia`, e na
     rota `arestas` a partir de `edgesDoGrafo`;
   - `frentes-materializar.test.ts` (a)–(e): **sem alteração** (`git diff` vazio).
6. `LINHA-DE-CHEGADA.md`, item 7: a medição antes → depois no banco de produção (só leitura), com o código desta entrega.
7. Checagens em `packages/lifeboard`: `npx tsc --noEmit` · `npx vitest run` · `npm run contraste` · eslint nos arquivos
   tocados · `npm run build`. Na raiz: `npm run lint` · `npm run typecheck` · `npm test` (falha fora do Lifeboard só conta
   se não reproduzir na base). Guarda P4 (`npm run guarda:grafo`, junção ligada) se o ambiente tiver Chromium; se não
   tiver, dizer no PR — o Claude roda por fora.

## Critérios de aceite (o PR do Codex marca o que cumpriu)

- [x] branch com exatamente uma mudança aberta materializada não aparece no grafo; a mudança herda as ligações (teste vermelho antes)
- [x] conversa que só se ligava pela branch continua no grafo, ligada à mudança
- [x] branch com 2+ mudanças abertas, branch com mudança só fechada e qualquer linha do banco nunca são coladas
- [x] proveniência decidida pela chave, com os três casos de colisão provados pela união
- [x] sem laço, sem aresta duplicada, e `predecessorIds`/`successorIds` coerentes com `edgesDoGrafo`
- [x] ordem colagem → poda → CPM, dentro de `montarGrafoDoDia`; página e rota publicam `tasksDoGrafo` e `edgesDoGrafo`
- [x] guarda de fiação cobre `listBranchesColadas()` nos dois chamadores e `arestas` da rota
- [x] `listAll()`, `/api/today`, linha do tempo, prompts, página da tarefa e Assuntos continuam vendo a branch
- [x] `frentes-materializar.test.ts` (a)–(e) intactos
- [x] item 7 com a medição antes → depois
- [x] pacote verde (tsc · vitest · contraste · eslint · build) e raiz verde (ou falha fora do Lifeboard reproduzida na base)

## Lista de arquivos (o PR do Codex a mantém)

| Arquivo | O quê |
|---|---|
| `packages/lifeboard/src/lib/frentes/materializar.ts` | **só aditivo**: `branchParaMudanca` em `Materializacao` |
| `packages/lifeboard/src/lib/frentes/no-grafo.ts` | só a proveniência: `branchesColadas` + `listBranchesColadas()` |
| `packages/lifeboard/src/lib/repositories/tasks.fixture.ts` | método opcional `listBranchesColadas?()`; fixture devolve mapa vazio |
| `packages/lifeboard/src/lib/frentes/colar-branches.ts` | **novo** — a colagem pura |
| `packages/lifeboard/src/core/prioritize/grafo-do-dia.ts` | proveniência como objeto; colagem → poda → CPM; devolve `edgesDoGrafo` |
| `packages/lifeboard/src/app/page.tsx` · `src/app/api/grafo-bruto/route.ts` | leem `listBranchesColadas()`; a rota serializa `edgesDoGrafo` |
| `packages/lifeboard/tests/unit/frentes-colar-branches.test.ts` | **novo** |
| `packages/lifeboard/tests/unit/frentes-no-grafo.test.ts` · `grafo-do-dia-poda.test.ts` | casos novos e fiação |
| `packages/lifeboard/LINHA-DE-CHEGADA.md` | item 7, medição |
| `docs/lifeboard/TAREFA-CODEX-04-branch-com-mudanca-aberta-vira-a-mudanca.md` | esta página (checklist marcado) |

## Como a entrega é validada por fora (Claude)

Os portões do pacote e o build numa cópia do commit · `frentes-materializar.test.ts` com `git diff` vazio · sabotagens,
uma de cada vez, cada uma pega pelo teste certo: colagem vira no-op; colagem sem religar (só apaga a branch); colagem
depois da poda; laço não removido; listas de vizinhos não recalculadas; união decidindo por id; página com mapa vazio
no lugar de `listBranchesColadas()`; rota serializando `edges` cru · guarda P4 no Chromium, head × base, **numa cópia que
ninguém toca durante a corrida** (o `next dev` recarrega a página a cada arquivo mexido): rota e canvas batem, nenhuma
falha nova · a medição de produção refeita sobre o head.

## Não faça

- Não mudar a regra de entrada de branch (#49), `JANELA_SESSAO_DIAS`, a poda da Tarefa 02, `compose.ts` nem o quadro Assuntos.
- Não colar fora do grafo: `listAll()` devolve as mesmas tarefas de hoje.
- Não decidir "é branch" ou "é mudança" pelo texto do `externalRef`: quem diz é a proveniência.
- Não criar segunda conta do grafo: página e rota saem de `montarGrafoDoDia`.
- Não aplicar nada em produção; não empurrar na `main`.

## Prompt para colar no painel do Codex (se o comentário `@codex` no PR não disparar a tarefa)

```
Execute a tarefa descrita em docs/lifeboard/TAREFA-CODEX-04-branch-com-mudanca-aberta-vira-a-mudanca.md, no
repositório scudelerlucas/aiox-core, a partir da branch claude/happy-cerf-9fz8uk. Leia o arquivo inteiro antes de
começar. Regras: reproduza antes (teste vermelho sem a colagem); colagem antes da poda; proveniência pela chave;
a rota serializa tarefas e arestas do grafo colado; rode tsc, vitest, contraste, eslint, build e os gates da raiz;
commit em português; publique como PR pela tarefa com base = claude/happy-cerf-9fz8uk. Não mexa na main, não
aplique nada em produção.
```
