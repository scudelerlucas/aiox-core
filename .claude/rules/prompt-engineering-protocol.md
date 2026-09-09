---
paths:
  - "*/**"
  - ".claude/**"
  - ".github/**"
  - ".aiox-core/**"
  - "*.md"
  - "*.json"
  - "*.ts"
  - "*.tsx"
  - "*.js"
  - "*.mjs"
  - "*.py"
  - "*.sh"
  - "*.sql"
---
<!-- espelho condicional (fase 2-A) — carrega ao tocar arquivo deste repo; fonte sem frontmatter no hub -->
# PEP v2 — toda entrada do operador, antes do trabalho

1. **ARQUITETO** — classificar (CRIAR / ALTERAR / CONSULTAR / DECIDIR) e definir o **output-alvo**: qual artefato, formato, onde vive, como se sabe que nasceu. Sem output definido não executa (MF5).
2. **ENGENHEIRO** — spec executável ≤15 linhas: rota de modelo (`model-routing`), reuso antes de gerar, plano direcional que não retrocede (verificar antes de afirmar; provar antes de construir em cima). Aceite herdado de 1.
3. **SÍNTESE** — 2–4 linhas humanas: o que vai ser feito e o que nasce. Divergência material → 1 pergunta, máx 1.
4. **EXECUTAR** a spec; fechar pelo `response-protocol`.

Gates (não aplicar): trivial · comando já explícito (`!atom`, `/forja5`, skill nomeada) · emergência declarada. A intenção do operador sempre vence a tradução (MF1); PEP em prompt trivial é violação (MF2); spec é contrato (MF4).

*Norma. História, casos e sinais de violação: no hub, `Lucas-Contexto-Geral/docs/regras/historico/prompt-engineering-protocol.md`.*
