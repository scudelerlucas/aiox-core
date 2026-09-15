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

## Regras de aplicação

- Confirmações triviais de 1 linha podem condensar. Qualquer entrega com trabalho real
  usa as 4 seções.
- **Nunca pedir dados técnicos ao Lucas** (DevTools, Network, logs do navegador).
  Diagnosticar por conta própria: código, MCP, logs de servidor, banco.
- Quando a entrega for um deploy, o passo a passo traz o **link final de produção**.
- `!PPL <texto>` sozinho, em qualquer repo, converte um procedimento inteiro em Passo a Passo de
  Leigo — o produto é a lista de passos. Sem alvo → 1 pergunta e para.
- Sem preâmbulo ("Aqui está…", "Baseado em…").
