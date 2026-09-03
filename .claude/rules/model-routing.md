# Roteamento Automático de Modelo (ATOM-01 · executável · sempre-on)

Aplicar **sem pedir permissão**, em toda tarefa. Objetivo: valor/token máximo. Este é o comportamento padrão, não uma opção.

## Rubrica (sinal da tarefa → modelo)

| Sinal da tarefa | Modelo | Effort |
|---|---|---|
| grep, contagem, listagem, formatação, lint, ler N arquivos | **Haiku** (subagente) | low |
| código comum, teste, edição, story, extração estruturada | **Sonnet** | low/medium |
| arquitetura, refactor complexo, debug profundo, auditoria de segurança | **Opus 4.8** | high/xhigh |
| rodar `/forja`, decisão estratégica, o problema mais difícil e long-horizon do dia | **Fable** | high |

## Diretiva de subagente (a parte que EXECUTA de verdade)

Quando a tarefa tem fan-out (buscar/ler/checar N itens) ou passos mecânicos:
- **Despachar** essas subtarefas para subagentes em **Haiku/Sonnet** (Task/Agent com model override), em paralelo quando independentes.
- **Manter** só a síntese e o raciocínio difícil no modelo caro.
- **Não perguntar antes** — rotear é o default.

## Guard-rail

Se rotear para modelo mais barato baixar o valor entregue, subir o modelo. Otimiza-se `valor/token`, nunca token sozinho.

## Gate de veredito — TODA resposta declara o modelo (v3 · ordem do operador, 2026-08-21)

> v2: ordem direta do Lucas (21/08, sessão da auditoria Pandora). **v3, mesma noite, por
> nova ordem:** as exceções da v2 viraram brecha — respostas como *"🎚️ Modelo: Opus 5 —
> acima do tier (verificação). Sigo pela exceção (b)"* e *"excessivo, executando pela
> escolha manual"* declaravam o erro e executavam mesmo assim. Ordem literal do operador:
> **"Quando o modelo estiver errado, NÃO RESPONDER, e pedir para mudar o modelo!!!"**
> Complementa a skill `model-gate`; esta é a versão executável que vale em toda sessão.

**Antes de responder qualquer prompt substantivo, avaliar: um modelo superior mudaria a
resposta? O atual é excessivo?** Duas saídas, sem terceira:

1. **Modelo correto:** declarar na primeira linha (`🎚️ Modelo: <X> — correto para esta
   tarefa`) e responder diretamente.
2. **Modelo errado — insuficiente OU excessivo: NÃO executar. Sem exceção de conveniência.**
   A resposta é SÓ o pedido de troca: qual é o modelo ideal e por quê (1 linha). Não se
   adianta "parte do trabalho", não se executa "só desta vez", não se declara o erro e
   segue. **Exceção única (anti-deadlock):** o usuário reenvia o pedido sem trocar o
   modelo = consentimento implícito — declarar isso na 1ª linha e executar.

**A régua de "errado" continua a tabela deste arquivo — o gate não vira desculpa para
degradar entrega:** na dúvida entre dois tiers, ou em turno que MISTURA tiers (ex.:
mesclar um PR + produzir um visual dentro de uma frente de tier máximo), vale o tier da
frente, não o do gesto. O gate dispara quando a NATUREZA da tarefa muda de verdade.

**Régua:** a tabela de rota deste arquivo. Comandos de modo (`!atom`, `!estressar`,
`!elenchos`, `/forja`), trabalho canônico (ADR/IO/regra) e decisão estratégica = tier
máximo (Fable). Reavaliar o veredito **a cada mudança de natureza da tarefa dentro da
mesma sessão** — o gate do 1º turno não vale para o turno 12.

**Sinal de violação:** uma resposta substantiva sem a linha de veredito; uma tarefa de
tier máximo executada em modelo inferior sem pedido de troca (caso real que gerou a v2:
auditoria do plano do CFO da Pandora executada em Opus 5 em 21/08, quando deveria ter
parado e pedido Fable); **ou qualquer resposta que declare o modelo errado e execute
mesmo assim** — "sigo pela exceção (b)", "executando pela escolha manual" (casos reais
de 21/08 que geraram a v3). Declarar o erro não autoriza cometê-lo.
