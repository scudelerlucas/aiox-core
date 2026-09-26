# Tarefa 00 · veredito do PR #43 (P6, página da tarefa) — 26/09/2026

> Revisor independente de contexto limpo (subagente Claude, Opus), sobre a cabeça `46f3595a`, em cópia separada.
> Portões na árvore limpa: tipos 0 erros · vitest **1665/1665** · contraste 65 pares ok · guarda `guarda-p6.mjs`
> **verde (173 medidas)**. Nenhum commit, nenhum push, nada postado no GitHub.

## VEREDITO: reprovado — 0 CRÍTICO, 0 ALTO, 2 MÉDIO
### Tradução pela regra da Tarefa 00: **sem rodada de correção**. Os dois MÉDIOS vão para a v2. Cabe ao Lucas mergear com pendências listadas.

## A conferência que a passagem dizia estar pela metade — feita

| Sabotagem | Estava no arquivo? (grep antes/depois) | Portões de código | Guarda no Chromium |
|---|---|---|---|
| **FT1** — o operador continua escrevendo enquanto a nota salva; o salvamento falha; o trecho novo some da caixa e do rascunho | sim: 0 → 1 → 1 → 0 ao desfazer | tsc e 1665 testes **verdes** (não pegam) | **PEGOU** — FALHA no caso "rede cai": a caixa voltou ao texto enviado e " · mais 1" sumiu |
| Nova, no desfecho de **sucesso** — duração: valor salvo gravado por cima do que o operador digitou durante a espera | sim | verdes | **PEGOU** — caixa com "41.8", devia ser "41.1" |
| Nova, no desfecho de **sucesso** — relação: nota da relação esvaziada mesmo alterada durante a espera | sim | verdes | **PEGOU** em duas medidas |

Nenhuma das cinco formas viciadas apareceu: as três sabotagens caíram por medida de produto, não por estouro de tempo.
**A correção 24 fica aprovada no próprio achado que a motivou** (a passagem registrava "sem resultado").

## Achados (v2)

| # | Sev. | O defeito | Onde | Prova |
|---|---|---|---|---|
| 1 | MÉDIO | "Limpar átomos" apaga, sem aviso, a escolha feita durante a espera; o "Desfazer" da limpeza tem o mesmo defeito | `src/components/task/atomos-form.tsx:231-238` e `:269-280`; `controle-segmentado.tsx:215` (botões aceitam clique durante a gravação) | reproduzido a 1280 px em `/tarefa/task-build`: escolher "Opcionalidade 1" durante a limpeza → os três grupos ficam vazios. A guarda admite o caso por escrito (`guarda-p6.mjs:10805`) |
| 2 | MÉDIO | A guarda deu vermelho uma vez sem sabotagem ligada à medida: `/api/tarefa/estado` respondeu 500 numa corrida e passou nas outras | medida E4 | intermitente; treina a ignorar o vermelho, ou esconde um 500 real — não investigado |

Olhar de operador (1280 e 390 px): legível, uma ação principal por tela, sem rolagem lateral, validação em português.

## O que fica para o Lucas
Decidir: **mergear com os 2 MÉDIOS listados na v2** (recomendado) ou esperar. Nota de merge do #45 continua valendo:
`hooks-falsos.ts` e `arvore-react.ts` existem nos dois PRs; a versão do #43 é a que deve vencer.
