-- =============================================================================
-- OS-LIFEBOARD · Migration 0016 — P7: RODADA 7. O dinheiro é cobrado UMA vez,
-- por ENTIDADE; e o teto para de fingir que zero é medição.
-- =============================================================================
-- Sobre 0007 + 0009 + 0011 + 0012 + 0013 + 0014 + 0015. Tudo `create or
-- replace` / `add column if not exists` — RE-APLICÁVEL. A ÚNICA remoção é a
-- assinatura de 13 argumentos de `painel_fila_motivo_do_pull`, substituída pela
-- de 15 (os 2 novos com `default`): manter as duas tornaria a chamada de 13
-- argumentos AMBÍGUA ("function is not unique"). Mesma disciplina de 0013/0015.
--
-- O crítico hostil da rodada 6 reprovou com 2 ALTO + 3 MÉDIO + 5 BAIXO. As duas
-- decisões de banco desta rodada:
--
--  D31 A DEDUP É POR ENTIDADE, NÃO POR (ENTIDADE, DIA).
--      Medido ponta a ponta pelo crítico, com as RPCs reais (enfileirar → pegar
--      → heartbeat com FILHA_ID → sessão publicada em 12/09 com 80 → fechar em
--      13/09 com 80 e o MESMO FILHA_ID):
--        TRABALHO REAL = US$ 80,00 -> dia 12 cobra 80 ; dia 13 cobra 80,0000 ;
--        TOTAL COBRADO 160,0000
--      Causa exata: o `left join lateral` de `painel_fila_itens_do_dia`
--      (0015:131) só encontrava a sessão vinculada quando ela tinha sido
--      publicada NAQUELE MESMO DIA (`painel_dia_operador(...) = p_dia`). Fora
--      disso `ses.custo_usd` era nulo e o item contribuía INTEIRO — enquanto a
--      sessão contribuía inteira no dia DELA, por `painel_consumo_por_conta_dia`.
--      O `p_session_id` estava gravado e não impedia nada: a chave de dedup não
--      era a sessão, era o par (sessão, dia).
--      AGORA, regra única: **item com sessão vinculada que tenha custo
--      publicado contribui ZERO em TODO dia** — quem paga é a sessão, no dia
--      dela. Item sem sessão vinculada, ou com sessão sem custo publicado,
--      contribui com o próprio custo no dia de `concluido_em` (D25). Item em
--      voo continua reserva do dia corrente (D25, `painel_fila_reservado`).
--      Prova: blocos T21/T22/T25 de `supabase/tests/fila_prompts.test.sql` —
--      o cenário de 160 fecha em 80, no dia da sessão, nos dois sentidos.
--
--  D32 O TETO PARA DE MENTIR (o valor do teto é decisão do OPERADOR — nenhuma
--      linha desta migration muda o número). Medido pelo crítico: 9 de 9 dias
--      com dado acima do teto de US$ 150 (mediana ~2,6×, máximo 16,8× — 12/09
--      deu US$ 2.513,29 em 12 sessões); a última sessão sincronizada era de
--      12/09 12:37 UTC (~37 h atrás) e mesmo assim o card imprimia
--      "US$ 0,00 de US$ 150,00 · US$ 150,00 livres", como se fosse zero MEDIDO.
--      A régua da casa (`teto-de-gasto-diario`, §Violação) lista literalmente
--      "teto em que nenhuma sessão real caiba" como sinal de violação.
--      (a) toda leitura de consumo devolve `medidoAteEm` (agora a última
--          medição de QUALQUER dia, não só de hoje) e `defasagemHoras`;
--      (b) o `motivo` do pull ganha uma oração quando a defasagem passa de
--          12 h — e a oração vem PRIMEIRO, porque ela qualifica todo o resto;
--      (c) `painel_teto_diario.exigir_medicao_recente` (default `false`): com
--          `true`, o pull RECUSA com motivo próprio;
--      (d) `painel_fila_historico_medido` devolve min/máx/mediana dos últimos
--          N dias MEDIDOS — a informação que falta ao operador para escolher um
--          teto que exista. Leitura pura; não altera teto nenhum.
--
--  Mais, do mesmo crítico:
--   MÉDIO 4 · custo MEDIDO igual a ZERO passa a ser ajustável (é o modo de
--             falha conhecido: a sessão fechou sem conseguir ler o usage).
--             Medido > 0 continua recusado.
--   BAIXO 7 · quando a oração dos mortos DO DISPARO e a da parcela estimada
--             ACUMULADA nomeiam o mesmo dinheiro, só a primeira sai.
--   BAIXO 9 · nenhum enum cru na cara do operador ("este está pega" →
--             "este está em execução"), por `painel_fila_estado_br`.
-- =============================================================================

