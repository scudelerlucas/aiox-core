---
paths:
  - "**"
---
<!-- espelho condicional (fase 2-A): carrega ao tocar arquivo deste repo; fonte sem frontmatter no hub -->
# Memória compartilhada entre chats (todos os repos)

Fonte central: `Lucas-Contexto-Geral/memoria/`.

**Início de sessão substantiva:** ler os **10 resumos mais recentes** — arquivos `AAAA-MM-DD--…md`, ordenados pelo nome (`README.md`, `_TEMPLATE.md`, `ARQUIVO-*.md` e `anexos/` não contam nem ocupam vaga). Inacessível → seguir sem memória, sem perguntar.

**Fim de sessão com trabalho real:** gravar **1** arquivo `memoria/AAAA-MM-DD--<repo-ou-tema>--<slug>.md` pelo `memoria/_TEMPLATE.md` (feito · decisões · pendências · links · **Ferramentas usadas** · **Vetos aceitos: N** — decisões do operador revertidas por evidência; zero é resposta válida). Máx ~40 linhas, escrito para quem não viu a conversa. Commit + push na branch da sessão. Repo central não gravável → `memoria/` do repo atual.

**Poda:** o que custa é tamanho, não quantidade. Teto ~120 linhas por arquivo; passou → registro completo em `memoria/anexos/` + destilado no lugar. Nada se apaga. Hook Stop `scripts/memoria-hook.sh` não deixa sessão com commit encerrar sem resumo.

**Nunca gravar:** segredos, tokens, dados de clientes/membros, transcrição — só o destilado.

*Norma. História, casos e sinais de violação: `docs/regras/historico/memoria-compartilhada.md`.*
