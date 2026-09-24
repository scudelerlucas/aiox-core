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
# CRÍTICO 1 + ALTO 1 (rodada 13): ESTE SCRIPT CONTAVA A SI MESMO, e mentia com
# zero teste. O número esperado saía de `grep -c` sobre o PRÓPRIO arquivo da
# suíte: apagar um bloco derrubava os dois lados da conta e o script dizia
# `✓ 73/73 blocos ok`. Foi assim que o crítico apagou o T74 (o piso do dia
# negativo), tirou dois `greatest(..., 0)` das migrations e despachou US$ 840
# contra um teto de US$ 500 com os quatro portões verdes. Pior: sem `set -e`,
# o arquivo da suíte AUSENTE dava `ESPERADOS` vazio, a comparação `[ 0 -lt "" ]`
# errava sem ser fatal e o script imprimia `✓ 0/ blocos ok` e saía 0.
# As duas travas de agora:
#   · o esperado vem de FORA e por NOME — `supabase/tests/BLOCOS.txt`, lista
#     nominal versionada. Cada identificador listado tem de ter reportado
#     `RESULTADO: ok`, e bloco que rode sem estar listado também reprova;
#   · o script morre cedo e alto (`set -euo pipefail` + conferências
#     explícitas) quando falta o arquivo da suíte, falta o manifesto, o
#     manifesto está vazio ou NENHUM bloco ficou verde.
#
# O QUE ESTA SUÍTE COBRE — e o que não (ALTO 2, rodada 13). O cabeçalho antigo
# dizia que ela "é a única coisa que distingue um pull que respeita o teto de
# um que estoura o orçamento". Não era: o crítico apagou `- v_execucao` do
# cálculo do headroom e os 68 blocos ficaram verdes enquanto seis pulls
# despachavam US$ 720 contra um teto de 500. Aquele caso ganhou bloco (T69).
# Os buracos que SOBRAM, para quem confia nesta saída saber do que confia:
#   · parte das 44 funções do esquema não é chamada por bloco nenhum — entre
#     elas `fila_prompts_extrato_do_dia`, `lifeboard_load`, `lifeboard_mutate`,
#     `painel_fila_em_espera` e `painel_fila_na_fila`. (MÉDIO 4 da rodada 13:
#     até aqui este parágrafo citava `fila_prompts_pegar` e
#     `fila_prompts_fechar` como "as portas com segredo que embrulham as
#     `_interno`" — as duas NÃO EXISTEM: a 0009, linhas 518-519, apagou as
#     duas e nada as recriou. Quem chama as `_interno` é a Routine da conta,
#     como papel `postgres`, sem porta intermediária.);
#   · ninguém se conecta como `anon`: permissão é LIDA (has_function_
#     privilege, T19/T73), não exercida;
#   · a tela não entra aqui — quem a guarda é o vitest, o `tsc` e o
#     `npm run contraste` (`scripts/checar-contraste.mjs`), os três no job
#     `package-tests` do CI;
#   · o ambiente é um Postgres 16 com os stubs de `00-ambiente-de-teste.sql`.
# Em uma frase: ela pega mudança de comportamento no caminho que os blocos
# percorrem. Cobertura fora dali é zero, e dizer o contrário é o que fez o
# crítico da rodada 12 gastar uma linha para provar.
#
# COMO USAR — só contra um banco DESCARTÁVEL, criado para isto:
#   createdb lifeboard_teste
#   LIFEBOARD_SUITE_SQL_BANCO_DESCARTAVEL=sim \
#   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/lifeboard_teste \
#     scripts/rodar-suite-sql.sh
#
# A TRAVA DE ALVO (P1 do Codex no PR #42, 23/09). Este script cria papéis,
# stubs de `auth` e aplica TODAS as migrations — num banco de verdade isso
# reescreveria funções de produção e poria stubs no lugar do `auth` real. Antes,
# `DATABASE_URL` herdado do terminal (o de um `.env` de produção, por exemplo)
# ou até a falta dele (caía num padrão local) bastava para ele sair aplicando.
# Agora ele recusa, antes de tocar o banco, se:
#   · `LIFEBOARD_SUITE_SQL_BANCO_DESCARTAVEL` não for exatamente `sim` — é a
#     declaração de quem roda de que o banco pode ser destruído;
#   · `DATABASE_URL` não vier explícito (não há mais endereço padrão);
#   · o endereço apontar para o Supabase (`supabase.co`, `supabase.com`,
#     `pooler.supabase`) — a suíte nunca tem motivo para ir lá;
#   · o esquema `public` do alvo já tiver qualquer tabela — banco novo é o
#     único caminho que a suíte valida (DEPLOY.md), e banco com tabela é, por
#     definição, um banco que alguém usa.
#
# O QUE ELE FAZ, em ordem:
#   1. aplica `supabase/tests/00-ambiente-de-teste.sql` (papéis, stubs de auth
#      e o DDL do painel de frentes, que é pré-requisito declarado da 0007);
#   2. aplica `supabase/migrations/0001…NNNN` EM ORDEM NUMÉRICA — é o mesmo
#      caminho do DEPLOY.md, e é ele que pega migration fora de ordem;
#   3. grava o segredo de carga que as RPCs exigem;
#   4. roda `supabase/tests/fila_prompts.test.sql` e confere a saída contra a
#      lista nominal de `supabase/tests/BLOCOS.txt`.
#
# SAI COM ERRO quando: uma migration não aplica · um bloco reporta FALHA · um
# identificador do manifesto não reportou `ok` (bloco apagado, renomeado ou
# que estourou antes do veredito) · um bloco reportou `ok` sem estar no
# manifesto · falta o arquivo da suíte ou o manifesto · nenhum bloco ficou
# verde.
#
# NADA AQUI TOCA PRODUÇÃO. O banco alvo é o de `DATABASE_URL`, e cada bloco da
# suíte termina em `raise exception` — nenhuma escrita persiste.
# =============================================================================
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEGREDO="${LIFEBOARD_LOAD_SECRET:-segredo-de-suite-sql}"

