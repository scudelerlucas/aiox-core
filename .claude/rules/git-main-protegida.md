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
# A `main` é protegida — entra por PR, não por push

**Nunca `git push` para `main`.** Branch da sessão → PR → o operador revisa → merge. Vale mesmo quando a credencial consegue passar por cima, mesmo "só doc", mesmo validado. Única exceção: o operador pedir explicitamente, naquela conversa, para a `main` — e não vale para a próxima.

Push que devolver `Bypassed rule violations` = regra quebrada: avisar na mesma resposta.

*Norma. História, casos e sinais de violação: no hub, `Lucas-Contexto-Geral/docs/regras/historico/git-main-protegida.md`.*
