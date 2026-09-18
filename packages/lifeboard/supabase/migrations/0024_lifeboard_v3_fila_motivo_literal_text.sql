-- ════════════════════════════════════════════════════════════════════════════
-- 0024 · LIFEBOARD v3 · recuperada do banco — existia em produção, faltava aqui
-- ════════════════════════════════════════════════════════════════════════════
--
-- Mesma origem da 0022/0023: aplicada em produção por colagem no SQL Editor
-- (versão 20260913224443, nome `lifeboard_v3_fila_motivo_literal_text`),
-- nunca chegou ao repositório. Recuperada pelo PASSO-0c — texto exato do
-- histórico, não reconstrução.
--
-- O QUE CORRIGE: a 0022 criou `painel_fila_motivo_do_pull` concatenando
-- literais direto no array (`v := v || 'texto'`). Em Postgres,
-- `text[] || 'literal'` sem cast faz o parser tentar ler o literal COMO um
-- array — e quebra com "malformed array literal" assim que a fila tem
-- exatamente 1 item devolvido ou exatamente 1 item travado (os dois ramos
-- que usam string solta em vez de `format(...)`). O pull inteiro morria
-- nesse caso. Esta migration acrescenta o `::text` que faltava nos dois
-- ramos — comprovado localmente: a versão sem cast falha com
-- "malformed array literal" no caso p_devolvidos=1; com o cast, devolve a
-- frase certa. Achado do bloco T13 de `supabase/tests/fila_prompts.test.sql`.
--
-- Re-aplicável: `create or replace function`.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.painel_fila_motivo_do_pull(
  p_mortos integer, p_mortos_usd numeric,
  p_custo_escolhido numeric, p_headroom numeric,
  p_menor_disponivel numeric, p_elegiveis integer,
  p_em_espera integer, p_menor_espera numeric, p_espera_min integer,
  p_devolvidos integer, p_travados integer,
  p_estimativa_usd numeric, p_estimativa_itens integer
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text[] := '{}'::text[];
begin
  -- A ordem é a ordem: mortos · escolhido/nada cabe · em espera · devolvidos ·
  -- travados · parcela estimada. Nenhum ramo cala outro (era um `case`).
  if p_mortos = 1 then
    v := v || format('1 item morreu sem fechar neste disparo e lançou %s no dia',
      public.painel_usd_br(p_mortos_usd));
  elsif p_mortos > 1 then
    v := v || format('%s itens morreram sem fechar neste disparo e lançaram %s no dia',
      p_mortos, public.painel_usd_br(p_mortos_usd));
  end if;

  if p_custo_escolhido is not null then
    v := v || format('peguei o item mais antigo que cabe: %s de %s livres',
      public.painel_usd_br(p_custo_escolhido), public.painel_usd_br(p_headroom));
  elsif p_menor_disponivel is not null and coalesce(p_elegiveis, 0) = 0 then
    -- Só é honesto dizer "nada cabe" quando NADA cabe: com um elegível travado
    -- por outra transação (B5), quem conta a verdade é a frase de travados.
    -- D13/BAIXO 1: headroom negativo nunca vira número na tela nem no relatório.
    v := v || format('nada cabe agora: o mais barato disponível custa %s e %s',
      public.painel_usd_br(p_menor_disponivel),
      case when p_headroom > 0 then 'há ' || public.painel_usd_br(p_headroom) || ' livres'
           else 'não há espaço livre agora' end);
  end if;

  if p_em_espera = 1 then
    v := v || format('1 item de %s volta em %s min',
      public.painel_usd_br(p_menor_espera), p_espera_min);
  elsif p_em_espera > 1 then
    v := v || format('%s itens de %s voltam em %s min',
      p_em_espera, public.painel_usd_br(p_menor_espera), p_espera_min);
  end if;

  if p_devolvidos = 1 then
    -- `::text` obrigatório: `text[] || 'literal'` sem tipo faz o Postgres ler
    -- o literal como ARRAY ("malformed array literal") e o pull inteiro morre
    -- com exatamente 1 devolvido. Achado do bloco T13 deste arquivo.
    v := v || '1 item voltou para a fila e aguarda nova tentativa'::text;
  elsif p_devolvidos > 1 then
    v := v || format('%s itens voltaram para a fila e aguardam nova tentativa', p_devolvidos);
  end if;

  if p_travados = 1 then
    v := v || '1 item elegível está em uso por outra operação; tente no próximo disparo'::text;
  elsif p_travados > 1 then
    v := v || format('%s itens elegíveis estão em uso por outra operação; tente no próximo disparo', p_travados);
  end if;

  -- D20 (rodada 4, mantida): a parcela estimada é dita em voz alta, sempre.
  if coalesce(p_estimativa_usd, 0) > 0 then
    v := v || format('%s do consumo de hoje são estimativa de %s',
      public.painel_usd_br(p_estimativa_usd),
      case when p_estimativa_itens = 1 then '1 item que morreu sem fechar'
           else p_estimativa_itens || ' itens que morreram sem fechar' end);
  end if;

  if array_length(v, 1) is null then
    return 'fila vazia para esta conta';
  end if;
  return array_to_string(v, '; ');
end;
$$;
comment on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer) is
  'D27 (rodada 6): a frase ADITIVA do pull, numa função PURA — mortos; escolhido ou nada cabe; em espera; devolvidos; travados; parcela estimada, coladas por "; ". Testada ramo a ramo em supabase/tests/fila_prompts.test.sql e espelhada texto a texto por montarMotivoDoPull (src/core/prompts/tipos.ts).';
revoke all on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer) from public, anon, authenticated;
