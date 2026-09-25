# Propostas SUPERADAS — guardadas só para registro

**Superado em 24/09/2026.** Estes arquivos eram a tentativa desta sessão
(`claude/chat-regent-pull-4fvbzq`) de ligar a 4ª conta (`arborcactus@gmail.com`) na fila.
A `main` resolveu melhor, em paralelo, entre 21 e 22/09:

- a **0029** criou `painel_contas_da_casa()` — **uma** fonte da lista de contas no lugar das
  cinco cópias escritas à mão (três portas da fila, duas travas de coluna, mais a ordem de
  desempate). Era exatamente o defeito que o `ACHADO` desta pasta tinha encontrado;
- os testes **T82** e **T83** fazem a 4ª conta atravessar todas as portas, o fechamento inclusive;
- o TypeScript da `main` já traz `"arborcactus@gmail.com": "Arbor Cactus"` na **fila**
  (`src/core/prompts/tipos.ts`).

**O que ainda falta na `main` (medido em 25/09):** o painel de assuntos (`frentes`) só conhece
três contas — `src/lib/frentes/compose.ts` (`CONTAS` e `CONTAS_CONHECIDAS`), `CorConta` em
`src/lib/frentes/types.ts` e as cores em `src/components/frentes/conta-chip.tsx`. Uma sessão da
Arbor cai no rótulo neutro `arborcactus` e fica fora da checagem de conta sem leitura. Os trechos
desses três arquivos em `quarta-conta-typescript.patch` **continuam válidos** como trabalho a
fazer, com o rótulo canônico "Arbor Cactus"; o trecho de `tipos.ts` no mesmo patch já está feito.

**Nenhum SQL desta pasta deve ser aplicado.** A `0026` desta pasta **nunca foi aplicada** e
**não é** a 0026 citada nas notas da 0027 e da 0028 — aquela
(`0026_lifeboard_v3_fila_quarta_conta_arborcactus`, de uma branch irmã) foi aplicada em produção
em 21/09 12:32 UTC e **revertida** em 24/09 01:29 UTC (as duas linhas estão no cartório do
banco). A reversão não afeta a main: a 0027 e a 0029 redeclaram elas mesmas a trava de contas.

## ⚠️ Aviso para quem fizer o deploy da fila

**A 0025 nunca foi aplicada em produção.** Medido em 24/09 pelo vigia das funções
(`Lucas-Contexto-Geral/scripts/regente/vigia_funcoes.py`), comparando o corpo vivo de cada
função com cada versão escrita:

| Função | Roda hoje | Última versão escrita |
|---|---|---|
| `painel_sessao_dona` | 0018 | **0025** |
| `painel_caixa_lancar` | 0021 | 0027 |
| `fila_prompts_enfileirar` | 0021 | 0029 |

A nota da 0028 diz *"produção rodou da 0019 à 0026"*. Para essas funções, não rodou.
**`painel_sessao_dona` só existe na 0018 e na 0025 — nenhuma das 0027–0030 a redefine.** Um deploy
que comece na 0027 deixa essa função na versão velha para sempre, sem erro nenhum. As outras duas
a 0027 e a 0029 reescrevem por inteiro (a 0027 redefine `painel_caixa_lancar` e carrega o D50), então
um deploy a partir da 0027 as corrige — só `painel_sessao_dona` fica para trás.

**O deploy tem que começar na 0025**, na ordem, e o vigia confirma depois (item
`banco-versao-antiga` some da fila do Regente). *(Correção de 25/09: a primeira versão desta tabela
dizia que `painel_caixa_lancar` também parava na 0025 — achado do Codex no PR #46.)*

Conferido também: a 0030 foi escrita sobre a versão que roda (0019), não sobre as 0022/0023
— 80% e 87% de semelhança com o vivo, contra 63–64% com as antigas, e mantém o livro-razão.
