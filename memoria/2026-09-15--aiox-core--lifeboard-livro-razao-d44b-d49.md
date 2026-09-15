# 2026-09-15 · aiox-core · LifeBoard v3 — livro-razão: D44b, D49 e a suíte no SQL Editor

## Feito
- **D44b** (migration 0020): `painel_fila_estimativa_usd` e `..._itens` passaram a exigir
  `a.dia = l.dia` no estorno. Medido: estimativa de 80 ontem corrigida para 30 hoje dava
  `estimativa_usd = -80`; agora dá `0`. Bloco de teste **T58**, mutação derruba.
- **D49** (migration 0019): reaplicar a 0019 dobrava o dinheiro de toda entidade que chegou
  ao banco depois da abertura (`on conflict ... where abertura` só protege linha já marcada).
  Medido: total ia de 70 para 140; agora fica em 70. Os dois `insert` da §7 checam
  `not exists` sobre a entidade. Bloco **T59** é detector de estado, só leitura.
- **Roteiro de aplicação**: PASSO-0 (diagnóstico das 21 migrations por marcador de objeto),
  PASSO-0b (histórico de `supabase_migrations.schema_migrations`), PASSO-1 (detector
  `LIVRO SÃO` / `DINHEIRO DOBRADO`), PASSO-2 (aplicação, não versionado), PASSO-3 (suíte).
- **`scripts/gerar-suite-sql-editor.mjs`**: a suíte de 59 blocos roda no SQL Editor do
  Supabase. Cada bloco vira um tratador de exceção; o `raise` continua revertendo. Nenhuma
  asserção alterada. O `.sql` gerado fica fora do versionamento.
- **DEPLOY.md**: apontava 3 vezes para um project ref morto. Trocado por `<PROJECT-REF>`.

## Provado
- Banco Postgres 16 reconstruído das 21 migrations + a do hub: original via psql **59 ok**,
  gerador em `--single-transaction` **59 ok**. Réplica com dado: 95 lançamentos / 2390.0000
  / 40 sessões / 15 itens idênticos antes e depois — zero resíduo.
- Produção (`quiz-diagnosys`, ref `hciiilopyivjaekaxfqp`): 0020 e 0021 aplicadas, PASSO-0
  fecha 15/15, verificação de 4 colunas `ok`, `teto_padrao = 500`, PASSO-1 `LIVRO SÃO`,
  suíte completa **59/59**.
- Repo: `tsc --noEmit` exit 0, 1333 testes verdes.

## Decisões
- O `.sql` gerado (PASSO-2 e PASSO-3) não entra no git: cópia versionada do caminho do
  dinheiro vira cópia velha. Versiona-se o gerador.
- PR #21 já estava mergeado quando fui mergear; os 8 commits posteriores foram replantados
  sobre a `main` no **PR #24**, mergeado em 15/09 00:37. PR mergeado não se reaproveita.

## Pendências
- **Vercel aponta para o projeto Supabase errado**: `NEXT_PUBLIC_SUPABASE_URL` =
  `ofskmjpzlgzmnivmkyop` (sistema de RAG) em vez de `hciiilopyivjaekaxfqp`. Inócuo enquanto
  `LIFEBOARD_DATA_MODE` não for `live`. Decisão do operador: sessão própria.
- **Drift de schema**: 3 migrations existem no banco e não no repo
  (`fila_dia_e_dono_motivo_puro`, `fila_fechar_ultimo_dono`, `fila_motivo_literal_text`).
  0018/0019 aplicadas sem registro; 0016 registrada duas vezes.
- LifeBoard divide `quiz-diagnosys` com ~15 outros sistemas — decidir se merece projeto próprio.

## Vetos aceitos
- Nunca rodar a 0020 depois da 0021: a 0020 sobrescreve a redeclaração de
  `painel_caixa_lancar` feita pela 0021. Causou um falso P1 nesta sessão.

## Erros meus, registrados
- Dei veredito "sugestão de baixo risco" no achado D44b do CodeRabbit **sem medir**. Estava
  errado. O operador então fixou a regra: achado de revisão no caminho do dinheiro exige
  medição antes de veredito.
- O D49 nasceu em parte da minha correção D48, que tirou o freio de aborto da migration.

## Links
- PR #21 https://github.com/scudelerlucas/aiox-core/pull/21 (mergeado 14/09 21:02)
- PR #24 https://github.com/scudelerlucas/aiox-core/pull/24 (mergeado 15/09 00:37)
