#!/usr/bin/env bash
# =============================================================================
# OS-LIFEBOARD · P7 — roda a suíte de COMPORTAMENTO da fila contra um Postgres
# =============================================================================
# MÉDIO 1 (rodada 12): esta suíte existia desde a rodada 5 e não rodava em
# automação nenhuma. O crítico provou o buraco com uma linha: trocar
# `and f.custo_estimado_usd <= v_headroom` por `… <= v_headroom + 100000` na
# migration deixa o pull ignorar o teto do dia, e os 1387 testes do vitest
# continuam verdes — porque eles leem a GRAFIA do .sql, não o comportamento.
#
# O QUE ESTA SUÍTE COBRE — e o que não (ALTO 2, rodada 13). O cabeçalho antigo
# dizia que ela "é a única coisa que distingue um pull que respeita o teto de
# um que estoura o orçamento". Não era: o crítico apagou `- v_execucao` do
# cálculo do headroom e os 68 blocos ficaram verdes enquanto seis pulls
# despachavam US$ 720 contra um teto de 500. Aquele caso ganhou bloco (T69).
# Os buracos que SOBRAM, para quem confia nesta saída saber do que confia:
#   · 19 das 44 funções do esquema não são chamadas por bloco nenhum — entre
#     elas `fila_prompts_pegar` e `fila_prompts_fechar`, as portas com segredo
#     que embrulham as `_interno` que a suíte de fato exercita;
#   · ninguém se conecta como `anon`: permissão é LIDA (has_function_
#     privilege, T19/T73), não exercida;
#   · a tela não entra aqui (vitest + tsc + checar-contraste.mjs);
#   · o ambiente é um Postgres 16 com os stubs de `00-ambiente-de-teste.sql`.
# Em uma frase: ela pega mudança de comportamento no caminho que os blocos
# percorrem. Cobertura fora dali é zero, e dizer o contrário é o que fez o
# crítico da rodada 12 gastar uma linha para provar.
#
# COMO USAR
#   scripts/rodar-suite-sql.sh                      # sobe nada, usa $DATABASE_URL
#   DATABASE_URL=postgres://… scripts/rodar-suite-sql.sh
#
# O QUE ELE FAZ, em ordem:
#   1. aplica `supabase/tests/00-ambiente-de-teste.sql` (papéis, stubs de auth
#      e o DDL do painel de frentes, que é pré-requisito declarado da 0007);
#   2. aplica `supabase/migrations/0001…NNNN` EM ORDEM NUMÉRICA — é o mesmo
#      caminho do DEPLOY.md, e é ele que pega migration fora de ordem;
#   3. grava o segredo de carga que as RPCs exigem;
#   4. roda `supabase/tests/fila_prompts.test.sql` e CONTA os blocos.
#
# SAI COM ERRO quando: uma migration não aplica · um bloco reporta FALHA ·
# o número de blocos verdes é menor que o número de blocos do arquivo (um
# bloco que estoura antes do veredito não conta como aprovado).
#
# NADA AQUI TOCA PRODUÇÃO. O banco alvo é o de `DATABASE_URL`, e cada bloco da
# suíte termina em `raise exception` — nenhuma escrita persiste.
# =============================================================================
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/postgres}"
SEGREDO="${LIFEBOARD_LOAD_SECRET:-segredo-de-suite-sql}"

psql_q() { psql "$DB" -q -v ON_ERROR_STOP=1 "$@"; }

echo "▸ 1/4 ambiente de teste (papéis, auth, painel de frentes)"
psql_q -f "$AQUI/supabase/tests/00-ambiente-de-teste.sql" || exit 1

echo "▸ 2/4 migrations, em ordem numérica"
for arquivo in "$AQUI"/supabase/migrations/[0-9][0-9][0-9][0-9]_*.sql; do
  case "$arquivo" in *.test.sql) continue;; esac
  if ! psql_q -f "$arquivo"; then
    echo "✗ migration não aplicou: $(basename "$arquivo")"
    exit 1
  fi
done

echo "▸ 3/4 segredo de carga"
psql_q -c "insert into private.lifeboard_config (chave, valor) values ('load_secret', '$SEGREDO')
           on conflict (chave) do update set valor = excluded.valor;" || exit 1

echo "▸ 4/4 suíte de comportamento"
SUITE="$AQUI/supabase/tests/fila_prompts.test.sql"
SAIDA="$(psql "$DB" -v ON_ERROR_STOP=0 -f "$SUITE" 2>&1)"

# Cada bloco termina em `raise exception` — ou com `RESULTADO: ok — …`, ou com
# `FALHA: …`. `ON_ERROR_STOP=0` de propósito: o primeiro "ok" pararia a suíte.
VERDES="$(printf '%s' "$SAIDA" | grep -c 'RESULTADO: ok —')"
VERMELHOS="$(printf '%s' "$SAIDA" | grep -c 'FALHA:')"
# Quantos blocos o ARQUIVO tem: um `raise exception 'RESULTADO: ok` por bloco.
# (O cabeçalho do arquivo CITA a frase ao explicar como ler o resultado — por
# isso a contagem é pela linha do `raise`, não pela frase solta.)
ESPERADOS="$(grep -c "raise exception 'RESULTADO: ok" "$SUITE")"

echo "   blocos no arquivo: $ESPERADOS · verdes: $VERDES · vermelhos: $VERMELHOS"

if [ "$VERMELHOS" -gt 0 ]; then
  echo "✗ a suíte de comportamento reprovou:"
  printf '%s\n' "$SAIDA" | grep 'FALHA:'
  exit 1
fi

if [ "$VERDES" -lt "$ESPERADOS" ]; then
  echo "✗ $((ESPERADOS - VERDES)) bloco(s) não chegaram ao veredito (erro antes do raise):"
  printf '%s\n' "$SAIDA" | grep -E '^psql.*ERROR' | grep -v 'RESULTADO: ok —' | head -20
  exit 1
fi

echo "✓ $VERDES/$ESPERADOS blocos ok"
