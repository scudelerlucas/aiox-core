# Prompt melhorado — por que a troca de projeto Supabase derrubou o LifeBoard (erro 500)

> **Encomenda literal do operador (15/09/2026):**
> *"Continuando trabalho no scudelerlucas/aiox-core, pacote LifeBoard. PR #26 mergeado (DEPLOY.md
> corrigido). Banco de produção hciiilopyivjaekaxfqp verificado 21/21 migrations. Tentei trocar a
> Vercel (aiox-core-lifeboard) para esse projeto mas o middleware quebrou (500) — revertido para as
> credenciais antigas (ofskmjpzlgzmnivmkyop, projeto de RAG, sem Google login configurado). Preciso
> investigar por que a troca quebrou antes de tentar de novo — seguir a sequência do DEPLOY.md
> (testar em Preview antes de Production)."*
>
> **Comandos:** `!melhorar` + `!arsenal` · **Método:** PEP v2 (`prompt-engineering-protocol.md`)
> **Classe:** CONSULTAR (achar a causa) → ALTERAR (a correção que sair dela)
> **Precedentes de `!melhorar`:** masterclass 08/09 · VSL OS 09/09 · MiroFish×Codex 11/09
> **Não executar este prompt aqui.** O produto desta resposta é o prompt. Rodar é a sessão seguinte.

---

## ⚠️ Antes de tudo: três coisas que o pedido dá como resolvidas e não estão

Isto não é implicância com o texto. São três premissas que, se entrarem na próxima sessão sem
aviso, fazem a investigação inteira procurar no lugar errado.

| # | O pedido diz | O que o repositório diz |
|---|---|---|
| 1 | *"revertido para as credenciais antigas"* — como se fosse voltar ao seguro | O próprio pedido diz que o projeto antigo está **"sem Google login configurado"**. Então o estado de hoje **também** não deixa ninguém entrar. Não existe estado seguro para ficar parado: voltar não conserta, só troca de defeito |
| 2 | *"verificado 21/21 migrations"* | Três números diferentes convivem nos documentos da casa: o `DEPLOY.md` fala em **20 marcadores** (a migration 0011 sai como `NAO VERIFICAVEL`), o resumo de memória de 15/09 registra **15/15**, e o pedido diz 21/21. O próprio `DEPLOY.md` avisa: *"marcador verde é indício forte, não prova de que as 21 rodaram"* |
| 3 | *"o middleware quebrou (500)"* | Ninguém capturou **a linha de log** da Vercel. É a mesma armadilha que travou o botão "Iniciar" do quiz-diagnosys por 6 meses: cinco sessões investigando sem nunca coletar o dado decisivo. Sem o log, toda hipótese abaixo continua sendo hipótese |

> **🔎 RADAR-4Z — achado de RUÍNA (o que não se sabia que não se sabia):** o "rollback" foi dado
> como retorno ao seguro e não é. O sistema está hoje num terceiro estado — nem o novo (quebrado com
> 500) nem um antigo que funcionava, porque antigo que funcionava nunca existiu para login. A
> conclusão prática inverte a pressa: **não há por que adiar a troca para "quando der"** — adiar não
> preserva nada.

---

## §1 · Desambiguação — o pedido tem três leituras, e elas dão trabalhos diferentes

| | Leitura | O que nasce no fim |
|---|---|---|
| **A** | *"descobrir a causa do 500"* | Um laudo: a causa nomeada, com a prova que a sustenta e o teste que a derruba se estiver errada |
| **B** | *"fazer a troca funcionar"* | O painel no ar, lendo o banco certo, com login funcionando |
| **C** | *"impedir que aconteça de novo"* | O `DEPLOY.md` endurecido + um teste automático que trava a repetição |