-- ── 1 · painel_fila_estado_br — o estado em português (BAIXO 9) ─────────────
-- 0015:829 mandava o enum cru para a tela: "Só dá para ajustar o custo de item
-- que falhou ou foi cancelado (este está pega)." `pega` e `concluida` são
-- chaves de banco; o operador lê português.
create or replace function public.painel_fila_estado_br(p_estado text)
returns text
language sql
immutable
set search_path = pg_temp
as $$
  select case p_estado
    when 'na_fila'   then 'na fila'
    when 'pega'      then 'em execução'
    when 'concluida' then 'concluído'
    when 'falhou'    then 'falhou'
    when 'cancelada' then 'cancelado'
    else coalesce(p_estado, 'sem estado')
  end;
$$;
comment on function public.painel_fila_estado_br(text) is
  'BAIXO 9 (rodada 7): traduz o enum de estado da fila para o português que o operador lê. Nenhuma mensagem de recusa volta a escrever "pega" ou "concluida".';
revoke all on function public.painel_fila_estado_br(text) from public, anon, authenticated;

-- ── 2 · exigir_medicao_recente — a trava OPCIONAL do operador (D32c) ────────
alter table public.painel_teto_diario
  add column if not exists exigir_medicao_recente boolean not null default false;
comment on column public.painel_teto_diario.exigir_medicao_recente is
  'D32c (rodada 7): com `true`, o pull desta conta RECUSA enquanto o gasto medido estiver com mais de 12 h de defasagem (ou enquanto a conta nunca tiver tido medição). Default `false` para não mudar o comportamento de hoje — ligar é decisão do operador, documentada em DEPLOY.md.';

-- ── 3 · painel_fila_medido_ate — a última medição, de QUALQUER dia (D32a) ───
-- Era `max(atualizado_em) ... and painel_dia_operador(...) = painel_dia_operador()`:
-- uma conta cuja última sessão é de 12/09 devolvia NULL em 14/09, e o card
-- imprimia "sem sessão medida hoje ainda" — indistinguível de uma conta que
-- NUNCA teve sessão. São coisas diferentes e o operador precisa saber qual é.
create or replace function public.painel_fila_medido_ate(p_conta text)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select max(coalesce(s.atualizado_em, s.criado_em, s.publicado_em))
  from public.painel_frentes_sessoes s
  where s.conta = p_conta
    and coalesce(s.atualizado_em, s.criado_em, s.publicado_em) is not null;
$$;
comment on function public.painel_fila_medido_ate(text) is
  'D32a (rodada 7): a ÚLTIMA medição desta conta, de qualquer dia (antes: só de hoje). NULL agora significa uma coisa só — esta conta nunca teve sessão medida —, e o card diz "sem medição nenhuma" em vez de "US$ 0,00 de US$ 150,00 · US$ 150,00 livres".';
revoke all on function public.painel_fila_medido_ate(text) from public, anon, authenticated;

-- ── 4 · painel_fila_defasagem_horas — quão velho é o saldo (D32a) ───────────
create or replace function public.painel_fila_defasagem_horas(p_conta text)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when public.painel_fila_medido_ate(p_conta) is null then null
    else round(extract(epoch from (now() - public.painel_fila_medido_ate(p_conta))) / 3600.0, 1)
  end;
$$;
comment on function public.painel_fila_defasagem_horas(text) is
  'D32a (rodada 7): horas desde a última medição desta conta; NULL quando nunca houve medição. Medido em 13/09: a conta com 215 sessões estava 37 h atrás e a tela mostrava o saldo como se fosse de agora.';
revoke all on function public.painel_fila_defasagem_horas(text) from public, anon, authenticated;

