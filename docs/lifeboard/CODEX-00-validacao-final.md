# Tarefa 00 · validação final das correções do Codex (27/09/2026)

> Regra *Codex corrige, Claude valida* (24/09). Os três achados graves da Tarefa 00 receberam comentário `@codex`
> em 26/09; o Lucas publicou os três PRs do Codex em 27/09 12:10–12:13 (SP) e os mergeou nas branches de origem
> (`…-p5` e `…-p4`), que já tinham entrado na `main` (#45 às 11:38, #44 às 11:51). Por isso as correções **não
> estavam na `main`**: este documento registra a validação por fora e o PR que as leva para lá.

## Os três PRs do Codex

| PR do Codex | Achado que corrige | O que muda (líquido sobre a `main`) |
|---|---|---|
| [#54](https://github.com/scudelerlucas/aiox-core/pull/54) | #45 CRÍTICO — a guarda P5 não media "sai pela barra e volta" | `guarda-p5.mjs`: medida nova `R-rota` (barra do app, voltar, avançar, em 1280 e 390); 76 linhas |
| [#55](https://github.com/scudelerlucas/aiox-core/pull/55) | #45 ALTO — rótulo fora da janela cortado no celular, ano invisível | texto visível vira `ini.`/`fim` + data com ano; período por extenso fica no `aria-label`/`title`/gaveta; a guarda mede a largura real do texto; 5 arquivos |
| [#56](https://github.com/scudelerlucas/aiox-core/pull/56) | #44 ALTO — traço triplo em ligação com folga | `camadas-do-grafo.ts`: aresta crítica só quando `ef(origem) = es(destino)` (janelas do CPM); `/api/grafo-bruto` devolve `janelas`; a guarda P4 lê as janelas em vez de repetir a regra; teste novo; 8 arquivos |

O commit do #56 chegou como um só commit de 78 arquivos (o Codex resolveu o conflito copiando a `main` por cima);
o **líquido** sobre a `main` de hoje é o da tabela: 13 arquivos, +193/−37 nos três juntos.

## Portões de código (árvore `main` e22ad5b8 + os três)

| Portão | Resultado |
|---|---|
| Conflito com a `main` | nenhum, nos três |
| `tsc --noEmit` | 0 erros |
| `vitest run` | **1851/1851** (99 arquivos) |
| `checar-contraste.mjs` | 87 pares ok · 6 cores de aresta batem |
| Teste que falha antes e passa depois — #56 | `camadas-do-grafo.test.ts` "não marca como crítica uma ligação com folga": **1 falha** com o `src` da `main`, 12/12 com a correção |
| Teste que falha antes e passa depois — #55 | `linha-do-tempo-palavras.test.ts` "texto VISÍVEL … com ANO": **1 falha** com o `src` da `main`, 25/25 com a correção |
| #54 | é medida de guarda, não teste unitário; `R-rota` rodou verde em 1280 e 390 (55/55 controles alcançados por Tab depois de cada remontagem) |

## Guardas no Chromium — quatro corridas, para separar o que é do Codex do que é da `main`

| Corrida | Guarda P5 | Guarda P4 |
|---|---|---|
| `main` + Codex, junção das frentes ligada (padrão) | 21 falhas (`Q`: "a coluna tem 46 rótulos, a fixture desenha 27") | 41 falhas (`sinergia` não pinta, teto do zoom 1,69 em vez de 1,8, traços fora do canvas a 390) |
| `main` pura, junção ligada | **as mesmas 21** | **as mesmas 41** (listas normalizadas idênticas) |
| `main` + Codex, junção desligada (`LIFEBOARD_FRENTES_NO_GRAFO=off`) | 1 falha (`T` a 390: Auto e Trimestre na mesma escala) | 1 falha (rótulo de `sinergia` sobre o traço `task-setup→task-build` a 390, com o aviso de fontes) |
| `main` pura, junção desligada | **a mesma 1** | **a mesma 1** |

**Leitura:** os PRs do Codex não acrescentam nenhum vermelho em nenhuma das quatro configurações. Os vermelhos são da
`main` de hoje e nascem da junção das frentes (#47, 25/09), que mudou a demonstração de 27 para 46 linhas sem que as
guardas P4 e P5 fossem reescritas — a mesma classe do vermelho da P6 que o #53 fechou. As guardas P4 e P5 **não rodam
na CI** (só a P6), por isso ninguém viu.

## Veredito

**Aprovado.** As três correções entram na `main` por um PR único, sem segunda rodada (regra da Tarefa 00).
O que sobra tem dono na `LINHA-DE-CHEGADA.md`: reescrever as guardas P4 e P5 para a demonstração com frentes
(Tarefa Codex 03, a escrever) e decidir se elas entram na CI.

## Nota de leitura (não bloqueia)

O #55 troca "começa"/"concluída" por `ini.`/`fim` no rótulo visível do celular. Cabe e resolve o corte, mas `ini.` é
abreviação que o operador não usa; se incomodar na tela, é ajuste de texto de uma linha (`fora-da-janela-em-palavras.ts`).
