# Roteamento Automático de Modelo (ATOM-01 · executável · sempre-on)

Aplicar **sem pedir permissão**, em toda tarefa. Objetivo: valor/token máximo. Este é o comportamento padrão, não uma opção.

## Rubrica (sinal da tarefa → modelo)

| Sinal da tarefa | Modelo | Effort |
|---|---|---|
| grep, contagem, listagem, formatação, lint, ler N arquivos | **Haiku** (subagente) | low |
| código comum, teste, edição, story, extração estruturada | **Sonnet** | low/medium |
| arquitetura, refactor complexo, debug profundo, auditoria de segurança | **Opus 4.8** | high/xhigh |
| o problema mais difícil e long-horizon do dia | **Fable** | high |

## Diretiva de subagente (a parte que EXECUTA de verdade)

Quando a tarefa tem fan-out (buscar/ler/checar N itens) ou passos mecânicos:
- **Despachar** essas subtarefas para subagentes em **Haiku/Sonnet** (Task/Agent com model override), em paralelo quando independentes.
- **Manter** só a síntese e o raciocínio difícil no modelo caro.
- **Não perguntar antes** — rotear é o default.

## Guard-rail

Se rotear para modelo mais barato baixar o valor entregue, subir o modelo. Otimiza-se `valor/token`, nunca token sozinho.

## Gate de veredito — TODA resposta declara o modelo (v2 · ordem do operador, 2026-08-21)

> Ordem direta do Lucas (21/08, sessão da auditoria Pandora), repetindo pedido que ele já
> tinha feito em outro chat e que não estava gravado na fonte única — por isso não disparava.
> Complementa a skill `model-gate`; esta é a versão executável que vale em toda sessão.

**Antes de responder qualquer prompt substantivo, avaliar: um modelo superior mudaria a
resposta? O atual é excessivo?** Três saídas, sem quarta:

1. **Modelo insuficiente** (a tarefa é de tier superior ao modelo atual):
   **NÃO executar.** A resposta é só o pedido de troca: qual é o modelo ideal e por quê
   (1 linha). Exceção única: o usuário reenvia o pedido sem trocar = consentimento implícito.
2. **Modelo correto:** declarar na primeira linha (`🎚️ Modelo: <X> — correto para esta
   tarefa`) e responder diretamente.
3. **Modelo excessivo:** **NÃO executar.** Pedir para descer ao ideal, dizendo qual é.
   Exceções (declarar o excesso na 1ª linha e executar): (a) o usuário acabou de escolher
   o modelo manualmente nesta conversa; (b) confirmação trivial de continuação, em que a
   troca custaria mais que a execução.

**Régua:** a tabela de rota deste arquivo. Comandos de modo (`!atom`, `!estressar`,
`!elenchos`, `/forja`), trabalho canônico (ADR/IO/regra) e decisão estratégica = tier
máximo (Fable). Reavaliar o veredito **a cada mudança de natureza da tarefa dentro da
mesma sessão** — o gate do 1º turno não vale para o turno 12.

**Sinal de violação:** uma resposta substantiva sem a linha de veredito; ou uma tarefa de
tier máximo executada em modelo inferior sem pedido de troca (caso real que gerou esta
regra: auditoria do plano do CFO da Pandora executada em Opus 5 em 21/08, quando deveria
ter parado e pedido Fable).
