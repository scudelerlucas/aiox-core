#!/usr/bin/env node
/**
 * Gera o PASSO-0c — a conferência de DESENCONTRO entre o repositório e o banco.
 *
 * POR QUE EXISTE. Em 15/09/2026 a nota de memória registrou três migrações que
 * existem no banco de produção e não existem no repositório
 * (`fila_dia_e_dono_motivo_puro`, `fila_fechar_ultimo_dono`,
 * `fila_motivo_literal_text`), mais a `0016` registrada duas vezes. O
 * `PASSO-0b` LISTA o histórico do banco, mas não COMPARA com os arquivos — e
 * como esse banco é dividido com cerca de 15 sistemas, a lista tem dezenas de
 * nomes alheios. Notar três faltantes ali é trabalho de agulha no palheiro, e
 * foi por isso que o desencontro sobreviveu.
 *
 * O QUE ISTO RESOLVE, e o que NÃO resolve. Um banco reconstruído a partir do
 * repositório não terá o que essas três fizeram, e o `PASSO-0` vai declarar
 * 20/20 verde mesmo assim — ele confere os objetos que o repositório conhece,
 * e não pode sentir falta do que nunca foi escrito. Esta conferência fecha
 * exatamente esse vão. Ela NÃO identifica projeto (nenhum script daqui faz
 * isso — ver o aviso no topo do DEPLOY.md).
 *
 * COMO O CASAMENTO É FEITO, e por que ele é declarado e não escondido. O nome
 * do arquivo `0015_lifeboard_v3_fila_dia_e_dono.sql` vira
 * `lifeboard_v3_fila_dia_e_dono` — tira-se o prefixo numérico e a extensão. É
 * a convenção que o repositório usa hoje, e é HEURÍSTICA: um arquivo renomeado
 * depois de aplicado aparece dos dois lados como se fosse duas coisas. Por
 * isso a saída lista os dois lados inteiros em vez de só dizer "ok".
 *
 * O SQL gerado é SÓ LEITURA: nenhum `insert`, `update`, `delete`, `alter` ou
 * `drop`. Pode rodar em produção sem gate.
 *
 * Uso:  node scripts/gerar-conferencia-drift.mjs > supabase/aplicar/PASSO-0c-drift.sql
 */

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const pastaMigrations = join(aqui, "..", "supabase", "migrations");

/** `0015_lifeboard_v3_fila_dia_e_dono.sql` -> `lifeboard_v3_fila_dia_e_dono` */
function nomeNoBanco(arquivo) {
  return arquivo.replace(/\.sql$/, "").replace(/^\d+_/, "");
}

const migrations = readdirSync(pastaMigrations)
  .filter((f) => f.endsWith(".sql") && !f.includes(".test."))
  .sort();

if (migrations.length === 0) {
  console.error("[drift] nenhuma migration encontrada em", pastaMigrations);
  process.exit(1);
}

const linhas = migrations
  .map((f) => `    ('${nomeNoBanco(f).replace(/'/g, "''")}', '${f.replace(/'/g, "''")}')`)
  .join(",\n");

process.stdout.write(`-- ${"═".repeat(74)}
-- PASSO 0c — DESENCONTRO entre o repositório e o banco (SÓ LEITURA)
-- ${"═".repeat(74)}
-- GERADO por scripts/gerar-conferencia-drift.mjs — não editar à mão.
-- Gerado a partir de ${migrations.length} migrations em supabase/migrations/.
--
-- Responde três perguntas, nesta ordem:
--   1. O que existe NO BANCO e não existe no repositório?  <- o desencontro
--   2. O que existe NO REPOSITÓRIO e não consta no banco?
--   3. Que nome foi registrado mais de uma vez?
--
-- Nenhuma escrita. Pode rodar em produção.
-- ${"═".repeat(74)}

with repo(nome, arquivo) as (
  values
${linhas}
),
banco as (
  select
    m.version                            as versao,
    m.name                               as nome,
    to_jsonb(m) ->> 'statements'         as sql_guardado
  from supabase_migrations.schema_migrations m
)

-- ─── 1. NO BANCO, NÃO NO REPOSITÓRIO ────────────────────────────────────────
-- Só o que PARECE ser do LifeBoard. O banco é dividido com outros sistemas, e
-- migration alheia aqui não é problema — é o vizinho.
select
  '1. SO NO BANCO'                       as bloco,
  b.versao,
  b.nome,
  case when b.sql_guardado is null
       then 'banco nao guarda o SQL — recuperar pelo painel'
       else b.sql_guardado end           as o_que_fazer
from banco b
where not exists (select 1 from repo r where r.nome = b.nome)
  and (b.nome ilike '%lifeboard%' or b.nome ilike '%fila%'
       or b.nome ilike '%painel%'  or b.nome ilike '%caixa%'
       or b.nome ilike '%livro_razao%')

union all

-- ─── 2. NO REPOSITÓRIO, NÃO NO BANCO ────────────────────────────────────────
-- Esperado quando as migrations foram aplicadas por colagem no SQL Editor: o
-- histórico só é escrito pela ferramenta de linha de comando. Aqui, "faltando"
-- quer dizer "não registrado", não necessariamente "não aplicado" — quem diz
-- se o objeto existe é o PASSO-0.
-- UMA linha, de propósito. Na medição de 17/09 contra uma réplica, este bloco
-- devolvia 19 linhas e afogava as 3 do bloco 1, que são as que importam. Aqui
-- "faltando" quase sempre quer dizer "aplicada por colagem no SQL Editor", que
-- não escreve histórico — é o normal desta casa, não um achado.
select
  '2. SO NO REPOSITORIO'                 as bloco,
  count(*) || ' de ${migrations.length}'                as versao,
  'resumo (o detalhe vem ao lado)'       as nome,
  case when count(*) = 0
       then 'todas as migrations do repositorio constam no historico'
       else 'nao constam no historico: ' || string_agg(r.arquivo, ', ' order by r.arquivo)
            || ' — normal se foram aplicadas por colagem; quem diz se os objetos existem e o PASSO-0'
       end
from repo r
where not exists (select 1 from banco b where b.nome = r.nome)

union all

-- ─── 3. REGISTRADA MAIS DE UMA VEZ ──────────────────────────────────────────
select
  '3. DUPLICADA NO HISTORICO'            as bloco,
  string_agg(b.versao, ', ' order by b.versao),
  b.nome,
  count(*) || ' registros para o mesmo nome'
from banco b
group by b.nome
having count(*) > 1

order by bloco, nome;
`);