-- ── 5 · painel_fila_historico_medido — a realidade ao lado do teto (D32d) ───
-- NÃO altera teto nenhum: é leitura. Existe porque "teto US$ 150,00" sozinho
-- não informa nada, e o operador não tem como escolher um teto que exista sem
-- ver a faixa em que os dias medidos realmente caem.
create or replace function public.painel_fila_historico_medido(
  p_conta text, p_dias integer default 10
)
returns table (dias integer, min_usd numeric, max_usd numeric, mediana_usd numeric)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with ultimos as (
    select c.custo_usd
    from public.painel_consumo_por_conta_dia c
    where c.conta = p_conta
      and c.dia < public.painel_dia_operador()
    order by c.dia desc
    limit greatest(coalesce(p_dias, 10), 1)
  )
  select
    count(*)::integer,
    round(min(u.custo_usd), 2),
    round(max(u.custo_usd), 2),
    round((percentile_cont(0.5) within group (order by u.custo_usd))::numeric, 2)
  from ultimos u;
$$;
comment on function public.painel_fila_historico_medido(text, integer) is
  'D32d (rodada 7): min, máx e mediana do gasto MEDIDO dos últimos N dias com dado (hoje fora, porque hoje é parcial). Uma linha sempre; com dias = 0 os três números são NULL. É a comparação que o card imprime ao lado do teto.';
revoke all on function public.painel_fila_historico_medido(text, integer) from public, anon, authenticated;

-- ── 6 · painel_fila_itens_do_dia — DEDUP POR ENTIDADE (D31) ─────────────────
create or replace function public.painel_fila_itens_do_dia(p_conta text, p_dia date)
returns table (id uuid, contribuicao numeric, e_estimativa boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    f.id,
    -- D31 (rodada 7): a dedup é por ENTIDADE. Item com sessão vinculada que
    -- publicou custo contribui ZERO em TODO dia — quem paga é a sessão, no dia
    -- dela, por `painel_consumo_por_conta_dia`. O `left join lateral` PERDEU o
    -- filtro de dia: era ele que fazia o mesmo dinheiro ser cobrado duas vezes
    -- na virada (medido: US$ 80 de trabalho real → US$ 160 cobrados).
    -- D30 (rodada 6, mantida): sessão publicada SEM custo não abate nada (21
    -- das 215 sessões reais) — o `custo_usd is not null` abaixo é essa metade.
    case when ses.custo_usd is null then f.custo_usd else 0 end as contribuicao,
    f.custo_e_estimativa
  from public.painel_fila_prompts f
  left join lateral (
    select s.custo_usd
    from public.painel_frentes_sessoes s
    where f.session_id is not null
      and s.sessao_id = f.session_id
      and s.conta = f.conta
      and s.custo_usd is not null
    order by s.custo_usd desc
    limit 1
  ) ses on true
  where f.conta = p_conta
    and f.custo_usd is not null
    and f.concluido_em is not null
    -- D25 (rodada 6, mantida): o dia é o do FECHAMENTO.
    and public.painel_dia_operador(f.concluido_em) = p_dia
    and (
      f.estado in ('concluida', 'falhou')
      -- D12 (rodada 4, mantida): cancelada que JÁ TEVE DONO gastou dinheiro.
      or (f.estado = 'cancelada' and (f.worker_id is not null or f.ultimo_worker_id is not null or f.tentativas > 0))
    );
$$;
comment on function public.painel_fila_itens_do_dia(text, date) is
  'D31 (rodada 7): dedup por ENTIDADE — item com sessão vinculada que publicou custo contribui ZERO em TODO dia (a sessão paga por si, no dia dela). Antes o abatimento só valia quando a sessão fora publicada no MESMO dia do fechamento, e a virada do dia cobrava o mesmo dinheiro duas vezes. Mantém D25 (o dia é o de concluido_em), D30 (sessão sem custo não abate) e D12.';
revoke all on function public.painel_fila_itens_do_dia(text, date) from public, anon, authenticated;

-- ── 7 · painel_fila_motivo_do_pull — defasagem + recusa + BAIXO 7 ───────────
-- A assinatura de 13 argumentos sai para a de 15 não ficar AMBÍGUA.
drop function if exists public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer);

