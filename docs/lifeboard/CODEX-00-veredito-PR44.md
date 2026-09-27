# Tarefa 00 · veredito do PR #44 (P4, grafo) — 26/09/2026

> Revisor independente de contexto limpo (subagente Claude, Opus), sobre a cabeça `fd2b91bf` (= `b104d0a5` + `main`),
> em cópia separada. Portões na árvore limpa: tipos 0 erros · vitest **1560/1560** · contraste 70 pares ok, 6 cores de
> aresta batem · guarda `guarda-no-navegador.mjs` **verde** em 1440 e 390 (as outras 3 larguras não rodaram, por tempo).
> Nenhum commit, nenhum push, nada postado no GitHub. O vermelho do PR no GitHub é `Jest Tests (Node 24)` do núcleo,
> vermelho na `main` no mesmo momento — não é da P4.

## VEREDITO: reprovado — 0 CRÍTICO, 1 ALTO, 0 MÉDIO

## Sabotagens

| Sabotagem | No arquivo? | Portões de código | Guarda |
|---|---|---|---|
| **SX1** (piso) — a aresta destacada "gruda" ao escolher outro cartão | sim (linhas 1272/1319 → 0 ao desfazer) | tsc e testes verdes | **PEGOU** — 10 ✗ na §22 |
| **SN1** (nova) — "Ver tudo" não enquadra depois de um zoom (cache do último enquadramento em `useEnquadramentos`) | sim (`ultimoAplicado`, 3 ocorrências → 0) | verdes | **PEGOU** — 8 ✗, mas por efeito colateral (§22z, a conta do gesto de zoom), não por "Ver tudo não enquadrou": **forma viciada 3** |

Estrago medido da SN1: a 1280, "Ver tudo" dá 11/11 cartões inteiros; depois de 3 zooms e "Ver tudo", 0/11 (a 390, 2/11).
Árvore limpa: volta a 11/11.

## Achado

| # | Sev. | O defeito | Onde | Prova |
|---|---|---|---|---|
| 1 | **ALTO** | O traço triplo vermelho (caminho crítico) aparece numa ligação **com folga**: a regra marca a aresta como crítica quando as duas pontas estão no caminho crítico, sem conferir se a ligação é "justa" | `src/lib/camadas-do-grafo.ts:110`; a guarda repete a mesma regra em `scripts/guarda-no-navegador.mjs:962` e certifica o erro | A (2 d) → B (5 d) → C, com atalho A→C declarado: A→C tem 5 dias de folga e sai em traço triplo. Caso comum em dado real ("deploy depende do setup" junto com "depende do build"). A fixture não tem atalho, por isso não aparece na tela de exemplo |

Baixo (não conta): a 390 o aviso "2 tare…" sai cortado.

Visto sem defeito: direção das arestas, seleção que limpa, zoom que sobrevive a redimensionamento pequeno, `/api/grafo-bruto` exige login, sem texto sobreposto a 1280 e 390.

## Comentário `@codex` proposto (1 achado ALTO) — postar só com o "pode" do Lucas

**Thread 1 (ALTO)** — em `src/lib/camadas-do-grafo.ts:110`:

```
@codex corrija o achado desta thread: a aresta ganha o traço triplo (caminho crítico) sempre que as duas
pontas estão no caminho crítico, sem conferir se a ligação é justa. Prova: A (2 d) → B (5 d) → C com um
atalho A→C declarado — as três estão no caminho crítico, o atalho A→C tem 5 dias de folga e sai em traço
triplo. A guarda (scripts/guarda-no-navegador.mjs:962) recalcula com a mesma regra e certifica o erro.
Regras: (1) reproduza antes — teste unitário com esse grafo de 3 tarefas + atalho que falhe hoje, e a
guarda passando a ler as janelas (`janelas`, já calculadas no servidor) do dado bruto em vez de repetir a
regra; (2) corrija no menor escopo sobre o head atual desta branch: aresta crítica só quando o fim da origem
coincide com o início do destino; (3) rode tsc, vitest, contraste e a guarda; (4) commit em português e
publique como PR pela tarefa (o push direto não funciona no seu ambiente); (5) não mexa na main, não
aplique nada em produção.
```
