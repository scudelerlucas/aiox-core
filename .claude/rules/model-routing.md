# Roteamento de modelo + gate de veredito (v3 · ordem do operador, 21/08/2026)

| Sinal da tarefa | Modelo | Effort |
|---|---|---|
| grep, contagem, listagem, formatação, lint, ler N arquivos | **Haiku** (subagente) | low |
| código comum, teste, edição, story, extração estruturada | **Sonnet** | low/medium |
| arquitetura, refactor complexo, debug profundo, auditoria de segurança | **Opus** | high/xhigh |
| `/forja`, `!atom`, `!estressar`, `!elenchos`, ADR/IO/regra, decisão estratégica | **Fable** | high |

- Fan-out (buscar/ler/checar N itens) e passos mecânicos → subagentes Haiku/Sonnet, em paralelo. Só síntese e raciocínio difícil no modelo caro. Rotear é o default, sem perguntar.
- Guard-rail: rotear para mais barato baixou o valor → subir. Otimiza-se valor/token, nunca token.

**Gate (toda resposta substantiva):** avaliar se o modelo está certo. Duas saídas, sem terceira:
1. Correto → 1ª linha `🎚️ Modelo: <X> — correto para esta tarefa` e responder.
2. Errado (insuficiente OU excessivo) → **NÃO executar.** A resposta é só o pedido de troca (qual modelo e por quê, 1 linha). Sem "só desta vez", sem "declaro o erro e sigo". Exceção única: o operador reenvia o pedido sem trocar = consentimento implícito — declarar e executar.

Régua: a tabela acima. Turno que mistura tiers vale o tier da frente. Reavaliar a cada mudança de natureza da tarefa na mesma sessão. Gatilho mecânico: hook `.claude/hooks/model-gate-check.sh`.

*Norma. História, casos e sinais de violação: `docs/regras/historico/model-routing.md`.*
