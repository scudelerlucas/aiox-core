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
-- Cobertura: 20 marcadores para 21 migrations. A ÚNICA sem marcador é a 0011,
-- que só faz `create or replace function` sobre funções que migrations
-- POSTERIORES redeclaram de novo — qualquer marca no corpo dela seria apagada
-- depois, então não há o que conferir. Ela fica declarada como NÃO VERIFICÁVEL
-- na saída, em vez de ficar de fora calada.
--
-- HISTÓRICO DAS DUAS CORREÇÕES (15/09/2026, achados do Codex no PR #26):
--   1ª: a lista de "sem marcador" dizia OITO e incluía 0017 e 0020. Errado —
--       as duas sempre tiveram linha (0017 confere `v_criado_em` no corpo de
--       lifeboard_mutate; 0020, `pg_advisory_xact_lock` em painel_caixa_lancar).
--   2ª: das seis restantes, quatro NÃO "só redeclaram função" — 0002 fixa
--       search_path, 0005 cria os guardas de dono e o trigger do DAG, 0008 e
--       0010 criam CHECKs, 0014 cria índice. Todas ganharam marcador agora.
--       Um banco que pulasse a 0005 passava 15/15 verde com os guardas de
--       isolamento por dono AUSENTES. Era o pior caso e sumiu.
--
-- Marcador escolhido só quando o objeto NASCE naquela migration — conferido
-- arquivo por arquivo. `trg_tasks_dag_check` foi recusado como marca da 0005
-- porque a 0001 já o cria; e `tasks_assimetria_dominio`, porque a 0005 já o
-- cria antes da 0008.
--
-- LIMITE QUE ESTE SCRIPT NÃO VENCE, dito por escrito em vez de fingido:
-- um marcador prova que AQUELE objeto existe, não que a migration inteira
-- rodou. Uma migration que morra no meio (psql com ON_ERROR_STOP=0, colagem
-- cortada) pode deixar o objeto marcado de pé e o resto ausente, e a linha sai
-- verde. Não há cura geral barata: seria preciso um marcador por objeto de cada
-- migration. O que dá para fazer é blindar onde o estrago é pior — por isso a
-- 0005, que é a migration das travas de isolamento por dono, exige as QUATRO
-- constraints dela, não uma. (3ª e 4ª rodadas do Codex no PR #26.)
--
-- No SQL Editor do Supabase o risco é menor: a colagem roda como UMA transação
-- e aborta inteira no primeiro erro. O caminho perigoso é o psql sem
-- ON_ERROR_STOP.
-- ════════════════════════════════════════════════════════════════════════════
select '0001' as migration, 'tabela public.tasks existe' as marcador,
  case when to_regclass('public.tasks') is not null then 'APLICADA' else 'FALTA' end as estado
union all
select '0002', 'search_path fixado em lifeboard_touch_updated_at',
  case when exists (
    select 1 from pg_proc
     where proname = 'lifeboard_touch_updated_at'
       and 'search_path=public, pg_temp' = any(coalesce(proconfig, '{}')))
  then 'APLICADA' else 'FALTA' end
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
select '0005', 'as 4 travas de isolamento por dono existem',
  case when (
    select count(*) from pg_constraint
     where conname in ('task_edges_origem_mesmo_dono_fkey',
                       'task_edges_destino_mesmo_dono_fkey',
                       'task_notes_task_mesmo_dono_fkey',
                       'tasks_id_owner_unica')) = 4
  then 'APLICADA' else 'FALTA' end
union all
select '0006', 'função lifeboard_mutate existe',
  case when exists (select 1 from pg_proc where proname = 'lifeboard_mutate')
       then 'APLICADA' else 'FALTA' end
union all
select '0007', 'tabela public.painel_teto_diario existe',
  case when to_regclass('public.painel_teto_diario') is not null then 'APLICADA' else 'FALTA' end
union all
select '0008', 'CHECK tasks_assimetria_tamanho existe',
  case when exists (
    select 1 from pg_constraint where conname = 'tasks_assimetria_tamanho')
  then 'APLICADA' else 'FALTA' end
union all
select '0009', 'coluna painel_fila_prompts.custo_estimado_usd existe',
  case when exists (
    select 1 from information_schema.columns
     where table_name='painel_fila_prompts' and column_name='custo_estimado_usd')
  then 'APLICADA' else 'FALTA' end
union all
select '0010', 'CHECK tasks_titulo_tamanho existe',
  case when exists (
    select 1 from pg_constraint where conname = 'tasks_titulo_tamanho')
  then 'APLICADA' else 'FALTA' end
union all
select '0011', 'sem marcador possível (só redeclara função que migration posterior redeclara de novo)',
  'NAO VERIFICAVEL'
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
select '0014', 'índice painel_fila_prompts_na_fila_ordem_idx existe',
  case when exists (
    select 1 from pg_indexes where indexname = 'painel_fila_prompts_na_fila_ordem_idx')
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