create or replace function public.painel_fila_motivo_do_pull(
  p_mortos integer, p_mortos_usd numeric,
  p_custo_escolhido numeric, p_headroom numeric,
  p_menor_disponivel numeric, p_elegiveis integer,
  p_em_espera integer, p_menor_espera numeric, p_espera_min integer,
  p_devolvidos integer, p_travados integer,
  p_estimativa_usd numeric, p_estimativa_itens integer,
  p_defasagem_horas numeric default null,
  p_exigir_medicao boolean default false
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text[] := '{}'::text[];
begin
  -- D32c: a RECUSA é a frase inteira. Não adianta listar o que caberia num
  -- saldo que a casa acabou de declarar velho demais para autorizar gasto.
  if coalesce(p_exigir_medicao, false)
     and (p_defasagem_horas is null or p_defasagem_horas > 12) then
    if p_defasagem_horas is null then
      return 'não autorizo contra saldo nenhum: esta conta exige medição recente e nunca teve gasto medido';
    end if;
    return format('não autorizo contra saldo de %s h atrás: esta conta exige medição recente',
      round(p_defasagem_horas)::integer);
  end if;

  -- D32b: a defasagem vem PRIMEIRO — ela qualifica todos os números seguintes.
  -- Medido: 37 h de atraso e a tela dizia "US$ 150,00 livres" sem ressalva.
  -- Conta que NUNCA mediu nada não ganha oração aqui de propósito: os números
  -- do pull dela são todos zero e a oração seria um prefixo permanente em toda
  -- frase. Quem diz isso é o CARD ("sem medição nenhuma"), e quem trava é
  -- exigir_medicao_recente.
  if p_defasagem_horas is not null and p_defasagem_horas > 12 then
    v := v || format('atenção: o gasto medido desta conta é de %s h atrás',
      round(p_defasagem_horas)::integer);
  end if;

  -- A ordem é a ordem: defasagem · mortos · escolhido/nada cabe · em espera ·
  -- devolvidos · travados · parcela estimada. Nenhum ramo cala outro.
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

  -- D20 (rodada 4): a parcela estimada é dita em voz alta — BAIXO 7 (rodada 7):
  -- exceto quando ela é EXATAMENTE o dinheiro que a oração dos mortos deste
  -- disparo já nomeou. Duas orações para o mesmo dinheiro só engordam a frase
  -- (o crítico mediu 331 caracteres, com a repetição dentro).
  if coalesce(p_estimativa_usd, 0) > 0
     and not (coalesce(p_mortos, 0) > 0
              and coalesce(p_mortos, 0) = coalesce(p_estimativa_itens, -1)
              and coalesce(p_mortos_usd, 0) = coalesce(p_estimativa_usd, -1)) then
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
comment on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer, numeric, boolean) is
  'D27 (rodada 6) + D32b/D32c e BAIXO 7 (rodada 7): a frase ADITIVA do pull, numa função PURA — defasagem; mortos; escolhido ou nada cabe; em espera; devolvidos; travados; parcela estimada (omitida quando é o mesmo dinheiro dos mortos deste disparo). Com exigir_medicao e defasagem > 12 h a RECUSA é a frase inteira. Espelhada texto a texto por montarMotivoDoPull (src/core/prompts/tipos.ts) e afirmada contra o banco em supabase/tests/fila_prompts.test.sql.';
revoke all on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer, numeric, boolean) from public, anon, authenticated;

