# Tarefa Codex 03 — as guardas P4 e P5 voltam a medir a tela de hoje, e passam a rodar na CI

> Decisão do Lucas, 27/09/2026 (D2 = A): *reescrever as guardas de navegador da P4 (grafo) e da P5 (linha do
> tempo) para a demonstração com frentes e ligá-las na CI.* Nasce do achado da validação final da Tarefa 00
> (`docs/lifeboard/CODEX-00-validacao-final.md`). **Um PR. No máximo 2 rodadas de revisão.**
>
> | Executa (pessoa) | Data | Quem cobra |
> |---|---|---|
> | **Lucas** — cola o prompt do fim desta página no painel do Codex, publica o PR e decide o merge. O Codex é a ferramenta; o Claude valida por fora. | **29/09/2026, 10h** (data proposta; evento na agenda LS do Lucas com e-mail e aviso 1 dia antes e aviso 1 h antes — o prazo tem ~33 h, por isso não há aviso de 7 dias) | **Lucas** |

## O problema, medido em 27/09 na `main` (89ccf4b5)

A junção das frentes (#47, 25/09) pôs PRs, branches e conversas no grafo e na linha do tempo. A demonstração
(modo fixture) passou de **27 para 46 linhas** e o grafo ganhou dezenas de cartões. As guardas P4 e P5 foram
escritas para a demonstração antiga e **não rodam na CI** (só a P6 roda), então ninguém viu o vermelho.

| Guarda | Junção ligada (padrão) | Junção desligada (`LIFEBOARD_FRENTES_NO_GRAFO=off`) | Duração local |
|---|---|---|---|
| P5 · `tests/navegador/guarda-p5.mjs` | **21 falhas**, todas `Q`: "a coluna tem 46 rótulos, e a fixture desenha 27 linhas" (constante `LINHAS_DA_FIXTURE = 27`) | **1 falha**: `T` a 390×844, "Auto" e "Trimestre" com 7,27 e 6,00 px/dia (tolerância 1,5), eixos de 218 e 546 px | ~7 min |
| P4 · `scripts/guarda-no-navegador.mjs` | **41 falhas**: cor `sinergia` que nenhuma aresta pinta (15), traço/glifo fora do canvas a 390 (15), "seis cliques deveriam chegar ao teto 1,8" e chegam a 1,49–1,69 (3), passeio do zoom abaixo do piso de 40 valores, e outros | **1 falha**: a 390×800 com o aviso "5 fontes desatualizadas", o rótulo de `sinergia:edge-docs-sinergia-review` é desenhado em cima do traço `task-setup→task-build` | ~35 min (5 larguras) |

As listas são idênticas com e sem os PRs #54/#55/#56: o vermelho é da `main`, não das correções da Tarefa 00.

É a mesma classe do vermelho da P6 que o #53 fechou: **a guarda mede o caso (a demonstração de um dia), não a
classe (o que a tela promete para qualquer dado).**

## O que entregar

1. **P5 — a contagem sai do dado servido, nunca de constante.** `LINHAS_DA_FIXTURE` e os pisos derivados dela
   passam a ser lidos do que o servidor entrega para a rota (o mesmo caminho que a página usa), como a guarda P4
   já faz com `/api/grafo-bruto`. Uma constante só sobrevive se for **piso mínimo** declarado com o motivo.
2. **P4 — as expectativas saem do dado servido, sem perder o piso de cada papel.** IDs e quantidades de arestas
   vêm do dado bruto, mas o piso por papel (`MINIMO_DE_ARESTAS_POR_CAMADA = 2`) **continua valendo para cada um dos
   seis papéis**: se o dado servido não trouxer arestas de um papel (por exemplo `sinergia`), a guarda fica
   **vermelha** e a fixture é que tem de fornecê-las — ausência nunca vira sucesso. Onde o papel existe e o traço
   não pinta, é falha de produto ou de enquadramento, não de dado. Traço fora do canvas a 390: a guarda
   leva o traço à vista (rolagem/enquadrar do produto) antes de medir, ou mede só o que o produto promete
   mostrar naquela largura — **não medir continua sendo reprovar**, como a guarda já diz. Teto do zoom e piso do
   passeio: recalcular a partir do que o produto declara para o número de cartões servido, com o motivo escrito.
3. **Os dois resíduos (aparecem com a junção desligada), reproduzidos antes de mexer:**
   - P5 `T` a 390: decidir, com medida, se é defeito do produto (o "Auto" escolhe quase a escala do Trimestre) ou
     critério estreito da guarda (os eixos são diferentes, 218 × 546 px, e a guarda compara só px/dia). Se for
     guarda, a medida passa a comparar a geometria inteira (px/dia **e** eixo); se for produto, corrigir o produto.
   - P4 rótulo sobre traço a 390 com o aviso de fontes: é defeito do produto (texto sobre linha). Corrigir o
     posicionamento do rótulo; a guarda já pega.
4. **Na CI:** dois jobs novos em `.github/workflows/ci.yml`, no molde do job `lifeboard-navegador` (P6): mesma
   imagem `mcr.microsoft.com/playwright:v1.55.1-noble`, `shell: bash`, `playwright-core` resolvido pelo Node,
   Chromium achado em `/ms-playwright`, nada que engula o código de saída. Atenção aos nomes de variável, que
   **não** são os da P6:
   - P5 lê `PLAYWRIGHT_MODULO` e `PLAYWRIGHT_CHROMIUM` (iguais à P6).
   - P4 lê `LIFEBOARD_PLAYWRIGHT` (caminho do **pacote**, não do `index.js`) e `LIFEBOARD_CHROMIUM`; tem
     `LIFEBOARD_GUARDA_LARGURAS` para escolher larguras. Na CI, **as cinco larguras rodam** (1024, 1280, 1440,
     1920 e 390), cada uma com as suas medidas e sentinelas: a corrida inteira leva ~35 min, então dividir em
     **uma entrada de matriz por largura, em paralelo** (~7–8 min cada), nunca cortar larguras. Recorte de
     largura só é aceito em corrida manual de sabotagem, nunca no portão.
   - Scripts npm: `guarda:grafo` já existe (P4); criar `guarda:linha-do-tempo` para a P5.
   - `timeout-minutes` com a mesma folga de 7 min sobre o teto da corrida que o job da P6 usa.
   - Estender `tests/unit/guardas-com-gatilho.test.ts` / `guarda-de-navegador-com-gatilho.test.ts` para conferir
     que os dois jobs novos existem, rodam o script certo e não ganharam silenciador.
5. **Prova de peso (sabotagem), uma por guarda, feita e desfeita antes do commit:**
   - P5: a sabotagem **RV1** da Tarefa 00 ("sai pela barra e volta" com `tabIndex = -1` na remontagem) → a medida
     `R-rota` tem de ficar vermelha.
   - P4: a sabotagem **SX1** (a aresta destacada "gruda" ao escolher outro cartão) → vermelha.
   - Relatar no PR: arquivo, linha, grep antes/depois, e a medida que acusou.
6. `tsc --noEmit` limpo · `vitest run` verde (hoje 1851/1851) · `node scripts/checar-contraste.mjs` verde · as
   três guardas (P4, P5, P6) **verdes com a junção ligada**, na árvore limpa.

## NÃO FAÇA

- **Não desligar a junção para ficar verde.** `LIFEBOARD_FRENTES_NO_GRAFO=off` na CI ou dentro das guardas é
  medir uma tela que o operador não vê. É a forma viciada nº 3 (mede só o nome).
- Não baixar piso, teto ou tolerância sem a medição escrita ao lado e o motivo.
- Não pular, desligar ou marcar como opcional nenhuma medida. Não transformar "não achei o Playwright" em skip.
- Não mudar a regra da aresta crítica, o texto `ini.`/`fim` (decisão D1 = A do Lucas, 27/09) nem a P6.
- Não tocar em Vercel, Supabase de produção, Google. Não aplicar migration. Não fazer push para a `main`.
- Não abrir 3ª rodada: o que sobrar vira item da v2 na `LINHA-DE-CHEGADA.md`.

## PRONTO QUANDO

- PR publicado pela tarefa, com os dois jobs novos **verdes na CI** junto com o da P6, e as duas sabotagens
  relatadas como pegas.
- O Claude valida por fora (portões + as três guardas no Chromium + uma sabotagem própria por guarda) e o Lucas
  decide o merge.

## Prompt para colar no painel do Codex

```
Execute a tarefa descrita em docs/lifeboard/TAREFA-CODEX-03-guardas-p4-p5-com-frentes-e-na-ci.md, no
repositório scudelerlucas/aiox-core, a partir da main. Leia o arquivo inteiro antes de começar: a seção
"O problema" tem as medidas de 27/09, "O que entregar" tem os 6 itens, "NÃO FAÇA" tem os limites.
Regras: reproduza cada falha antes de corrigir; não desligue a junção das frentes para ficar verde; faça
as duas sabotagens do item 5 e relate no PR; rode tsc, vitest, contraste e as três guardas (P4, P5, P6)
com a junção ligada; commit em português; publique como PR pela tarefa. Não mexa na main, não aplique
nada em produção.
```
