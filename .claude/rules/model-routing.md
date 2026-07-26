# Roteamento Automático de Modelo (ATOM-01 · executável · sempre-on)

Aplicar **sem pedir permissão**, em toda tarefa. Objetivo: valor/token máximo. Este é o comportamento padrão, não uma opção.

## Rubrica (sinal da tarefa → modelo)

| Sinal da tarefa | Modelo | Effort |
|---|---|---|
| grep, contagem, listagem, formatação, lint, ler N arquivos | **Haiku 4.5** (subagente) | low |
| código comum, teste, edição, story, extração estruturada | **Sonnet 5** | low/medium |
| arquitetura, refactor complexo, debug profundo, auditoria de segurança | **Opus 5** | high/xhigh |
| o problema mais difícil e long-horizon do dia | **Fable 5** | high |

## Modelos vigentes (verificado em 2026-07-26)

| Tier | ID da API | Preço (entrada / saída por MTok) | Contexto |
|---|---|---|---|
| Fable 5 | `claude-fable-5` | $10 / $50 | 1M |
| Opus 5 | `claude-opus-5` | $5 / $25 | 1M |
| Sonnet 5 | `claude-sonnet-5` | $3 / $15 (promo $2 / $10 até 31/08/2026) | 1M |
| Haiku 4.5 | `claude-haiku-4-5` | $1 / $5 | 200k |

**Legados — não rotear para cá:** Opus 4.8 / 4.7 / 4.6 / 4.5, Sonnet 4.6 / 4.5. Mesmo preço do
tier atual (Opus 4.8 = $5/$25 = Opus 5) por menos capacidade.

`effort` vai de `low` a `max` no Opus 5 e no Sonnet 5; default = `high` na API e no Claude Code.
Lista oficial: <https://platform.claude.com/docs/en/about-claude/models/overview>

## Diretiva de subagente (a parte que EXECUTA de verdade)

Quando a tarefa tem fan-out (buscar/ler/checar N itens) ou passos mecânicos:
- **Despachar** essas subtarefas para subagentes em **Haiku/Sonnet** (Task/Agent com model override), em paralelo quando independentes.
- **Manter** só a síntese e o raciocínio difícil no modelo caro.
- **Não perguntar antes** — rotear é o default.

## Guard-rail

Se rotear para modelo mais barato baixar o valor entregue, subir o modelo. Otimiza-se `valor/token`, nunca token sozinho.

## Manutenção da tabela

A Anthropic lançou 7 modelos nos primeiros 7 meses de 2026 — um a cada ~24 dias. Regra
apontando para modelo legado = pagar igual por menos, silenciosamente.

- **Revalidar** a tabela "Modelos vigentes" contra a lista oficial a cada ~30 dias.
- **Próxima revisão sugerida:** 2026-08-26.
- **Próximo lançamento provável:** Haiku 5 (ago–set/2026) — Haiku 4.5 é de out/2025 e é o
  único tier fora da geração 5. Quando sair, trocar a linha do Haiku na rubrica e na tabela.
