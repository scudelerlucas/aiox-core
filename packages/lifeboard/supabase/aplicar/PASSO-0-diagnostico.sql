-- ════════════════════════════════════════════════════════════════════════════
-- PASSO 0 — DIAGNÓSTICO (só leitura, não muda nada)
-- ════════════════════════════════════════════════════════════════════════════
-- Cole e rode ANTES de tudo. Ele te diz até qual migration sua produção já
-- tem — sem isso eu não sei se você precisa do PASSO-2 (só 0020+0021) ou de
-- um passo maior (0016 em diante). O erro que você teve
-- ("painel_caixa_lancamentos does not exist") já prova que a 0019 falta;
-- isto aqui confere TODAS as migrations da faixa 0016–0021, uma por uma.
-- ════════════════════════════════════════════════════════════════════════════
select
  '0016' as migration,
  'coluna painel_teto_diario.exigir_medicao_recente existe' as marcador,
  case when exists (
    select 1 from information_schema.columns
     where table_name = 'painel_teto_diario' and column_name = 'exigir_medicao_recente')
  then 'APLICADA' else 'FALTA' end as estado
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
