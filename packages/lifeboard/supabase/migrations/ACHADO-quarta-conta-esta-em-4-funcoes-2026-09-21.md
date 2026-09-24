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

---

# EMENDA (24/09/2026) — o problema é maior: o banco vivo e o repositório divergiram

Ao construir a migration 0027 (as 4 funções com a 4ª conta), parei para **provar** que os corpos que
eu ia escrever eram os que estão rodando. Não eram.

## A medição

Comparando o miolo de cada função entre a **última migration do repositório** que a define e o
**`prosrc` vivo** no projeto `hciiilopyivjaekaxfqp`:

| Função | Última migration | Repo | Vivo | Diferença |
|---|---|---|---|---|
| `fila_prompts_enfileirar` | 0025 | 6.676 | 6.266 | **−410** |
| `fila_prompts_listar` | 0018 | 4.186 | 4.138 | **−48** |
| `fila_prompts_pegar_interno` | 0022 | 8.393 | 9.883 | **+1.490** |
| `fila_prompts_fechar_interno` | 0023 | 5.530 | 7.427 | **+1.897** |

**Não é erro de leitura do meu script.** O início das quatro bate exatamente, e o fim de três das
quatro também; nenhuma tem `$$` aninhado que pudesse cortar o bloco no lugar errado. As diferenças
são **no meio do corpo** — quer dizer, código diferente, não recorte diferente.

E a quarta é mais grave: o **fim** de `fila_prompts_fechar_interno` diverge. O vivo devolve um campo
a mais no JSON de retorno:

```
repo (0023):  …'reaberto_e_fechado', false, 'estado', p_estado  );
vivo:         …false, 'estado', p_estado, 'caixa', v_caixa      );
```

O campo **`caixa`** existe na função que está rodando e **não existe em nenhuma migration do
repositório**.

## Por que isto interrompe o trabalho

Eu ia gerar a 0027 extraindo os corpos do repositório e trocando duas cadeias. Se tivesse aplicado,
o `create or replace` teria **substituído as funções vivas pelas versões do repo** — apagando, em
silêncio, tudo o que existe no banco e não existe aqui, inclusive o campo `caixa`. Uma mudança
anunciada como "acrescenta uma conta" teria revertido meses de ajuste.

**Por isso a 0027 foi apagada.** Não existe nesta branch.

## A decisão que isto cria

| Caminho | O que significa |
|---|---|
| **C — adotar o vivo como verdade** | gerar a 0027 a partir de `pg_get_functiondef` (o que está rodando), acrescentar a 4ª conta e commitar. Seguro para o comportamento; mas a migration não "deriva" de nenhuma anterior, e quem revisar não consegue diferenciá-la do histórico |
| **D — investigar antes** | descobrir de onde vieram as diferenças (alguma sessão aplicou SQL direto, como esta fez hoje com a 0026?), reconciliar repo e banco, e só então acrescentar a conta |

**C é rápido e não quebra nada. D é o que impede isto de acontecer de novo.** Não é decisão de
sessão: é decisão sobre qual é a fonte de verdade deste banco.

## O que isto sugere sobre o resto do banco

As 4 funções examinadas foram as 4 que precisavam da conta nova. **Ninguém mediu as outras.** Se
estas quatro divergiram, o certo é assumir que outras também divergiram até que se meça — e essa
medição é barata (comparar `prosrc` contra o repositório, função a função).

## Estado da decisão 7-B

O operador escolheu **7-B** (mudar a regra do teste-guarda para "a última migration que declara a
ordem é a que vale"). **Não foi executado**, de propósito: mexer na rede de proteção agora
afrouxaria o guarda sem destravar nada, porque a mudança que ele guarda está parada neste achado.
Fica pronto para o momento em que C ou D for decidido.

---

# CORREÇÃO DA EMENDA (24/09/2026, mais tarde) — a divergência tem causa, e não é a que eu escrevi

A emenda acima diz que a função viva devolve um campo `caixa` que **"nenhuma migration deste
repositório produz"**, e sugere escrita direta no banco. **Estava errado.** Eu comparava cada função
só contra a **última** migração que a define. Comparada contra **todas**, a função viva é idêntica,
byte a byte, à **0019**.

**O que de fato aconteceu** (cartório do banco + datas do git):

- **13/09** — 0022, 0023, 0024 aplicadas pelo editor SQL; não existiam no repositório.
- **14/09** — 0016 e 0018–0021, escritas **sem** elas, aplicadas **depois** e por cima (0018–0021
  por fora do cartório: nenhum dos 199 registros menciona o livro-razão).
- **17/09** — as três recuperadas do cartório e numeradas **depois** da 0021.
- **21/09** — a 0025 escrita e **nunca aplicada**.

**Resultado:** as correções de 0022, 0023, 0024 e 0025 **não rodam em produção**, embora cartório,
repositório e testes digam que sim. A fila tem zero linhas, então ninguém sentiu — ainda.

**Consequência para a 4ª conta:** a migração dela não pode partir nem do banco (faltam 4 correções)
nem da última versão do repositório (0022/0023 apagariam o livro-razão da 0019). Precisa partir de
uma **fusão** das duas linhagens, função por função. Relatório completo:
`Lucas-Contexto-Geral/docs/audit/AUDITORIA-banco-x-repositorio-2026-09-24.md`.
