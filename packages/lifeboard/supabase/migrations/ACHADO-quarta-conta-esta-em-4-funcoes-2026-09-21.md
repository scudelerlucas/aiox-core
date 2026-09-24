# A 4ª conta não cabe numa migration só — e o teste-guarda é quem decide

**Medido em 21/09/2026.** Aparece ao tentar ligar `arborcactus@gmail.com` na fila do Lifeboard.

## O que está errado hoje

`public.painel_teto_diario` lista **4** contas. `public.painel_fila_prompts` aceita **3**.
Conta com orçamento e sem fila: item escrito para ela é recusado, e o trabalho nunca anda.

## Por que a correção óbvia não basta

Ampliar o `CHECK` da tabela (migration 0026) resolve **um** dos quatro lugares. A lista das contas
está escrita, por extenso, **dentro de 4 funções** do banco:

| Função | Onde a lista aparece |
|---|---|
| `fila_prompts_enfileirar` | guarda `v_conta not in (…)` (2×) |
| `fila_prompts_listar` | guarda `p_conta not in (…)` |
| `fila_prompts_pegar_interno` | guarda + ordem de desempate `case t.conta … then N` |
| `fila_prompts_fechar_interno` | guarda `p_conta not in (…)` |

Com só o `CHECK` ampliado, a 4ª conta é **aceita pela tabela e recusada pela função** — um
meio-caminho que confunde quem for depurar. Por isso a 0026 foi revertida em produção no mesmo dia.

## O nó de verdade: o teste-guarda

`tests/unit/prompts-espelho-sql.test.ts` lê as migrations **do disco** e exige que **toda** migration
que declare a ordem das contas bata exatamente com `CONTAS` do TypeScript. O cabeçalho dele diz:

> *"Falha aqui = TS e banco divergiram. O conserto é mudar os DOIS, no mesmo commit — nunca afrouxar o teste."*

Esse teste é excelente e pegou este problema. Mas ele foi escrito quando a lista **nunca mudava**.
Na primeira vez que ela muda, a regra "toda migration concorda" força um de dois caminhos, e **os
dois têm custo**:

| Caminho | O que custa |
|---|---|
| **A — reescrever as migrations antigas** (0013, 0015) para citar 4 contas | migration já aplicada vira ficção; o arquivo deixa de contar o que aconteceu naquele dia |
| **B — mudar a regra do teste** para "a ÚLTIMA migration que declara a ordem precisa bater" | modela como o Postgres de fato resolve (`create or replace`: a última vence), mas **mexe na rede de proteção**, que é o que o próprio teste proíbe |

**Não é decisão de sessão.** É o operador quem escolhe — e escolher B exige escrever, no teste, por
que isso não é afrouxamento.

## Estado atual da branch `claude/chat-regent-pull-4fvbzq`

- ✅ TypeScript com a 4ª conta (`tipos.ts`, `compose.ts`, `types.ts`, `conta-chip.tsx`) — `tsc --noEmit` limpo
- ✅ Migration 0026 escrita, **não aplicada** (revertida em produção)
- ❌ As 4 funções do banco: **não tocadas**
- ❌ **8 testes vermelhos**, todos por este motivo — e eles estão certos em falhar

**Não mergear esta branch antes da decisão A/B.** Testes vermelhos aqui não são defeito do trabalho:
são o alarme funcionando.