SUITE="$AQUI/supabase/tests/fila_prompts.test.sql"
MANIFESTO="$AQUI/supabase/tests/BLOCOS.txt"

morrer() { echo "✗ $*" >&2; exit 1; }

psql_q() { psql "$DB" -q -v ON_ERROR_STOP=1 "$@"; }

# ── 0 · o piso duro: sem estes dois arquivos não existe "verde" possível ─────
# ALTO 1 (rodada 13): antes, o arquivo da suíte ausente saía 0 com "0/ blocos".
[ -r "$SUITE" ] || morrer "arquivo da suíte ausente ou ilegível: $SUITE"
[ -r "$MANIFESTO" ] || morrer "manifesto de blocos ausente ou ilegível: $MANIFESTO
   (é ele que diz, por nome, quais blocos TÊM de reportar ok — ver o cabeçalho dele)"

# Identificadores esperados, em ordem, do manifesto. Linha vazia e `#` fora.
BLOCOS_ESPERADOS=()
while read -r id _resto; do
  case "$id" in ''|'#'*) continue;; esac
  BLOCOS_ESPERADOS+=("$id")
done < "$MANIFESTO"

[ "${#BLOCOS_ESPERADOS[@]}" -gt 0 ] || morrer "o manifesto $MANIFESTO não lista bloco nenhum"

# ── 0b · a trava de alvo: só banco descartável, declarado e vazio ────────────
[ "${LIFEBOARD_SUITE_SQL_BANCO_DESCARTAVEL:-}" = "sim" ] || morrer "recusado: este script DESTRÓI o banco alvo (papéis, stubs de auth, todas as migrations).
   Rode só contra um banco criado para isto, declarando: LIFEBOARD_SUITE_SQL_BANCO_DESCARTAVEL=sim"
[ -n "${DATABASE_URL:-}" ] || morrer "recusado: DATABASE_URL vazio — não há endereço padrão; diga qual banco descartável usar"
DB="$DATABASE_URL"
case "$(printf '%s' "$DB" | tr '[:upper:]' '[:lower:]')" in
  *supabase.co*|*supabase.com*|*pooler.supabase*)
    morrer "recusado: DATABASE_URL aponta para o Supabase — a suíte nunca roda em banco hospedado";;
esac
TABELAS_EXISTENTES="$(psql "$DB" -qtAX -v ON_ERROR_STOP=1 -c "select count(*) from pg_tables where schemaname = 'public'")" \
  || morrer "não consegui ler o banco alvo para conferir se ele está vazio"
[ "$TABELAS_EXISTENTES" = "0" ] || morrer "recusado: o esquema public do alvo já tem $TABELAS_EXISTENTES tabela(s) — a suíte só roda em banco NOVO e vazio"

echo "▸ 1/4 ambiente de teste (papéis, auth, painel de frentes)"
psql_q -f "$AQUI/supabase/tests/00-ambiente-de-teste.sql"

echo "▸ 2/4 migrations, em ordem numérica"
for arquivo in "$AQUI"/supabase/migrations/[0-9][0-9][0-9][0-9]_*.sql; do
  case "$arquivo" in *.test.sql) continue;; esac
  if ! psql_q -f "$arquivo"; then
    morrer "migration não aplicou: $(basename "$arquivo")"
  fi
