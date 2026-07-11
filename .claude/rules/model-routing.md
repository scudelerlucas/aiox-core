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
