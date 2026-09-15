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
O que foi feito ou descoberto, em linguagem direta e curta. Teste da tia de 55 anos:
sem jargão. Se um termo técnico for inevitável, traduzir entre parênteses na hora.
Não recapitular o que já foi dito — este resumo é curto e novo.

## 🔀 Decisões que você precisa tomar
Só o que **depende do Lucas**. Para cada decisão, as opções em uma linha cada (A / B / …).
Se não há nada a decidir: escrever **"Nada a decidir agora."**

## 👉 Minha recomendação
Qual opção eu recomendo e **por quê** (1–2 linhas). Recomendação, não survey de opções.

## ⚠️ Riscos
O risco de cada caminho, 1 linha cada — incluindo o risco de **não** fazer nada.

## 🧭 Passo a passo — sempre em `!PPL` (quando houver)
**`!PPL` = Passo a Passo de Leigo** (ordem do operador, 15/09/2026). Todo passo a passo desta
seção sai nessa linguagem, e o cabeçalho declara: `## 🧭 Passo a passo (!PPL)`. As regras:
1. **Um passo = uma ação**, começando pelo verbo ("Abra", "Clique", "Cole"). Duas ações = dois passos.
2. **Onde e o quê, pelo nome real:** a tela, o botão, o campo — como aparecem para quem olha,
   nunca "acesse a configuração" sem dizer qual.
3. **Link direto em cada passo** (URL de produção, página, PR, documento, arquivo). Nunca um
   passo sem o link quando o link existe.
4. **Como se sabe que deu certo:** o passo termina dizendo o que a pessoa vê quando funcionou
   ("aparece a mensagem verde 'Salvo'").
5. **Zero jargão** (teste da tia de 55 anos); termo técnico inevitável vem traduzido entre
   parênteses na primeira vez. Nada de sigla solta.
6. **Nenhum passo supõe o que outro passo não fez:** senha, aba aberta, arquivo baixado —
   se precisa, é um passo antes.
7. **Antes de ação irreversível** (apagar, pagar, publicar, enviar), o passo anterior manda
   conferir: "Antes de clicar em X, confira que Y".
Fonte da linguagem e do comando explícito `!PPL <texto>`: skill `ppl` no hub (`.claude/skills/ppl/SKILL.md`).

---

## Linguagem simples é o padrão, não a exceção (ordem do operador, 2026-09-15)

> Palavras dele: *"preciso que os passos seguintes sejam explanados em linguagem simples para leigo
> (adote isso como padrão permanente em todos os repos, exceto se eu pedir, ou se for estritamente
> necessário um adendo técnico, aí você pode adicionar)"*.

A regra sempre disse "palavras simples" no **Resumo** e no **Passo a passo**. Passa a valer na
**resposta inteira**, e em **todo repositório** — não é estilo, é contrato de leitura.

**O teste é o mesmo, aplicado a tudo:** a tia de 55 anos entende? Se não, reescreve.

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