As três estão dentro do pedido ("investigar **antes de tentar de novo**" = A e depois B; "seguir a
sequência do DEPLOY.md" = C encostado). **Recomendação: A → B → C, nesta ordem, em uma sessão só**,
porque B sem A é chute e C sem A é documentar uma causa imaginada.

**Nomes conferidos** (o mesmo nome costuma ser coisa da casa e coisa do mundo):

- **LifeBoard** aqui é **OS-LIFEBOARD**, `packages/lifeboard` do `aiox-core` — não o produto
  genérico de mesmo nome que existe no mercado. Sem ambiguidade material.
- **`hciiilopyivjaekaxfqp`** é o projeto Supabase chamado **`quiz-diagnosys`** — o mesmo banco que
  hospeda ~15 sistemas da casa. "Banco de produção do LifeBoard" e "quiz-diagnosys" são a mesma
  coisa; quem procurar "lifeboard" na caixa de busca do painel não acha (ela filtra por nome, não
  por referência).
- **`ofskmjpzlgzmnivmkyop`** é o projeto de busca por similaridade (RAG) — `aiox_tnf_pgvector`,
  `os_corpus_rag`. Nenhuma migration do LifeBoard jamais rodou lá.

---

## §2 · Inventário — o que já existe (não recriar)

| Existe | Onde | Estado |
|---|---|---|
| Sequência de migração de projeto, 7 passos, com Preview antes de Production | `packages/lifeboard/DEPLOY.md`, Passo 3 | ✅ mergeado (PR #26), 5 rodadas de revisão do Codex |
| As 3 armadilhas já nomeadas (par de variáveis escondido · URL e chave andam casadas · segredo por projeto) | idem | ✅ escritas |
| Aviso de que `fixture` **não** protege o login | idem | ✅ escrito |
| Diagnóstico do banco (`PASSO-0`, `PASSO-0b`, `PASSO-1`) e suíte de 59 blocos | `packages/lifeboard/supabase/aplicar/` | ✅ rodados em produção em 15/09 |
| Portão de entrada (login Google + lista de e-mails) | `packages/lifeboard/src/middleware.ts` | ✅ em produção |
| Sonda pública de saúde | `packages/lifeboard/src/app/api/health/route.ts` | ✅ |
| **Falta** | | |
| ❌ **Qualquer teste automático do `middleware.ts`** | — | O arquivo não tem um único teste. É o portão de entrada do sistema e é a única peça sem rede |
| ⚠️ Os testes só rodam de dentro de `tests/` | `packages/lifeboard/vitest.config.ts` | Teste escrito em `src/` **não é executado** e passa despercebido como se estivesse verde |
| ❌ A linha de log da Vercel do erro 500 | painel Vercel | Nunca coletada — **é o dado decisivo** |
| ❌ Qual das 4 variáveis de banco existe hoje na Vercel (Production e Preview) | painel Vercel | Nunca listado |
| ❌ Se o login Google está ligado no `hciiilopyivjaekaxfqp` e com quais endereços de retorno | painel Supabase | Nunca conferido |

---

## §3 · As hipóteses, medidas no código deste repositório

Todas com nível **A (medido — o arquivo está no repo e foi lido)**, salvo onde marcado.
Cada uma traz **o que a mata**, porque hipótese sem falsificador é palpite com nome bonito.

### H1 — Metade do sistema em cada projeto (o par de variáveis escondido)

Três arquivos leem as credenciais, e **não pelo mesmo caminho**:

| Arquivo | Lê de |
|---|---|
| `src/middleware.ts` (o portão) | `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY`, direto |
| `src/lib/supabase/browser.ts` (o botão "Entrar com Google") | as mesmas `NEXT_PUBLIC_*`, direto |
| `src/lib/supabase/auth-server.ts` (o **retorno do Google**, `/auth/callback`) | `@/config/env` → que prefere **`SUPABASE_URL` / `SUPABASE_ANON_KEY` sem o prefixo público** |

Se o par sem prefixo existir na Vercel apontando para o projeto antigo e só o par público for
trocado, acontece isto: a pessoa clica em entrar, o Google devolve, o **retorno** abre sessão no
projeto **antigo** e grava o crachá com o nome do projeto antigo; o **portão** procura o crachá com
o nome do projeto **novo**, não acha, e manda de volta para o login. Roda para sempre.
*O `DEPLOY.md` avisa sobre este par em geral; **não** nomeia este caminho específico — o retorno do
Google usar uma fonte diferente do portão.*
**O que mata H1:** listar quais das 4 variáveis existem na Vercel. Se o par sem prefixo não existe,
H1 morre.

### H2 — Uma exceção sem rede, e é ela que produz 500  ⬅ a mais provável

Em `src/middleware.ts` a chamada `await supabase.auth.getUser()` **não está dentro de um
`try`/`catch`**. A consulta à tabela de leitores logo abaixo está protegida; esta não. A biblioteca
do Supabase devolve erro de autenticação como valor, mas **relança** erro que não seja de
autenticação — uma URL malformada (um espaço, uma quebra de linha, um `https://` que ficou para
trás na hora de colar) vira exceção crua. Exceção crua no portão do Next.js = **erro 500 em todas
as rotas**, menos `/login`, `/auth/*` e `/api/health`, que são as três públicas.

Isto casa exatamente com o sintoma relatado: 500, e não "não consigo entrar".

**O que mata H2:** a linha de log da Vercel. Se ela disser `MIDDLEWARE_INVOCATION_FAILED` com um
`TypeError` de URL, H2 está confirmada. Se o log mostrar redirecionamentos 307 em loop e nenhum
500, H2 morre e H1 sobe.

### H3 — Chave de formato novo em biblioteca de 2024  *(nível C — não confirmado)*

O pacote instalado é `@supabase/ssr@^0.5.2` com `@supabase/supabase-js@^2.45.4`, ambos de 2024.
Projetos Supabase recentes emitem chave pública num formato novo (`sb_publishable_…`) em vez do
formato antigo. **Não verifiquei se `hciiilopyivjaekaxfqp` emite a nova** — por isso isto não entra
no prompt como fato, entra como checagem de 10 segundos.
**O que mata H3:** olhar o começo da chave no painel. Formato antigo → H3 morre.

### H4 — A tabela de leitores não existe no projeto novo

O portão consulta `painel_frentes_leitores`, que **não é criada por nenhuma migration do
LifeBoard** — vem do repositório central (`Lucas-Contexto-Geral/supabase/migrations/20260912a_…`).
**Mas isto não produz 500**: a função `podeLer` tem `try`/`catch` e devolve "não pode", o que vira
redirecionamento para o login. H4 explica *"não entro"*, nunca *"500"*.
**Serve para:** depois que o 500 cair, é a próxima parede.

### H5 — O programa foi reaproveitado sem ser reconstruído

Variáveis com o prefixo público são **coladas dentro do programa na hora de construir**, não lidas
na hora de rodar. Republicar reaproveitando a construção anterior mantém o valor antigo no que vai
para o navegador, enquanto o portão já usa o novo. Meio sistema em cada projeto, de novo.
**O que mata H5:** ver se a publicação reconstruiu ou reaproveitou.

### H6 — O login Google nunca foi ligado no projeto novo

O pedido diz que o projeto **antigo** está sem login Google configurado. Ninguém disse que o
**novo** está com. Se não estiver, o botão devolve erro do próprio Google e a pessoa cai em
`/login?error=auth`. Também não é 500 — é a parede seguinte.
**O que mata H6:** o painel do Supabase, aba de provedores.

---

## §4 · O que o prompt original já tinha × o que faltava

| Já tinha | Faltava — e por que muda o resultado |
|---|---|
| O repositório, o pacote e o número do PR | **O laudo não tem dono de prova**: sem dizer que a linha de log da Vercel é o critério, a sessão inventa a causa mais bonita e para nela |
| Os dois identificadores de projeto | **A lista de variáveis que existem hoje** — H1 vive ou morre nela, e ela leva 30 segundos para ser obtida |
| "o middleware quebrou (500)" | **Onde e quando**: em que endereço, logo depois de publicar ou só depois de tentar entrar, em todas as páginas ou só em algumas. Cada resposta elimina hipóteses diferentes |
| "seguir a sequência do DEPLOY.md" | **Que a sequência é boa mas tem um buraco**: ela manda provar num Preview, e não diz para conferir os endereços de retorno do Preview no Supabase antes — sem isso o Preview reprova por motivo errado |
| — | **Que o estado atual também está quebrado** (premissa 1 do quadro lá em cima). Muda a pressa e muda o risco de "não fazer nada" |
| — | **Que o portão não tem nenhum teste.** A correção que sair daqui, sem teste, é a mesma correção esperando para ser desfeita |
| — | **Que este ambiente não alcança painel nenhum.** Sem isso a sessão seguinte gasta meia hora tentando e termina em "não consigo" |

---

## §5 · ARQUITETO — o que exatamente tem de nascer

| | |
|---|---|
| **Artefato 1** | `packages/lifeboard/DIAGNOSTICO-500-troca-de-projeto-2026-09-15.md` — o laudo: a causa nomeada, a prova que a sustenta, e cada hipótese descartada com o motivo do descarte |
| **Artefato 2** | `packages/lifeboard/tests/unit/middleware.test.ts` — **teste que falha antes da correção e passa depois**. No mínimo: URL malformada não pode derrubar o portão; pessoa sem crachá vai para o login (não 500) |
| **Artefato 3** | A correção em si — provavelmente uma rede de proteção em volta da chamada desprotegida em `src/middleware.ts`, e/ou o alinhamento das fontes de credencial entre portão e retorno do Google |
| **Artefato 4** | Emenda no `packages/lifeboard/DEPLOY.md`: o caminho do retorno do Google entra na lista de armadilhas, e o passo do Preview ganha "confira os endereços de retorno do Preview no Supabase ANTES" |
| **Artefato 5** | `docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md` — a missão para o navegador coletar o que esta sessão não alcança |
| **Como se sabe que nasceu** | `npm test` roda no pacote e o teste novo **falha** com o código de hoje · o mesmo teste **passa** com a correção · `npx tsc --noEmit` sai limpo · o laudo nomeia uma causa e cita a linha de log que a prova |
| **Como se sabe que a troca funcionou** (fase B) | Entrar com a conta Google num **Preview** apontado para `hciiilopyivjaekaxfqp` e ver o painel. Só isso prova que endereço e chave estão casados |

---

## §6 · ENGENHEIRO — a especificação (15 linhas)

```
1  Modelo: Opus (depuração profunda). Leitura de N arquivos e varredura → subagentes Sonnet/Haiku em paralelo.
2  Abrir a sessão SÓ com aiox-core (regra sessao-enxuta). O hub entra por GitHub se precisar.
3  Arma: !atom v2 sobre "o que causou o 500" — enumerar, testar necessidade e suficiência de cada
   candidato, grafo de causa até a terminal, veredito atômico. Catálogo de Modos de Falha na abertura.
4  REUSAR antes de gerar: DEPLOY.md Passo 3, as 6 hipóteses deste documento, PASSO-0/0b/1.
5  Ordem que não retrocede: coletar evidência → nomear a causa → teste que falha → correção →
   teste que passa → Preview → Production. Nunca pular para a correção antes do teste que falha.
6  A evidência dos painéis NÃO é deste ambiente: exportar a missão de navegador (artefato 5) no
   PRIMEIRO turno, não no último. Enquanto ela não volta, trabalhar no que é local (teste + código).
7  Guarda: nenhum valor de chave, segredo ou senha aparece no chat, no commit ou no log. Só nomes.
8  Guarda: não mexer em LIFEBOARD_DATA_MODE durante a troca — fica em fixture até o passo 7.
9  Guarda: nada vai para Production antes de um Preview com login real feito por uma pessoa.
10 Guarda: a main é protegida — branch da sessão, depois pedido de junção, o operador revisa.
11 Falsificador do laudo: se a correção for aplicada e o 500 voltar no Preview, a causa nomeada
   estava errada — reabrir o !atom, não remendar.
12 Falsificador do teste: apagar a correção tem de fazer o teste ficar vermelho. Se ficar verde,
   o teste não testa nada.
13 Teto: se a evidência dos painéis não voltar, parar no laudo com as hipóteses ordenadas e dizer
   o que falta. Não adivinhar a causa para ter uma resposta.
14 Fechar pelo response-protocol (4 seções + passo a passo, linguagem simples).
15 Gravar resumo em memoria/ e abrir o pedido de junção como rascunho.
```

---

## §7 · O PROMPT REESCRITO — copiar este bloco inteiro numa sessão nova

```
Abra a sessão só com o repositório scudelerlucas/aiox-core. Branch da sessão, nunca push na main.

CONTEXTO (3 linhas)
O painel OS-LIFEBOARD (packages/lifeboard) roda na Vercel no projeto "aiox-core-lifeboard".
Em 15/09/2026 tentei apontá-lo para o banco Supabase certo (hciiilopyivjaekaxfqp, nome
"quiz-diagnosys") e o portão de entrada passou a devolver erro 500; voltei para o banco
antigo (ofskmjpzlgzmnivmkyop, sistema de busca por similaridade). Atenção: o estado de hoje
TAMBÉM está quebrado — o projeto antigo não tem login Google ligado. Não existe estado seguro.

ARMA: !atom v2 sobre a pergunta "o que causou o 500". Enumerar todos os candidatos, testar cada
um por necessidade e suficiência, montar o grafo até a causa terminal, veredito atômico. Ler os
títulos do Catálogo de Modos de Falha na abertura e no fechamento da investigação.

REUSE ANTES DE GERAR (não reescrever nada disto)
1. docs/lifeboard/00-PROMPT-MELHORADO-vercel-troca-supabase-500-v1.0.md — as 6 hipóteses
   já levantadas (H1 a H6), cada uma com o que a mata. Comece por elas; só invente uma sétima
   se as seis morrerem.
2. packages/lifeboard/DEPLOY.md, Passo 3 — a sequência de 7 passos para trocar de projeto, com
   as 3 armadilhas e o aviso de que o modo "fixture" não protege o login.
3. packages/lifeboard/supabase/aplicar/PASSO-0*.sql — diagnóstico do banco, só leitura.

ENTREGUE
1. A missão de navegador, NO PRIMEIRO TURNO (esta sessão não alcança painel nenhum). Grave em
   docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md e me mostre no chat.
   Ela precisa coletar exatamente quatro coisas, e NENHUM valor de chave ou segredo:
   (a) a linha de log do erro 500 na Vercel — projeto aiox-core-lifeboard, aba de registros,
       a publicação do dia 15/09; quero a mensagem de erro inteira e o nome da rota;
   (b) os NOMES das variáveis de banco que existem hoje em Production e em Preview — se existem
       SUPABASE_URL e SUPABASE_ANON_KEY (sem o prefixo NEXT_PUBLIC_) além das com prefixo. Só os
       nomes e para qual projeto cada uma aponta (os 20 primeiros caracteres da URL bastam);
   (c) no Supabase, projeto hciiilopyivjaekaxfqp: o login Google está ligado? Quais endereços de
       retorno estão cadastrados? A chave pública começa com "eyJ" ou com "sb_publishable_"?
   (d) a última publicação reconstruiu o programa ou reaproveitou a construção anterior?
   A missão tem URL de cada tela, critério de pronto por item, seção NÃO FAÇA (não editar nada,
   não trocar variável, não apagar publicação) e relatório final. Nenhum segredo volta no texto.

2. Enquanto a missão não volta, trabalhe no que é local:
   - Crie packages/lifeboard/tests/unit/middleware.test.ts. O caminho importa: o vitest.config.ts
     só enxerga arquivos dentro de tests/ — teste posto em src/ não roda e ninguém percebe.
     Hoje o portão (src/middleware.ts) não tem UM teste. No mínimo: (i) endereço de banco malformado não pode derrubar o portão com
     exceção — tem de degradar para o login; (ii) pessoa sem crachá vai para /login, nunca 500;
     (iii) /login, /auth/* e /api/health continuam abertos sem login.
   - O teste (i) TEM DE FALHAR com o código de hoje. Me mostre a saída vermelha antes de corrigir
     qualquer coisa. Se ele passar de primeira, o teste está errado — refaça.

3. Com a evidência na mão, o laudo: packages/lifeboard/DIAGNOSTICO-500-troca-de-projeto-2026-09-15.md
   — a causa nomeada, a linha de log que a prova, e cada uma das 6 hipóteses marcada como
   CONFIRMADA ou DESCARTADA com o motivo. Hipótese sem veredito não pode sobrar.

4. A correção mínima que a causa pede. Depois dela, o teste (i) fica verde. Apagar a correção
   tem de deixá-lo vermelho de novo — prove isso rodando.

5. Emenda no packages/lifeboard/DEPLOY.md: acrescente às armadilhas do Passo 3 que o retorno do
   login Google (src/lib/supabase/auth-server.ts) lê as credenciais por um caminho DIFERENTE do
   portão (src/middleware.ts) — o retorno prefere as variáveis sem o prefixo público, o portão só
   lê as com prefixo. E no passo do Preview, acrescente: conferir no Supabase que o endereço de
   retorno do Preview está cadastrado ANTES de testar, senão o Preview reprova por motivo errado.

6. Qualidade: npx tsc --noEmit limpo e npm test verde no pacote antes de qualquer envio.

NÃO FAÇA
- Não toque em nada na Vercel nem no Supabase por conta própria — esta sessão não alcança painel;
  tudo que for de painel sai como missão para mim executar.
- Não escreva nenhum valor de chave, segredo ou senha no chat, no commit, no log ou no laudo.
- Não mexa em LIFEBOARD_DATA_MODE. Ele fica em "fixture" até o último passo, de propósito.
- Não proponha ir para Production antes de um Preview em que uma pessoa entrou de verdade.
- Não adivinhe a causa para ter uma resposta. Se a evidência não voltar, pare no laudo com as
  hipóteses ordenadas e diga o que falta.
- Não faça push na main. Branch da sessão, pedido de junção em rascunho.
- Não mude o número de migrations conferidas sem medir: o DEPLOY.md fala em 20 marcadores, a
  memória de 15/09 em 15, e eu falei 21. Confira e escreva o número certo em um lugar só.

PRONTO QUANDO
- O teste (i) falhou com o código antigo e passou com a correção, e eu vi as duas saídas.
- O laudo nomeia UMA causa e cita a evidência que a prova.
- As 6 hipóteses estão todas marcadas: confirmada ou descartada, com motivo.
- npx tsc --noEmit sai limpo e npm test fica verde.
- O DEPLOY.md tem as duas emendas.
- A missão de navegador está gravada e me foi mostrada no chat.

RELATÓRIO FINAL
Em linguagem simples: o que causou o 500, o que foi corrigido, o que ainda falta para a troca
acontecer, e qual é o próximo clique que é meu. Com o link de cada arquivo e de cada tela.
```

---

## §8 · Decisões que dependem do operador

| | Decisão | Opções |
|---|---|---|
| **D1** | Até onde a próxima sessão vai | **A)** só o laudo + o teste + a correção (ela não toca em painel) · **B)** o laudo e, com a evidência de volta, ela me guia clique a clique até o Preview passar · **C)** só o laudo, e a correção fica para depois |
| **D2** | O LifeBoard divide o banco com ~15 sistemas | **A)** continua dividindo (é o estado de hoje e funciona) · **B)** ganha projeto Supabase próprio — mais limpo, mas é uma migração inteira, não uma troca de variável |
| **D3** | O número de migrations conferidas está escrito de três jeitos (20, 15, 21) | **A)** a próxima sessão mede uma vez e corrige os três lugares · **B)** fica como está, cada documento com o seu |
| **D4** | Endurecer o `DEPLOY.md` com `!estressar³` depois que a causa for conhecida ⚙ | **A)** sim, na mesma sessão · **B)** não, o documento já basta |

