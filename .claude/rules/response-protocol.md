# Protocolo de Resposta ao Lucas — FONTE ÚNICA

> **Esta é a única declaração desta regra.** Antes existiam 3, com 3 listas de seções
> diferentes que se contradiziam. O operador escolheu o formato de **4 seções + passo a
> passo** em 2026-07-25. Vale para **todos os repos e todas as sessões**. Prevalece sobre
> qualquer instrução de brevidade quando há trabalho real entregue.
>
> Se precisar mudar o formato, mude **só este arquivo, no hub** `Lucas-Contexto-Geral` — os espelhos são regravados pelo `sync-rules`. Não duplicar em CLAUDE.md.

Toda resposta com trabalho real **termina** com estas seções, nesta ordem, em
**palavras simples** (sem jargão) — não pular nenhuma:

## ✅ Resumo simples
O que foi feito ou descoberto, em linguagem direta e curta. Régua (16/09): o **Lucas-leigo** —
leigo neste domínio, competente em todo o resto — lê uma vez, entende e não se sente subestimado.
Termo técnico novo ou interno traduz entre parênteses na hora; o que ele usa todo dia (PR, merge,
deploy) fica como está.
Não recapitular o que já foi dito — este resumo é curto e novo.

## 🔀 Decisões que você precisa tomar
Só o que **depende do Lucas**. Para cada decisão, as opções em uma linha cada (A / B / …).
Se não há nada a decidir: escrever **"Nada a decidir agora."**

## 👉 Minha recomendação
Qual opção eu recomendo e **por quê** (1–2 linhas). Recomendação, não survey de opções.

## ⚠️ Riscos
O risco de cada caminho, 1 linha cada — incluindo o risco de **não** fazer nada.

## 🧭 Passo a passo — sempre em `!PPL` (quando houver)
**`!PPL` = Passo a Passo de Leigo, v1.1** (ordem do operador 15/09; recalibrado 16/09: *"ficou leigo
demais… pode ser para um leigo da minha versão"*). Cabeçalho: `## 🧭 Passo a passo (!PPL)`.
**Quem lê é o Lucas-leigo:** leigo *neste* domínio (git, infra, código), competente em todo o resto, e que
usa GitHub, Vercel e claude.ai todo dia pela interface. Finalidade do comando: **reduzir carga cognitiva e
dissonância cognitiva** — nunca ensinar a clicar. As regras:
1. **Se ele faz toda semana pela interface, é um passo** — sem cor, sem posição de botão, sem "você vê".
2. **Um passo = um objetivo que ele já sabe executar**, começando pelo verbo. Clique só vira passo em
   tela que ele nunca viu.
3. **Link direto no passo**, sempre que existe.
4. **Traduz só o que é novo ou interno** (sha, ref, webhook), entre parênteses, uma vez. PR, merge,
   branch, deploy, build, skill **não** se traduzem — ele usa todo dia.
5. **"Como se sabe que deu certo" só quando não é óbvio ou pode falhar em silêncio** — o normal é um
   por procedimento, no fim ("pronto quando…"). Um por passo é redundância.
6. **Gate antes do irreversível só quando não é rotina** (trocar branch padrão, apagar, pagar).
7. **Porquê de 1 linha quando o passo contraria o modelo mental** — sem porquê, dissonância; com
   parágrafo, carga.
Forma: ≤5 passos ou blocos de ≤4 com título. Régua: **ele lê uma vez, executa sem reler e não se sente
subestimado.** Ciência (Sweller, Kalyuga, Mayer, Cowan, Festinger), antes × depois e o comando explícito
`!PPL <texto>`: skill `ppl` no hub (`.claude/skills/ppl/SKILL.md`).

---

## Linguagem simples é o padrão, não a exceção (ordem do operador, 2026-09-15)

> Palavras dele: *"preciso que os passos seguintes sejam explanados em linguagem simples para leigo
> (adote isso como padrão permanente em todos os repos, exceto se eu pedir, ou se for estritamente
> necessário um adendo técnico, aí você pode adicionar)"*.

A regra sempre disse "palavras simples" no **Resumo** e no **Passo a passo**. Passa a valer na
**resposta inteira**, e em **todo repositório** — não é estilo, é contrato de leitura.

**O teste é o mesmo, aplicado a tudo — recalibrado em 16/09 pelo operador ("ficou leigo demais"):** o **Lucas-leigo** entende sem reler e sem se sentir subestimado? Leigo *neste* domínio, competente em todo o resto, usuário diário de GitHub, Vercel e claude.ai pela interface. Se não entende, reescreve; se se sente subestimado, também reescreve — os dois erros custam carga (Sweller) e dissonância (Festinger). Definição do leitor: skill `ppl` §1.

| | |
|---|---|
| **Padrão** | frase curta, voz ativa, sujeito antes do verbo. O leitor não precisa saber o que é CI, PR, merge, branch, cron, endpoint, constraint, hook, token, cache ou tier para entender o que aconteceu e o que fazer |
| **Termo técnico inevitável** | traduz **na hora**, entre parênteses, na primeira vez que aparece — "merge (juntar a mudança ao código principal)". Nunca uma lista de glossário no fim |
| **Nome de arquivo, comando, ID** | pode aparecer, porque é endereço — mas sempre acompanhado do que ele **faz** em português |
| **Adendo técnico** | permitido **quando for estritamente necessário**, e sempre **depois** da versão simples, marcado como tal (*"Detalhe técnico:"*). Nunca no lugar dela |
| **Se o Lucas pedir técnico** | aí sim, direto no técnico — o pedido dele vence o padrão |

**Vale também para o que a casa escreve sem ele na frente:** relatório do Regente
(`regente/plantao.md`), corpo de PR, resumo de `memoria/`, issue aberta por Action. A regra nasceu
de um relatório do Regente que estava certo e ilegível — *"`mergeable` unknown"*, *"razão 148:8"*,
*"`CONNECT 403`"* — e um relatório que o operador não lê é igual a relatório que não existe
(é o sinal de apodrecimento que o `REGENTE.md` já nomeia).

**Violação:** sigla sem tradução na primeira aparição · passo a passo que exige saber git para ser
executado · adendo técnico **no lugar** da versão simples, não depois dela · relatório de agente em
jargão porque "é só para a máquina ler" · responder em técnico porque o assunto é técnico (o assunto
ser técnico é justamente quando a tradução vale mais).

---

## Regras de aplicação

- Confirmações triviais de 1 linha podem condensar. Qualquer entrega com trabalho real
  usa as 4 seções.
- **Nunca pedir dados técnicos ao Lucas** (DevTools, Network, logs do navegador).
  Diagnosticar por conta própria: código, MCP, logs de servidor, banco.
- Quando a entrega for um deploy, o passo a passo traz o **link final de produção**.
- `!PPL <texto>` sozinho, em qualquer repo, converte um procedimento inteiro em Passo a Passo de
  Leigo — o produto é a lista de passos. Sem alvo → 1 pergunta e para.
- Sem preâmbulo ("Aqui está…", "Baseado em…").
