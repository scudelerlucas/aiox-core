-- PASSO 1b — PRÉ-CONDIÇÕES PARA 0027–0030 EM PRODUÇÃO (SÓ LEITURA)
--
-- Rode antes de aplicar qualquer uma das quatro migrations. Só prossiga se o
-- veredito for `PRONTO — PODE APLICAR 0027`. A 0030 aborta com teto fora de
-- US$ 20–500, estimativa abaixo de US$ 5 ou fila ocupada; conferir antes evita
-- que 0027–0029 fiquem gravadas e a 0030 não.
with problemas as (
  select format('teto fora de US$ 20–500: %s=%s', conta, teto_usd) as problema
    from public.painel_teto_diario
   where teto_usd < 20 or teto_usd > 500
  union all
  select format('estimativa abaixo de US$ 5: %s=%s', complexidade, usd)
    from public.painel_custo_estimado
   where usd < 5
  union all
  select format('fila não está vazia: %s item(ns)', count(*))
    from public.painel_fila_prompts
  having count(*) > 0
)
select case
         when count(*) = 0 then 'PRONTO — PODE APLICAR 0027'
         else 'FALHA — NÃO APLIQUE 0027–0030'
       end as veredito,
       coalesce(string_agg(problema, E'\n' order by problema), 'pré-condições atendidas') as detalhe
  from problemas;
