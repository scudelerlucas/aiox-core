-- PASSO 1c — ESTADO FINAL DE 0027–0030 EM PRODUÇÃO (SÓ LEITURA)
--
-- Rode somente depois de aplicar, e conferir, cada arquivo na ordem. Este é o
-- critério de pronto do deploy. `PASSO-1-detector.sql` prova apenas que o livro
-- não foi duplicado; ele não prova que a 0030 chegou ao fim.
with provas(nome, passou, detalhe) as (
  values
    (
      'limite_quatro',
      coalesce((select p.prosrc ~ 'select[[:space:]]+4'
                  from pg_proc p
                 where p.oid = to_regprocedure('public.painel_fila_maximo_em_voo_por_conta()')), false),
      'painel_fila_maximo_em_voo_por_conta() deve devolver 4'
    ),
    (
      'pull_com_limite',
      coalesce((select p.prosrc like '%painel_fila_em_voo%'
                       and p.prosrc like '%v_no_limite%'
                  from pg_proc p
                 where p.oid = to_regprocedure('public.fila_prompts_pegar_interno(text,text)')), false),
      'o pull vivo deve contar sessões em voo e recusar no limite'
    ),
    (
      'piso_funcao',
      coalesce((select p.prosrc ~ 'select[[:space:]]+5(::numeric)?'
                  from pg_proc p
                 where p.oid = to_regprocedure('public.painel_custo_minimo_por_item()')), false),
      'painel_custo_minimo_por_item() deve devolver US$ 5'
    ),
    (
      'piso_estimativas',
      coalesce((select pg_get_constraintdef(c.oid) like '%painel_custo_minimo_por_item%'
                  from pg_constraint c
                 where c.conrelid = to_regclass('public.painel_custo_estimado')
                   and c.conname = 'painel_custo_estimado_usd_check'), false),
      'a tabela de estimativas deve exigir o piso'
    ),
    (
      'piso_itens',
      coalesce((select pg_get_constraintdef(c.oid) like '%painel_custo_minimo_por_item%'
                  from pg_constraint c
                 where c.conrelid = to_regclass('public.painel_fila_prompts')
                   and c.conname = 'painel_fila_prompts_custo_estimado_check'), false),
      'a fila deve exigir o piso'
    ),
    (
      'quarta_conta_travada',
      coalesce((select exigir_medicao_recente
                  from public.painel_teto_diario
                 where conta = 'arborcactus@gmail.com'), false),
      'a quarta conta deve exigir medição recente enquanto a Routine não foi comprovada'
    ),
    (
      'sessao_dona_com_trava',
      coalesce((select p.provolatile = 'v' and p.prosrc like '%pg_advisory_xact_lock%'
                  from pg_proc p
                 where p.oid = to_regprocedure('public.painel_sessao_dona(text)')), false),
      'painel_sessao_dona(text) deve ser volatile e usar advisory lock'
    ),
    (
      'postos_preenchidos',
      not exists (select 1 from public.painel_caixa_lancamentos where precedencia is null),
      'nenhuma linha do livro pode ficar sem precedência'
    )
), resumo as (
  select bool_and(passou) as tudo_ok,
         string_agg(nome || ': ' || detalhe, E'\n' order by nome) filter (where not passou) as falhas
    from provas
)
select case when tudo_ok
              then 'PRONTO — 0027–0030 CONFERIDAS'
              else 'FALHA — ESTADO PARCIAL'
       end as veredito,
       coalesce(falhas, 'limite, piso, quarta conta, trava de sessão e postos conferidos') as detalhe
  from resumo;
