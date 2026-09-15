-- ════════════════════════════════════════════════════════════════════════════
-- PASSO 0 — DIAGNÓSTICO COMPLETO, migrations 0001 a 0021 (só leitura)
-- ════════════════════════════════════════════════════════════════════════════
-- v2: a v1 só conferia 0016-0021, supondo que 0001-0015 já estavam na sua
-- produção. Você rodou o PASSO-2 e ele falhou dizendo que
-- "painel_teto_diario" não existe — essa tabela nasce na migration 0007,
-- MUITO antes da faixa que eu tinha suposto. Essa suposição era minha, não
-- conferida, e estava errada. Esta versão confere as 21 migrations inteiras,
-- uma por uma, para eu parar de adivinhar.
--
-- Migrations sem marcador próprio: 0002, 0005, 0008, 0010, 0011, 0014 — SEIS.
-- Só redeclaram função sobre uma tabela já existente e não têm como conferir
-- sozinhas com uma consulta simples. Ficam de fora da tabela; se as vizinhas da
-- faixa delas estiverem OK, elas quase certamente também estão (mesmo arquivo
-- de sequência, mesma ordem de aplicação).
--
-- CORREÇÃO (15/09/2026, achado do Codex no PR #26): esta lista dizia OITO e
-- incluía 0017 e 0020. Errado — as duas TÊM linha aqui embaixo (0017 confere
-- `v_criado_em` no corpo de lifeboard_mutate; 0020 confere
-- `pg_advisory_xact_lock` no corpo de painel_caixa_lancar). A conta certa é
-- 15 marcadores + 6 sem marcador = 21 migrations.
-- ════════════════════════════════════════════════════════════════════════════
select '0001' as migration, 'tabela public.tasks existe' as marcador,
  case when to_regclass('public.tasks') is not null then 'APLICADA' else 'FALTA' end as estado
union all
select '0003', 'CHECK de sources.kind inclui ''lms''',
  case when exists (
    select 1 from pg_constraint where conname = 'sources_kind_check'
      and pg_get_constraintdef(oid) like '%''lms''%')
  then 'APLICADA' else 'FALTA' end
union all
select '0004', 'tabela public.task_edges existe',
  case when to_regclass('public.task_edges') is not null then 'APLICADA' else 'FALTA' end
union all
select '0006', 'função lifeboard_mutate existe',
  case when exists (select 1 from pg_proc where proname = 'lifeboard_mutate')
       then 'APLICADA' else 'FALTA' end
union all
select '0007', 'tabela public.painel_teto_diario existe',
  case when to_regclass('public.painel_teto_diario') is not null then 'APLICADA' else 'FALTA' end
union all
select '0009', 'coluna painel_fila_prompts.custo_estimado_usd existe',
  case when exists (
    select 1 from information_schema.columns
     where table_name='painel_fila_prompts' and column_name='custo_estimado_usd')
  then 'APLICADA' else 'FALTA' end
union all
select '0012', 'coluna painel_fila_prompts.worker_id existe',
  case when exists (
    select 1 from information_schema.columns
     where table_name='painel_fila_prompts' and column_name='worker_id')
  then 'APLICADA' else 'FALTA' end
union all
select '0013', 'coluna painel_fila_prompts.disponivel_em existe',
  case when exists (
    select 1 from information_schema.columns
     where table_name='painel_fila_prompts' and column_name='disponivel_em')
  then 'APLICADA' else 'FALTA' end
union all
select '0015', 'coluna painel_fila_prompts.ultimo_worker_id existe',
  case when exists (
    select 1 from information_schema.columns
     where table_name='painel_fila_prompts' and column_name='ultimo_worker_id')
  then 'APLICADA' else 'FALTA' end
union all
select '0016', 'coluna painel_teto_diario.exigir_medicao_recente existe',
  case when exists (
    select 1 from information_schema.columns
     where table_name = 'painel_teto_diario' and column_name = 'exigir_medicao_recente')
  then 'APLICADA' else 'FALTA' end
union all
select '0017', 'lifeboard_mutate aceita criado_em opcional',
  case when exists (
    select 1 from pg_proc where proname = 'lifeboard_mutate' and prosrc like '%v_criado_em%')
  then 'APLICADA' else 'FALTA' end
union all
select '0018', 'coluna painel_fila_prompts.custo_origem existe',
  case when exists (
    select 1 from information_schema.columns
     where table_name = 'painel_fila_prompts' and column_name = 'custo_origem')
  then 'APLICADA' else 'FALTA' end
union all
select '0019', 'tabela painel_caixa_lancamentos existe',
  case when to_regclass('public.painel_caixa_lancamentos') is not null
       then 'APLICADA' else 'FALTA' end
union all
select '0020', 'painel_caixa_lancar trava por entidade (pg_advisory_xact_lock)',
  case when exists (
    select 1 from pg_proc where proname = 'painel_caixa_lancar' and prosrc like '%pg_advisory_xact_lock%')
  then 'APLICADA' else 'FALTA' end
union all
select '0021', 'painel_fila_recusaria_por_medicao existe',
  case when exists (select 1 from pg_proc where proname = 'painel_fila_recusaria_por_medicao')
       then 'APLICADA' else 'FALTA' end
order by 1;