-- ── 8 · fila_prompts_pegar_interno — a recusa por medição velha (D32b/c) ────
create or replace function public.fila_prompts_pegar_interno(p_conta text, p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teto            numeric;
  v_medido          numeric;
  v_execucao        numeric;
  v_headroom        numeric;
  v_estimativa      numeric;
  v_estimativa_n    integer;
  v_devolvidos      integer := 0;
  v_mortos          integer := 0;
  v_mortos_usd      numeric := 0;
  v_pulados         integer := 0;
  v_em_espera       integer := 0;
  v_devolvidos_ids  uuid[] := '{}'::uuid[];
  v_menor_fila      numeric;
  v_menor_agora     numeric;
  v_menor_espera    numeric;
  v_espera_min      integer;
  v_custo_escolhido numeric;
  v_elegiveis       integer := 0;
  v_travados        integer := 0;
  v_escolhido       uuid;
  v_row             public.painel_fila_prompts%rowtype;
  v_motivo          text;
  v_defasagem       numeric;
  v_exigir          boolean := false;
begin
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    raise exception 'worker_id é obrigatório (use o id desta sessão: get_session sem argumento → session_id).'
      using errcode = 'check_violation';
  end if;

  -- Serializa dois pulls da MESMA conta (contas diferentes nunca se bloqueiam).
  perform 1 from public.painel_teto_diario where conta = p_conta for update;

  select teto_usd, coalesce(exigir_medicao_recente, false)
    into v_teto, v_exigir
    from public.painel_teto_diario where conta = p_conta;
  if v_teto is null then v_teto := 150; end if;

  v_defasagem := public.painel_fila_defasagem_horas(p_conta);

  -- D32c (rodada 7): a recusa vem ANTES de qualquer escrita. Recusar é dizer
  -- "não autorizo gasto novo contra um saldo que ninguém atualiza há N horas";
  -- devolver e matar item nesse estado seria mexer no dia com a mesma régua
  -- velha que acabamos de declarar insuficiente.
  if v_exigir and (v_defasagem is null or v_defasagem > 12) then
    v_medido   := public.painel_fila_consumo_hoje(p_conta);
    v_execucao := public.painel_fila_reservado(p_conta);
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', 0, 'mortos', 0, 'pulados', 0, 'travados', 0,
      'mortos_usd', 0,
      'em_espera', public.painel_fila_em_espera(p_conta),
      'headroom_usd', round(v_teto - v_medido - v_execucao, 2),
      'menor_custo_fila', null, 'menor_custo_elegivel_agora', null,
      'estimativa_usd', round(public.painel_fila_estimativa_usd(p_conta), 2),
      'estimativa_itens', public.painel_fila_estimativa_itens(p_conta),
      'recusado_por_medicao', true,
      'defasagem_horas', v_defasagem,
      'motivo', public.painel_fila_motivo_do_pull(
        p_mortos => 0, p_mortos_usd => 0,
        p_custo_escolhido => null, p_headroom => 0,
        p_menor_disponivel => null, p_elegiveis => 0,
        p_em_espera => 0, p_menor_espera => null, p_espera_min => null,
        p_devolvidos => 0, p_travados => 0,
        p_estimativa_usd => 0, p_estimativa_itens => 0,
        p_defasagem_horas => v_defasagem, p_exigir_medicao => true)
    );
  end if;

  -- D2 (rodada 3) + D19 (rodada 4): expira por 45 min SEM SINAL; quem volta
  -- cumpre backoff de 15 min × tentativas. D26 (rodada 6): `mor` guarda a
  -- posse em `ultimo_worker_id` antes de zerar `worker_id`.
  with alvo as (
    select f.id, f.tentativas, f.max_tentativas
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'pega'
      and coalesce(f.heartbeat_em, f.pego_em) < now() - interval '45 minutes'
  ),
  dev as (
    update public.painel_fila_prompts f
       set estado = 'na_fila', worker_id = null, pego_em = null, heartbeat_em = null,
           ultimo_worker_id = coalesce(f.worker_id, f.ultimo_worker_id),
           disponivel_em = now() + (interval '15 minutes' * greatest(f.tentativas, 1))
      from alvo a
     where f.id = a.id and a.tentativas < a.max_tentativas
    returning f.id
  ),
  mor as (
    update public.painel_fila_prompts f
       set estado = 'falhou',
           ultimo_worker_id = coalesce(f.worker_id, f.ultimo_worker_id),
           worker_id = null,
           heartbeat_em = null,
           motivo_falha = format('expirou %s vezes sem fechamento', f.tentativas),
           custo_usd = least(f.custo_estimado_usd, 500),
           custo_e_estimativa = true,
           concluido_em = now()
      from alvo a
     where f.id = a.id and a.tentativas >= a.max_tentativas
    returning f.id, f.custo_usd
  )
  select
    coalesce((select array_agg(d.id) from dev d), '{}'::uuid[]),
    (select count(*) from dev),
    (select count(*) from mor),
    coalesce((select sum(m.custo_usd) from mor m), 0)
  into v_devolvidos_ids, v_devolvidos, v_mortos, v_mortos_usd;

  v_medido       := public.painel_fila_consumo_hoje(p_conta);
  v_execucao     := public.painel_fila_reservado(p_conta);
  v_headroom     := v_teto - v_medido - v_execucao;
  v_em_espera    := public.painel_fila_em_espera(p_conta);
  v_estimativa   := public.painel_fila_estimativa_usd(p_conta);
  v_estimativa_n := public.painel_fila_estimativa_itens(p_conta);

  -- D21 (rodada 5, mantida): a elegibilidade é do `where`, não de um laço.
  select f.id into v_escolhido
    from public.painel_fila_prompts f
   where f.conta = p_conta
     and f.estado = 'na_fila'
     and f.id <> all (v_devolvidos_ids)
     and (f.disponivel_em is null or f.disponivel_em <= now())
     and f.custo_estimado_usd <= v_headroom
   order by f.criado_em, f.id
   limit 1
     for update skip locked;

  select
    count(*) filter (where f.custo_estimado_usd > v_headroom)::int,
    count(*) filter (where f.custo_estimado_usd <= v_headroom)::int,
    min(f.custo_estimado_usd)
    into v_pulados, v_elegiveis, v_menor_agora
    from public.painel_fila_prompts f
   where f.conta = p_conta
     and f.estado = 'na_fila'
     and f.id <> all (v_devolvidos_ids)
     and (f.disponivel_em is null or f.disponivel_em <= now());

  select min(f.custo_estimado_usd)
    into v_menor_fila
    from public.painel_fila_prompts f
   where f.conta = p_conta and f.estado = 'na_fila';

  select
    min(f.custo_estimado_usd),
    greatest(1, ceil(extract(epoch from (min(f.disponivel_em) - now())) / 60.0))::int
    into v_menor_espera, v_espera_min
    from public.painel_fila_prompts f
   where f.conta = p_conta
     and f.estado = 'na_fila'
     and f.disponivel_em is not null
     and f.disponivel_em > now();

  if v_escolhido is null and v_elegiveis > 0 then
    v_travados := v_elegiveis;
  end if;

  if v_escolhido is not null then
    select f.custo_estimado_usd into v_custo_escolhido
      from public.painel_fila_prompts f where f.id = v_escolhido;
  end if;

  v_motivo := public.painel_fila_motivo_do_pull(
    p_mortos           => v_mortos,
    p_mortos_usd       => v_mortos_usd,
    p_custo_escolhido  => v_custo_escolhido,
    p_headroom         => v_headroom,
    p_menor_disponivel => v_menor_agora,
    p_elegiveis        => v_elegiveis,
    p_em_espera        => v_em_espera,
    p_menor_espera     => v_menor_espera,
    p_espera_min       => v_espera_min,
    p_devolvidos       => v_devolvidos,
    p_travados         => v_travados,
    p_estimativa_usd   => v_estimativa,
    p_estimativa_itens => v_estimativa_n,
    p_defasagem_horas  => v_defasagem,
    p_exigir_medicao   => false
  );

  if v_escolhido is null then
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
      'travados', v_travados,
      'mortos_usd', round(v_mortos_usd, 2),
      'em_espera', v_em_espera, 'headroom_usd', round(v_headroom, 2),
      'menor_custo_fila', round(v_menor_fila, 2),
      'menor_custo_elegivel_agora', round(v_menor_agora, 2),
      'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
      'recusado_por_medicao', false,
      'defasagem_horas', v_defasagem,
      'motivo', v_motivo
    );
  end if;

  update public.painel_fila_prompts
     set estado = 'pega',
         worker_id = p_worker_id,
         ultimo_worker_id = p_worker_id,
         pego_em = now(),
         heartbeat_em = now(),
         disponivel_em = null,
         tentativas = tentativas + 1
   where id = v_escolhido
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
    'travados', v_travados,
    'mortos_usd', round(v_mortos_usd, 2),
    'em_espera', v_em_espera, 'headroom_usd', round(v_headroom, 2),
    'menor_custo_fila', round(v_menor_fila, 2),
    'menor_custo_elegivel_agora', round(v_menor_agora, 2),
    'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
    'recusado_por_medicao', false,
    'defasagem_horas', v_defasagem,
    'motivo', v_motivo,
    'item', jsonb_build_object(
      'id', v_row.id, 'conta', v_row.conta, 'prompt', v_row.prompt,
      'complexidade', v_row.complexidade, 'modeloSugerido', v_row.modelo_sugerido,
      'criadoEm', v_row.criado_em, 'taskId', v_row.task_id,
      'workerId', v_row.worker_id, 'tentativas', v_row.tentativas,
      'maxTentativas', v_row.max_tentativas,
      'custoEstimadoUsd', v_row.custo_estimado_usd
    )
  );