> ## ✅ DECIDIDO pelo operador em 15/09/2026: **D1-B · D2-A · D3-A · D4-A**
> — e executado na mesma sessão. O que saiu: a correção do portão com 9 testes
> (`packages/lifeboard/tests/unit/middleware.test.ts`), o laudo parcial
> (`packages/lifeboard/DIAGNOSTICO-500-troca-de-projeto-2026-09-15.md`), as duas emendas no
> `DEPLOY.md` e a missão de navegador
> (`docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md`).
> **D3 medido:** 21 migrações, 20 conferíveis pelo `PASSO-0` v2; o "15/15" era a v1 do mesmo dia.
> **D4 pendente do log:** o endurecimento completo do `DEPLOY.md` roda quando a causa fechar.

**Recomendação (registrada antes da decisão):** **D1-B, D2-A, D3-A, D4-A.**
D1-B porque o laudo sem o Preview não fecha nada — e você não vai ter de lembrar da sequência
sozinho. D2-A porque trocar de banco agora empilha duas migrações de uma vez, e uma delas já
quebrou. D3-A porque três números para a mesma pergunta é como a casa perde uma tarde.
D4-A porque a hora de endurecer um roteiro é logo depois de ele ter falhado, quando a falha ainda
está fresca.

---

## §9 · Arma escolhida (`!arsenal`)

