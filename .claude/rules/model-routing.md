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

**Codex corrige, Claude valida (ordem do operador, 24/09/2026 — vale em todo repositório):** em código avançado (banco, dinheiro, migration, concorrência, segurança, ou PR já revisado por robô) e em projeto longo (mais de uma sessão ou PRs encadeados), achado de revisão **não é corrigido pelo Claude**: ele comenta `@codex` no PR (um por achado, com o bloco padrão), e quem corrige é o **OpenAI Codex com GPT-6 Astra Pro, esforço `max`** — escolhido pelo operador nas configurações do Codex, nunca por comentário. Um autor por branch enquanto a tarefa do Codex estiver aberta. A entrega do Codex é **um PR publicado pela tarefa** (o ambiente dele não empurra direto — decisão A do operador, 26/09): o Claude re-aponta a base para a branch do PR original, **valida por fora** (checagens do repo + teste que falha sem a correção), mescla, resolve a thread com o resultado escrito e mergeia pelo PR. Sem resposta do Codex em ~40 min → avisar o operador, não corrigir no lugar. Doc, ajuste trivial e emergência declarada ficam com o Claude. Norma completa, no hub: [`.claude/rules/codex-corrige-claude-valida.md`](https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/.claude/rules/codex-corrige-claude-valida.md).

Régua: a tabela acima. Turno que mistura tiers vale o tier da frente. Reavaliar a cada mudança de natureza da tarefa na mesma sessão. Gatilho mecânico **no hub**: hook `.claude/hooks/model-gate-check.sh` (irmãos sem hook dependem da leitura desta regra).

*Norma. História, casos e sinais de violação: no hub, `Lucas-Contexto-Geral/docs/regras/historico/model-routing.md`.*