end;
$$;
comment on function public.fila_prompts_pegar_interno(text, text) is
  'D32b/D32c (rodada 7): devolve defasagem_horas e recusado_por_medicao; com exigir_medicao_recente = true e defasagem > 12 h (ou sem medição nenhuma) RECUSA antes de escrever qualquer coisa. Mantém D27/B5 (motivo aditivo), D21 (elegibilidade no where), D2/D19/D20 e D26 (ultimo_worker_id).';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 9 · fila_prompts_ajustar_custo — o medido ZERO é ajustável (MÉDIO 4) ────
create or replace function public.fila_prompts_ajustar_custo(
  p_secret text, p_id uuid, p_custo_usd numeric, p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_row      public.painel_fila_prompts%rowtype;
  v_sess     text;
  v_outro    uuid;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_ajustar_custo: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_ajustar_custo: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'Item não identificado.' using errcode = 'check_violation';
  end if;
  if p_custo_usd is null or p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'O custo precisa ser um número entre 0 e 500.' using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');

  select * into v_row from public.painel_fila_prompts where id = p_id for update;

  if not found then
    raise exception 'Item não encontrado na fila.' using errcode = 'check_violation';
  end if;
  if v_row.estado not in ('falhou','cancelada') then
    -- BAIXO 9 (rodada 7): o enum não chega à tela. Era "(este está pega)".
    raise exception 'Só dá para ajustar o custo de item que falhou ou foi cancelado (este está %).',
      public.painel_fila_estado_br(v_row.estado)
      using errcode = 'check_violation';
  end if;
  -- D25: a MESMA régua de painel_fila_itens_do_dia — o dia do fechamento.
  if v_row.concluido_em is null
     or public.painel_dia_operador(v_row.concluido_em) <> public.painel_dia_operador() then
    raise exception 'Só dá para ajustar o custo de item fechado hoje.' using errcode = 'check_violation';
  end if;
  -- MÉDIO 4 (rodada 7): custo MEDIDO continua fechado ao ajuste — com UMA
  -- exceção, que é o modo de falha conhecido: medido IGUAL A ZERO significa
  -- que a sessão fechou sem conseguir ler o usage. Zero não é medição; é a
  -- ausência dela com cara de número, e sem esta porta o item fica cravado em
  -- US$ 0,00 para sempre.
  if not v_row.custo_e_estimativa and coalesce(v_row.custo_usd, 0) <> 0 then
    raise exception 'Só custo estimado pela casa pode ser ajustado; este foi medido.'
      using errcode = 'check_violation';
  end if;

  -- D26: o vínculo de sessão também se cria por aqui. Sem ele, a casa soma a
  -- estimativa do item MAIS o custo real da sessão que rodou.
  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'Esta sessão já está vinculada a outro item da fila.' using errcode = 'check_violation';
    end if;
  end if;

  update public.painel_fila_prompts
     set custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         session_id = coalesce(v_sess, session_id),
         custo_ajustado_em = now()
   where id = p_id;

  return jsonb_build_object(
    'ok', true, 'custo_usd', round(p_custo_usd, 2),
    'session_id', coalesce(v_sess, v_row.session_id),
    'era_medido_zero', (not v_row.custo_e_estimativa)
  );
end;
$$;
comment on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) is
  'D20 + D26 (rodada 6) + MÉDIO 4/BAIXO 9 (rodada 7): custo MEDIDO igual a ZERO passa a ser ajustável (a sessão fechou sem ler o usage); medido > 0 continua recusado; a recusa de estado escreve português, nunca o enum. Régua do dia: concluido_em, a MESMA de painel_fila_itens_do_dia.';