| Arma | Score | Por que esta |
|---|---|---|
| **`!atom v2`** | 9,5 | O problema é exatamente a forma dela: vários candidatos plausíveis, nenhum provado. Ela enumera tudo, testa cada candidato por necessidade **e** suficiência, monta o grafo até a causa terminal e dá veredito. Sem ela, a sessão se apaixona pela primeira hipótese bonita |
| **Catálogo de Modos de Falha** | 8,5 | Sempre ligado. Lê-se na abertura (*"qual destes eu conseguiria cometer aqui?"*) e no fechamento (*"qual eu acabei de cometer?"*). Aqui o candidato óbvio é o da sessão que conclui sem medir |
| ⚙ `!estressar³` | 8,0 | **Sugerido, não disparado** — é arma que só o operador manda rodar. Cabe no `DEPLOY.md` depois que a causa for conhecida (decisão D4) |

Limite de 2 armas por turno respeitado: `!atom v2` + Catálogo.

---

## §10 · Fontes e nível de evidência

| Fato | Nível | Fonte |
|---|---|---|
| O portão lê as credenciais direto das variáveis com prefixo público | **A · medido** | `packages/lifeboard/src/middleware.ts` |
| O retorno do login Google lê por outro caminho, que prefere as variáveis sem prefixo | **A · medido** | `src/lib/supabase/auth-server.ts` + `src/config/env.ts` (`firstNonEmpty`) |
| A chamada que busca o usuário no portão não tem rede de proteção | **A · medido** | `src/middleware.ts` |
| A consulta à tabela de leitores tem rede de proteção (logo, não gera 500) | **A · medido** | `src/middleware.ts`, função `podeLer` |
| Três rotas ficam abertas sem login | **A · medido** | `src/middleware.ts`, `isPublicPath` |
| O portão não tem nenhum teste | **A · medido** | não existe arquivo de teste para ele no pacote |
| Bibliotecas do Supabase instaladas: `@supabase/ssr ^0.5.2`, `supabase-js ^2.45.4` | **A · medido** | `packages/lifeboard/package.json` |
| Os testes só rodam de `tests/**` — teste em `src/` é ignorado em silêncio | **A · medido** | `packages/lifeboard/vitest.config.ts`, campo `include` |
| A tabela de leitores vem do repositório central, não das migrations do LifeBoard | **A · medido** | `DEPLOY.md` + `Lucas-Contexto-Geral/supabase/migrations/20260912a_…` |
| Marcador verde é indício, não prova de que as 21 rodaram | **B · documentado** | `packages/lifeboard/DEPLOY.md`, aviso do topo |
| Produção fechou 15/15 no PASSO-0 em 15/09 | **B · documentado** | `memoria/2026-09-15--aiox-core--lifeboard-livro-razao-d44b-d49.md` |
| Projetos Supabase recentes emitem chave pública em formato novo | **C · terceiros** | não confirmado para este projeto — vira checagem, não entra como fato |
| A biblioteca relança erro que não seja de autenticação | **C · terceiros** | comportamento conhecido da `supabase-js`; **confirmar no log**, é o que sustenta H2 |

---

*Documento gerado por `!melhorar` (PEP v2) em 2026-09-15. O produto é o prompt do §7 — nada dele
foi executado nesta sessão.*
