# As 3 migrações órfãs viraram arquivo — e o bug que uma delas corrige, provado antes/depois

- **Data:** 2026-09-17
- **Repo/tema:** aiox-core (lifeboard)
- **Branch/PR:** `claude/happy-cerf-9fz8uk` — PR #35 https://github.com/scudelerlucas/aiox-core/pull/35

## O que foi feito
Continuação da sessão que abriu o PR #34 (CI + PASSO-0c). O Lucas rodou o PASSO-0c no painel do
Supabase pelo celular — colou a consulta certa (a primeira tentativa dele foi colar o comando de
terminal na caixa de SQL, erro meu na missão: assumi computador, ele estava no celular) e devolveu
o resultado. Das 11 linhas "só no banco", 3 eram o gap real (as mesmas da nota de 15/09), 2 eram
migração de outro sistema que divide o banco, e 6 eram falso-positivo da própria heurística de nome
do PASSO-0c (prefixo numérico mantido vs. tirado). Recuperei o SQL exato de cada uma (coluna
`statements` do histórico, com uma camada dupla de escape por causa da grade do editor — decifrada
e conferida) e escrevi como `0022`, `0023`, `0024` em `supabase/migrations/`. Uma delas (`0024`)
corrige um bug real: `text[] || 'literal'` sem `::text` quebra com "malformed array literal" quando
a fila tem exatamente 1 item devolvido ou travado — reproduzi o erro com a versão de antes (`0022`)
e a correção com a de depois, num Postgres 16 local com réplica do schema. As 24 migrações (as 21
antigas + as 3 novas) aplicam limpo em sequência.

## Decisões tomadas
- Reiniciar a branch a partir da `main` antes de commitar — a ponta anterior já tinha sido mergeada
  pelo PR #34 (Claude, seguindo a regra de nunca commitar em cima de branch já mergeada).
- Escrever as 3 migrações com o texto EXATO recuperado do banco, sem "melhorar" nada — é o que já
  roda em produção; mudar seria reintroduzir uma divergência nova.

## Vetos aceitos: 0

## Pendências / próximos passos
- [ ] **Revisar e mergear o PR #35** — dono: Lucas. https://github.com/scudelerlucas/aiox-core/pull/35
- [ ] Rodar a missão do erro 500 de staging (15/09) — segue em aberto, dono Lucas.

## Links
- PR #35 (esta sessão): https://github.com/scudelerlucas/aiox-core/pull/35
- PR #34 (sessão anterior, CI + ferramenta de drift): https://github.com/scudelerlucas/aiox-core/pull/34

## Ferramentas usadas
Bash, Postgres 16 local (réplica de teste), MCP do GitHub, Python (decodificar o escape duplo do
resultado colado).
