-- ════════════════════════════════════════════════════════════════════════════
-- PASSO 1 — DETECTOR (só leitura, não muda nada)
-- ════════════════════════════════════════════════════════════════════════════
-- Cole isto no SQL Editor do Supabase e rode. Ele NÃO escreve nada.
--
-- Responde uma pergunta só: o livro-razão já tem dinheiro DOBRADO por alguma
-- reaplicação passada da migration 0019?
--
-- Como ler o resultado:
--   veredito = 'LIVRO SÃO'      -> pode seguir para o PASSO 2
--   veredito = 'DINHEIRO DOBRADO' -> PARE e me mande o resultado
-- ════════════════════════════════════════════════════════════════════════════
with suspeitas as (
  select ab.entidade_tipo, ab.entidade_id, ab.dia, ab.valor_usd
    from public.painel_caixa_lancamentos ab
   where ab.abertura
     and exists (
           select 1 from public.painel_caixa_lancamentos an
            where an.entidade_tipo = ab.entidade_tipo
              and an.entidade_id   = ab.entidade_id
              and not an.abertura
              and an.criado_em < ab.criado_em)
)
select
  case when count(*) = 0 then 'LIVRO SÃO'
       else 'DINHEIRO DOBRADO' end                as veredito,
  count(*)                                        as entidades_afetadas,
  coalesce(sum(valor_usd), 0)                     as usd_contado_duas_vezes,
  coalesce(min(dia)::text, '-')                   as primeiro_dia_afetado,
  coalesce(max(dia)::text, '-')                   as ultimo_dia_afetado
from suspeitas;
