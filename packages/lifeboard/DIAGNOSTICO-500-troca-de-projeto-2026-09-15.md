# Laudo — o erro 500 ao trocar o LifeBoard de projeto Supabase

> **Estado: PARCIAL.** Um defeito real foi encontrado, provado por teste e corrigido. Falta a
> linha de log da Vercel para dizer se foi **ele** que causou o 500 de 15/09, ou se ele apenas
> estava lá esperando. A missão que busca essa linha:
> [`docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md`](../../docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md)
>
> Decisões do operador que geraram este trabalho: **D1-B, D2-A, D3-A, D4-A** (15/09/2026).

---

## O que aconteceu, em três frases

O painel LifeBoard foi apontado para o banco certo (`hciiilopyivjaekaxfqp`, nome `quiz-diagnosys`)
e o portão de entrada passou a devolver erro 500. As credenciais foram revertidas para o banco
antigo (`ofskmjpzlgzmnivmkyop`, o sistema de busca por similaridade), **que também não deixa
ninguém entrar** — ele não tem o login do Google ligado. Não existe, hoje, um estado em que o
painel funcione.

---

## O defeito encontrado e corrigido — hipótese H2

**CONFIRMADO como defeito real. Ainda não confirmado como a causa do 500 de 15/09.**

O portão (`src/middleware.ts`) chamava a biblioteca do Supabase para descobrir quem está entrando,
**sem nenhuma rede de proteção**. Essa biblioteca tem um comportamento que é fácil de não notar:
erro de login ela devolve como resposta normal, mas **qualquer outro erro ela relança**. Endereço
de banco malformado — um espaço, uma quebra de linha, um `https://` que ficou para trás na hora de
colar a credencial — não é erro de login: é erro de endereço. Então sobe cru.

E subir cru no portão é diferente de subir numa página. O portão é **um só** para o site inteiro:
a exceção vira erro 500 em **todas** as rotas de uma vez, menos as três públicas (`/login`,
`/auth/*` e `/api/health`). É exatamente o sintoma relatado — e explica também por que a sonda de
saúde continuaria verde enquanto ninguém consegue entrar.

### Como isto foi provado, e não deduzido

Foi escrito um teste (`tests/unit/middleware.test.ts`, 9 casos) que entrega ao portão um erro que
não é de login e exige que ele **degrade para a tela de entrada, nunca exploda**.

| Momento | Resultado |
|---|---|
| Com o código de antes | **2 falham**, 7 passam — a exceção escapa do portão |
| Com a correção | **9 passam** |
| Desfazendo a correção de novo | **volta a 2 falhas** — o teste testa mesmo o que diz testar |
| Suíte inteira do pacote | **1342 passam**, nenhuma regressão |
| Verificação de tipos | limpa |

### A correção

O portão passou a seguir a mesma disciplina que as páginas do painel já seguiam desde P5b
(`linha-do-tempo-degrada`, `home-degrada-sem-cair`): **degrada, nunca derruba**. Abrir o cliente e
ler o usuário agora acontece dentro de uma rede de proteção; qualquer exceção manda a pessoa para
a tela de entrada. Degradar aqui é o lado **seguro** — sem conseguir provar quem é, ninguém entra.

O portão era a única peça do sistema sem nenhum teste. Agora tem nove.

---

## As outras cinco hipóteses

| | Hipótese | Veredito hoje | O que falta para fechar |
|---|---|---|---|
| **H1** | O retorno do login Google lê as credenciais de uma fonte **diferente** do portão: `src/lib/supabase/auth-server.ts` passa por `@/config/env`, que **prefere** `SUPABASE_URL`/`SUPABASE_ANON_KEY` (sem prefixo); o portão e o botão de entrar leem só as `NEXT_PUBLIC_*`. Trocar um par e não o outro põe metade do sistema em cada banco, e a pessoa fica rodando entre entrar e voltar para o login | **EM ABERTO — mecanismo confirmado no código, ocorrência não** | Item **M2** da missão: saber se o par sem prefixo existe na Vercel. Se não existir, H1 morre |
| **H3** | Chave pública em formato novo (`sb_publishable_…`) contra bibliotecas de 2024 (`@supabase/ssr` 0.5.2, `supabase-js` 2.45.4) | **EM ABERTO** | Item **M3**: ver se a chave começa com `eyJ` ou com `sb_publishable_` |
| **H4** | A tabela `painel_frentes_leitores` não existe no banco novo (ela vem do repositório central, não das migrações do LifeBoard) | **DESCARTADA como causa do 500** — essa consulta **já tem** rede de proteção e devolve "não pode", o que vira redirecionamento, não 500 | Continua sendo a parede **seguinte**, depois que o 500 cair |
| **H5** | A publicação reaproveitou a construção anterior, mantendo o endereço antigo colado dentro do programa que vai ao navegador | **EM ABERTO** | Item **M4** da missão |
| **H6** | O login do Google nunca foi ligado no banco novo | **EM ABERTO** — e é quase certo que precisa ser feito de qualquer jeito | Item **M3** da missão |

**Nenhuma hipótese ficou sem veredito.** Três dependem de uma tela que esta sessão não alcança;
uma caiu por leitura de código; uma foi confirmada e corrigida.

---

## O número de migrações, medido — decisão D3-A

Três números circulavam para a mesma pergunta. **Não se contradizem: medem coisas diferentes.**

| Número | O que é de verdade |
|---|---|
| **21** | As migrações do LifeBoard, `0001` a `0021`. É o número certo de "quantas existem" |
| **20** | Quantas o roteiro de diagnóstico (`PASSO-0`) consegue conferir. A `0011` fica de fora porque só redeclara funções que migrações posteriores redeclaram de novo — não sobra marca para procurar. Ela sai como `NÃO VERIFICÁVEL`, declarada, não escondida |
| **15** | O resultado da versão **antiga** do `PASSO-0`, registrado na memória de 15/09 **antes** da correção do mesmo dia. O cabeçalho do próprio roteiro registra que um banco que pulasse a migração `0005` passava "15/15 verde" com os guardas de isolamento ausentes — era o pior caso, e foi ele que motivou a v2 |

**O número a usar daqui para frente: 21 migrações, 20 conferíveis.** E vale o aviso que o
`DEPLOY.md` já dá: marca verde é indício forte, não prova de que as 21 rodaram.

---

## O que ainda não é sabido

- **Se H2 foi a causa de 15/09** ou só um defeito que estava lá. Só a linha de log diz.
- **Se H1 está ativo** — depende de existir o par de variáveis sem prefixo.
- Nada disso impede a próxima tentativa de troca: a correção do portão vale por si, porque tira o
  500 da mesa como classe de falha, qualquer que tenha sido a causa daquele dia.