revoke all on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) from public;
grant execute on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) to anon, authenticated;

-- ── 10 · fila_prompts_listar — a tela recebe medição e realidade (D32a/d) ───
create or replace function public.fila_prompts_listar(
  p_secret text, p_limite integer default 50,
  p_antes_de timestamptz default null, p_antes_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_limite   integer;
  v_result   jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_listar: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_listar: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  v_limite := least(greatest(coalesce(p_limite, 50), 1), 200);

  with pagina as (
    select f.*
    from public.painel_fila_prompts f
    where p_antes_de is null
       or (f.criado_em, f.id) < (p_antes_de, coalesce(p_antes_id, '00000000-0000-0000-0000-000000000000'::uuid))
    order by f.criado_em desc, f.id desc
    limit v_limite + 1
  ),
  visivel as (
    select * from pagina order by criado_em desc, id desc limit v_limite
  )
  select
    jsonb_build_object(
      'fila', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', v.id, 'conta', v.conta,
          'prompt', left(v.prompt, 300),
          'promptTamanho', length(v.prompt),
          'complexidade', v.complexidade,
          'modeloSugerido', v.modelo_sugerido, 'estado', v.estado, 'custoUsd', v.custo_usd,
          'custoEstimadoUsd', v.custo_estimado_usd,
          'custoEEstimativa', v.custo_e_estimativa,
          'custoAjustadoEm', v.custo_ajustado_em,
          'criadoEm', v.criado_em, 'pegoEm', v.pego_em, 'concluidoEm', v.concluido_em,
          'disponivelEm', v.disponivel_em,
          'heartbeatEm', v.heartbeat_em, 'workerId', v.worker_id,
          'tentativas', v.tentativas, 'maxTentativas', v.max_tentativas,
          'sessionId', v.session_id, 'motivoFalha', v.motivo_falha,
          'sessaoUrl', v.sessao_url, 'resultado', v.resultado, 'criadoPor', v.criado_por,
          'taskId', v.task_id
        ) order by v.criado_em desc, v.id desc)
        from visivel v
      ), '[]'::jsonb),
      'consumo', coalesce((
        select jsonb_agg(jsonb_build_object(
          'conta', t.conta, 'tetoUsd', t.teto_usd,
          'consumoHojeUsd', public.painel_fila_consumo_hoje(t.conta),
          'reservadoUsd', public.painel_fila_reservado(t.conta),
          'naFilaUsd', public.painel_fila_na_fila(t.conta),
          'estimativaUsd', public.painel_fila_estimativa_usd(t.conta),
          'estimativaItens', public.painel_fila_estimativa_itens(t.conta),
          'emEspera', public.painel_fila_em_espera(t.conta),
          -- D32a (rodada 7): a última medição de QUALQUER dia + quão velha ela é.
          'medidoAteEm', public.painel_fila_medido_ate(t.conta),
          'defasagemHoras', public.painel_fila_defasagem_horas(t.conta),
          'exigeMedicaoRecente', coalesce(t.exigir_medicao_recente, false),
          -- D32d: a realidade medida ao lado do teto — leitura, nada muda.
          'historico', (
            select jsonb_build_object(
              'dias', h.dias, 'minUsd', h.min_usd,
              'maxUsd', h.max_usd, 'medianaUsd', h.mediana_usd)
            from public.painel_fila_historico_medido(t.conta) h
          )
        ) order by case t.conta
          when 'lucasscudeler@gmail.com' then 1
          when 'lsgpandora@gmail.com'    then 2
          when 'almapetra.ltda@gmail.com' then 3
          else 9 end)
        from public.painel_teto_diario t
      ), '[]'::jsonb),
      'limite', v_limite,
      'temMais', (select count(*) from pagina) > v_limite,
      'proximoAntesDe', (select v.criado_em from visivel v order by v.criado_em asc, v.id asc limit 1),
      'proximoAntesId', (select v.id from visivel v order by v.criado_em asc, v.id asc limit 1)
    )
  into v_result;

  return v_result;
end;
$$;
comment on function public.fila_prompts_listar(text, integer, timestamptz, uuid) is
  'D15 (rodada 4) + D32a/D32d (rodada 7): cada linha de consumo passa a trazer medidoAteEm (última medição de qualquer dia), defasagemHoras, exigeMedicaoRecente e o histórico medido (dias/min/máx/mediana). Sem esses campos o card imprimia "US$ 0,00 de US$ 150,00 · US$ 150,00 livres" sobre uma conta cuja medição era de 37 h atrás.';
revoke all on function public.fila_prompts_listar(text, integer, timestamptz, uuid) from public;
grant execute on function public.fila_prompts_listar(text, integer, timestamptz, uuid) to anon, authenticated;