done

echo "▸ 3/4 segredo de carga"
psql_q -c "insert into private.lifeboard_config (chave, valor) values ('load_secret', '$SEGREDO')
           on conflict (chave) do update set valor = excluded.valor;"

echo "▸ 4/4 suíte de comportamento (${#BLOCOS_ESPERADOS[@]} blocos no manifesto)"
SAIDA="$(psql "$DB" -v ON_ERROR_STOP=0 -f "$SUITE" 2>&1 || true)"

# Cada bloco termina em `raise exception` — ou com `RESULTADO: ok — …`, ou com
# `FALHA: …`. `ON_ERROR_STOP=0` de propósito: o primeiro "ok" pararia a suíte.
VERDES="$(printf '%s' "$SAIDA" | grep -c 'RESULTADO: ok —' || true)"
VERMELHOS="$(printf '%s' "$SAIDA" | grep -c 'FALHA:' || true)"

# Quem reportou ok, por NOME. É esta lista que se compara com o manifesto —
# nunca mais uma contagem tirada do próprio arquivo que se quer auditar.
REPORTADOS="$(printf '%s\n' "$SAIDA" | grep -o 'RESULTADO: ok — T[0-9][0-9]' | grep -o 'T[0-9][0-9]' | sort -u || true)"

echo "   blocos no manifesto: ${#BLOCOS_ESPERADOS[@]} · verdes: $VERDES · vermelhos: $VERMELHOS"

if [ "$VERMELHOS" -gt 0 ]; then
  echo "✗ a suíte de comportamento reprovou:"
  printf '%s\n' "$SAIDA" | grep 'FALHA:'
  exit 1
fi

# P2 do Codex (PR #42, 2ª rodada): com `ON_ERROR_STOP=0`, um erro de verdade
# FORA dos vereditos (uma limpeza que falhou, um comando entre blocos com erro
# de sintaxe) aparecia na saída e o job passava assim mesmo, porque só se
# procurava `FALHA:` e os nomes do manifesto. Todo ERROR/FATAL/PANIC que não
# seja um veredito `RESULTADO: ok —` reprova agora.
INESPERADOS="$(printf '%s\n' "$SAIDA" | grep -E '(ERROR|FATAL|PANIC):' | grep -v 'RESULTADO: ok —' | grep -v 'FALHA:' || true)"
if [ -n "$INESPERADOS" ]; then
  echo "✗ a suíte produziu erro do Postgres fora dos vereditos:"
  printf '%s\n' "$INESPERADOS" | head -20
  exit 1
fi

if [ "$VERDES" -eq 0 ]; then
  morrer "nenhum bloco chegou ao veredito — a suíte não rodou (banco fora, arquivo ilegível, erro logo na primeira linha).
   Saída do psql, primeiras linhas:
$(printf '%s\n' "$SAIDA" | head -10)"
fi

# ── a conferência nominal, nos dois sentidos ────────────────────────────────
FALTANDO=""
for id in "${BLOCOS_ESPERADOS[@]}"; do
  if ! printf '%s\n' "$REPORTADOS" | grep -qx "$id"; then
    FALTANDO="$FALTANDO $id"
  fi
done

SOBRANDO=""
for id in $REPORTADOS; do
  achou=0
  for esperado in "${BLOCOS_ESPERADOS[@]}"; do
    [ "$id" = "$esperado" ] && achou=1 && break
  done
  [ "$achou" -eq 0 ] && SOBRANDO="$SOBRANDO $id"
done

if [ -n "$FALTANDO" ]; then
  echo "✗ bloco(s) do manifesto que NÃO reportaram ok:$FALTANDO"
  echo "   (bloco apagado, renomeado, ou que estourou antes do veredito — o manifesto é"
  echo "    supabase/tests/BLOCOS.txt; remover bloco exige remover a linha de lá E do"
  echo "    array de tests/unit/suite-sql-blocos.test.ts)"
  printf '%s\n' "$SAIDA" | grep -E '^psql.*ERROR' | grep -v 'RESULTADO: ok —' | head -20
  exit 1
fi

if [ -n "$SOBRANDO" ]; then
  morrer "bloco(s) que reportaram ok sem estar no manifesto:$SOBRANDO
   (acrescente a linha em supabase/tests/BLOCOS.txt e o identificador no array de
    tests/unit/suite-sql-blocos.test.ts)"
fi

echo "✓ ${#BLOCOS_ESPERADOS[@]}/${#BLOCOS_ESPERADOS[@]} blocos do manifesto reportaram ok"
