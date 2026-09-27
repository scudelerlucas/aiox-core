# Tarefa 00 — relatório final (26/09/2026)

> Ordem do Lucas em 26/09: *"Faça a Tarefa 00 antes da 01, na ordem #45, #43, #44."* A Tarefa 01 já estava feita
> (PR #47, mergeado em 25/09 por uma sessão irmã). O Codex não é alcançável da sessão web, então cada PR recebeu um
> **revisor Claude de contexto limpo** (subagente novo, Opus), em cópia separada, sem commit, push ou comentário.
> Correção de achado CRÍTICO/ALTO segue a regra *Codex corrige, Claude valida* (24/09): comentário `@codex`, um por
> achado, **só depois do "pode" do Lucas**.

| PR | Peça | Veredito | Guarda na árvore limpa | Sabotagens (piso · nova) | Custo (tokens do revisor) | O que fica para o Lucas |
|---|---|---|---|---|---|---|
| [#45](https://github.com/scudelerlucas/aiox-core/pull/45) | P5 linha do tempo | **reprovado — 1 CRÍTICO, 1 ALTO, 1 MÉDIO** | verde (94 medidas) | RV1 "sai pela barra e volta": **não pegou** (formas viciadas 3 e 5) | ~264 mil | aprovar 2 comentários `@codex` (crítico + alto); médio → v2 |
| [#43](https://github.com/scudelerlucas/aiox-core/pull/43) | P6 página da tarefa | **reprovado — 0 CRÍTICO, 0 ALTO, 2 MÉDIO** = sem rodada | verde (173 medidas) | FT1 **pegou** · duração e relação no sucesso: **pegou** | ~291 mil | **mergear** com os 2 médios na v2 (recomendado) |
| [#44](https://github.com/scudelerlucas/aiox-core/pull/44) | P4 grafo | **reprovado — 0 CRÍTICO, 1 ALTO, 0 MÉDIO** | verde (1440 e 390) | SX1 **pegou** · SN1 "Ver tudo" pós-zoom: pegou por efeito colateral (forma 3) | ~273 mil | aprovar 1 comentário `@codex` (alto) |

Vereditos completos: `CODEX-00-veredito-PR45.md` · `CODEX-00-veredito-PR43.md` · `CODEX-00-veredito-PR44.md`.

## A resposta à pergunta do prompt original

**O Codex encurtou o caminho, ou o que faltava eram passos de painel do Lucas?** Os dois, em ordem: o passo de painel
(Vercel no banco certo + login Google, 24/09) foi o que destravou tudo; a Tarefa 01 saiu em 1 PR e 2 rodadas, feita pelo
Claude porque o Codex não alcança a sessão web; a Tarefa 00 provou em 3 revisões de uma rodada o que 17 a 24 rodadas
não tinham fechado: **duas guardas ainda medem o caso, não a classe** (#45 e, de leve, #44), e uma peça (#43) estava
pronta e ninguém tinha dito. O Codex entra agora, no lugar certo: **corrigir os 3 achados graves, um PR por achado**.

## Ordem sugerida

1. Mergear o **#43** (P6) — primeiro, porque `hooks-falsos.ts`/`arvore-react.ts` existem também no #45 e a versão do #43 deve vencer.
2. Postar os 2 comentários `@codex` no **#45** e o 1 no **#44**; publicar os PRs do Codex pelo painel dele; o Claude valida por fora, mescla e mergeia. **Sem segunda rodada:** reprovou de novo → mergear com pendências ou fechar.
3. `LINHA-DE-CHEGADA.md`: D7 fecha quando os três tiverem destino; itens v2 novos: MÉDIO 3 do #45 (o "Hoje" congelado), MÉDIOS 1 e 2 do #43, BAIXO do #44.
