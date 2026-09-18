-- ════════════════════════════════════════════════════════════════════════════
-- 0022 · LIFEBOARD v3 · recuperada do banco — existia em produção, faltava aqui
-- ════════════════════════════════════════════════════════════════════════════
--
-- Esta migration já estava aplicada em produção (`supabase_migrations.
-- schema_migrations`, versão 20260913223804, nome `lifeboard_v3_fila_dia_e_
-- dono_motivo_puro`) desde 13/09/2026, mas nunca chegou a este repositório —
-- foi aplicada por colagem no SQL Editor, que grava o histórico do banco mas
-- não escreve arquivo. A nota de memória de 15/09/2026 registrou o gap; o
-- PASSO-0c (`scripts/gerar-conferencia-drift.mjs`) o achou de novo em 17/09,
-- desta vez comparado nome a nome contra os 21 arquivos existentes. O texto
-- abaixo é EXATAMENTE o que rodou em produção (recuperado da coluna
-- `statements` do histórico) — não uma reconstrução.
--
-- Re-aplicável: tudo aqui é `create or replace`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 6 · painel_fila_motivo_do_pull — a frase mora numa função PURA (D27) ────
-- MÉDIO 2 (rodada 5): "o teste de D21 é de ortografia". A frase do pull era
-- montada dentro de `fila_prompts_pegar_interno`, e provar cada ramo exigia
-- montar o estado inteiro da fila no banco — inclusive ramos que uma única
-- conexão não consegue produzir (item travado por OUTRA transação, B5). Agora
-- a frase é uma função PURA: `supabase/tests/fila_prompts.test.sql` chama cada
-- ramo direto, com números, e `src/core/prompts/tipos.ts` (montarMotivoDoPull)
-- é o espelho TS, texto a texto.
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
    v := v || '1 item voltou para a fila e aguarda nova tentativa';
  elsif p_devolvidos > 1 then
    v := v || format('%s itens voltaram para a fila e aguardam nova tentativa', p_devolvidos);
  end if;

  if p_travados = 1 then
    v := v || '1 item elegível está em uso por outra operação; tente no próximo disparo';
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

-- ── 7 · fila_prompts_pegar_interno — motivo ADITIVO + travados (D27/B5) ─────
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
  -- É por DESENHO: há 1 Routine por conta. O `skip locked` da linha do item
  -- protege contra `cancelar`/`fechar`/`ajustar` concorrentes, nunca contra
  -- outro worker da mesma conta — esse nem chega aqui.
  perform 1 from public.painel_teto_diario where conta = p_conta for update;

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

  select teto_usd into v_teto from public.painel_teto_diario where conta = p_conta;
  if v_teto is null then v_teto := 150; end if;

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

  -- Os que NÃO cabem (fila inteira, sem janela) e — B5 (rodada 6) — quantos
  -- CABEM sem tentar travar nada: se o escolhido é null e este número é > 0,
  -- o item elegível existe e está em uso por outra transação. Antes, esse
  -- caso caía em "fila vazia para esta conta" com a fila cheia.
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

  -- D27: o menor custo da fila INTEIRA (inclusive quem está de castigo) é um
  -- número separado — a frase que só olhava os disponíveis dizia "o mais
  -- barato da fila custa US$ 120,00" com três itens de US$ 5,00 em backoff.
  select min(f.custo_estimado_usd)
    into v_menor_fila
    from public.painel_fila_prompts f
   where f.conta = p_conta and f.estado = 'na_fila';

  -- Quem está de castigo: o mais barato e quando o primeiro deles volta.
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

  -- D27: a frase inteira vem da função PURA — um lugar só, testável ramo a
  -- ramo sem montar a fila (e sem precisar de duas conexões para o travado).
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
    p_estimativa_itens => v_estimativa_n
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
  'D27/B5 (rodada 6): o motivo é ADITIVO — mortos; escolhido ou nada cabe; em espera (com o menor custo em backoff e quando ele volta); devolvidos; travados — concatenados por "; ", em português, com vírgula decimal e sem número negativo. menor_custo_fila (inclui backoff) e menor_custo_elegivel_agora saem como campos numéricos. Mantém D21 (elegibilidade no where) e D2/D19/D20; D26 grava ultimo_worker_id.';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;
