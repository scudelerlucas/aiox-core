# LifeBoard — o que o operador quer plugar (lista de candidatos, 21/09/2026)

> **Decisão do operador em 21/09/2026: "A" — isto é ROTEIRO, não trabalho de agora.**
> A decisão de 14/09 (*zero feature nova até o loop do gauntlet fechar*) continua de pé
> e não foi tocada. As quatro peças P4–P7 fecham primeiro.

## Por que existe este arquivo, e por que ele não é uma frente

A regra da casa (`AGENTS.md` §"Item de frente só entra com dono, data e quem cobra"; no
hub, `item-so-entra-com-dono`) é literal: item de frente só entra com **três** coisas —
**(a) nome de quem executa** (pessoa real, não "a casa" nem "a sessão"), **(b) data** e
**(c) nome de quem cobra** (alguém que enxerga o calendário onde a data foi escrita e recebe
o lembrete). Faltando qualquer uma, não entra: fica como achado, e a **ausência é a
informação**, não o defeito.

Nenhum dos itens abaixo tem dono, data nem quem cobra. Então **nenhum deles é uma frente**. Eles estão
aqui para não se perderem, marcados como `sem dono`, até alguém assumir ou o operador
arquivar com data e motivo.

## De onde veio

Mensagem do operador em 21/09/2026, acompanhada de quatro imagens de loja de aplicativo
(Zapia, monday.com e dois aplicativos de Gantt). A frase, na íntegra:

> *"Plugando o Google tarefas e calendar também, o Monday, o MCP HOTMART, MCP VTURB, meu
> OS já prontos, e em construção - OS META ADS / RADAR SUPERVIRAL / VSL STUDIO / OFFERFORGE
> etc etc"*

## Os candidatos

| # | O que plugar | Que pergunta ele responde no painel | O que precisaria existir antes | Dono | Data |
|---|---|---|---|---|---|
| 1 | **Google Tarefas** | as tarefas que já vivem fora do painel aparecem nele | OAuth por conta + decisão sobre quem é a fonte da verdade quando os dois lados editam | `sem dono` | `sem data` |
| 2 | **Google Calendar** | o que tem hora marcada entra na linha do tempo | já há uso de calendário na casa (`item-so-entra-com-dono` manda o evento para o calendário pessoal) — falta definir se o painel **lê**, **escreve** ou os dois | `sem dono` | `sem data` |
| 3 | **Monday** | os quadros que a equipe já usa | leitura da API + mapa entre o status do Monday e o estado do painel | `sem dono` | `sem data` |
| 4 | **MCP Hotmart** | venda e faturamento entram no mesmo lugar do custo | o painel hoje só conta **gasto**; entrada de dinheiro é conceito novo no modelo | `sem dono` | `sem data` |
| 5 | **MCP VTURB** | desempenho de VSL ao lado do trabalho que a produziu | definir a chave que liga um vídeo a uma tarefa | `sem dono` | `sem data` |
| 6 | **Os OS já prontos** | o que cada sistema da casa está produzindo | inventário de quais são, e por onde cada um expõe estado | `sem dono` | `sem data` |
| 7 | **OS META ADS** (em construção) | gasto e resultado de anúncio | o próprio OS ainda não existe | `sem dono` | `sem data` |
| 8 | **RADAR SUPERVIRAL** (em construção) | o que está subindo agora | idem | `sem dono` | `sem data` |
| 9 | **VSL STUDIO** (em construção) | a esteira de produção de VSL | idem | `sem dono` | `sem data` |
| 10 | **OFFERFORGE** (em construção) | as ofertas em forja | idem | `sem dono` | `sem data` |

## O que trava os dez, hoje, e é a mesma coisa

Os itens 1 a 6 plugam em um painel que **ainda perde dado**. Em 21/09/2026 dois defeitos
confirmados e em conserto:

- a página da tarefa **apaga a duração salva** quando o campo numérico recebe texto que o
  navegador não aceita — e anuncia *"Duração salva."* por cima (P6, CRÍTICO);
- a mesma classe de erro grava **desconto 1** onde a tela mostra 0,5, e esse número entra
  na conta de prioridade (P6, ALTO).

Plugar fonte de dado nova em cima disso multiplica o defeito por cada integração. É por
isso que a recomendação foi, e continua sendo, fechar as quatro peças primeiro.

## As imagens, e para que elas servem

As quatro chegaram junto com a lista e **passaram a servir de régua visual** para as
rodadas de crítica — o que estava faltando desde que se descobriu que este ambiente não
alcança `asana.com`:

| imagem | vira régua de quê |
|---|---|
| monday.com no celular | **P6** — o painel de tarefa que sobe de baixo, com caminho, status e data |
| app de Gantt, tela 1 | **P5** — numeração hierárquica, triângulos de recolher, losango de marco, responsável ao lado da barra |
| app de Gantt, tela 2 (diagrama de rede) | **P4** — caixas com início/fim/duração/esforço/recursos ligadas por setas tracejadas |
| Gantt de iPhone em paisagem | **P5** — quanto cabe numa tela de telefone |
| Zapia | nenhuma tela; referência de **promessa** ("outras IAs falam, a Zapia executa") |

**Ressalva que vale escrever:** são imagens de loja de aplicativo, isto é, material de
propaganda — a tela ideal, não a tela de um dia comum. Servem para geometria, densidade e
legibilidade. **Não** servem para julgar o que acontece quando o projeto tem 300 tarefas.

## Como um destes itens vira frente de verdade

O operador diz, para o item, as **três** coisas que a regra exige — nunca duas:
**quem executa** (pessoa real, não um papel), **até quando**, e **quem cobra** (alguém que
enxerga o calendário onde a data foi escrita e recebe o lembrete; distinto de quem executa
sempre que o executor não for o operador). Com as três, o item sai desta lista e entra na
frente, com a entrada no calendário pessoal do operador (`lucasscudeler@gmail.com`, o padrão
desde a correção de 14/09) e os três nomes no registro da frente. Faltando qualquer uma, ele
continua aqui.

*Registro. A norma que governa esta lista: `AGENTS.md` §"Item de frente só entra com dono, data e quem cobra" (e, no hub, `.claude/rules/item-so-entra-com-dono.md`).*
