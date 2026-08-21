# O gate de modelo precisa de MECANISMO, não de boa vontade — FONTE ÚNICA DO GATILHO

> **A política vive em `.claude/rules/model-routing.md` § "Gate de veredito"** (ordem do
> operador, 21/08/2026): toda resposta substantiva declara o modelo na primeira linha; modelo
> insuficiente ou excessivo não executa e pede a troca. **Não duplicar a política aqui.**
>
> Este arquivo trata de outra coisa: **por que a política não dispara sozinha, e qual mecanismo
> faz disparar.**

## O caso que gerou este arquivo

Em **19/08/2026** o operador mandou um prompt com **quatro comandos de modo** (`!atom v2`,
`!estressar`, `!PRT`, `!elenchos`), mais criação de ADR, mais arquitetura de framework — o
carimbo de tier máximo mais claro que existe. **Nenhum gate rodou.** Não houve dano (a sessão
já estava no modelo topo), mas é exatamente o falsificador **F-MG1** da skill `model-gate`:
*"output T3 entregue sem o gate ter rodado"*.

Dois dias depois, em **21/08**, o mesmo problema apareceu por outro caminho: a auditoria do
plano do CFO rodou em Opus quando devia ter parado e pedido Fable. A sessão daquele dia
escreveu a política. **Esta escreve o gatilho** — porque política sem gatilho é o que já tinha
falhado duas vezes.

## A causa raiz (vale para qualquer skill, não só esta)

**Skill não dispara sozinha.** Ela só entra em contexto quando alguém a invoca. Escrever na
descrição *"SEMPRE consultar no primeiro prompt de toda conversa"* não cria mecanismo nenhum —
cria expectativa. E a expectativa depende do agente lembrar; o agente que está no modelo errado
é justamente o que menos lembra.

É a família que este repositório cataloga: **artefato presente, função ausente.**

## A regra

**O que precisa acontecer a cada prompt vira hook. O que se consulta quando o assunto aparece
vira skill. O que vale em toda sessão vira regra em `CLAUDE.md`.** Nunca o contrário.

| Precisa rodar… | Mecanismo | Exemplo vivo |
|---|---|---|
| a cada prompt do operador | **hook `UserPromptSubmit`** | `.claude/hooks/model-gate-check.sh` |
| ao fim de cada resposta | **hook `Stop`** | `bench/claude-cost-hook.sh` (dashboard de custo) |
| quando o assunto aparece | **skill** | `model-gate`, `pandora-compasso` |
| em toda sessão, sem exceção | **regra em `.claude/rules/`** | `model-routing.md` § Gate de veredito |

## O hook

`.claude/hooks/model-gate-check.sh`, registrado em `.claude/settings.json` sob
`UserPromptSubmit`. Lê o prompt, procura os gatilhos **por string** — como a §2 da skill exige
(*"detecção por string, não por juízo"*, porque modelo fraco erra exatamente o juízo de
complexidade) — e injeta o aviso no contexto do turno.

**Detecta:** comando iniciado por `!` · ADR / canonização / doc canônico · auditoria / stress
test / red team / go-no-go · arquitetura / framework / protocolo / skill nova · sociedade /
contrato / precificação / parceria.

**Nunca bloqueia** (sai sempre com 0). O hook lembra; quem decide é o agente, pela política do
`model-routing`. Ele resolve o modo de falha mais comum — *esquecer de avaliar* — e não tenta
resolver o julgamento, que é do agente.

## Onde vale

Este repositório. Outros repos da conta que quiserem o mesmo comportamento copiam o hook e a
entrada de `settings.json` — não reescrevem a regra nem a política.

## Sinal de que a regra foi violada

- Um prompt com `!` seguido de entrega substantiva **sem** a linha de veredito de modelo.
- Uma skill nova cuja descrição diz "sempre" ou "a cada resposta" e que **não** tem hook
  correspondente. Nesse caso a palavra "sempre" está mentindo — e o custo aparece meses depois,
  em silêncio.
