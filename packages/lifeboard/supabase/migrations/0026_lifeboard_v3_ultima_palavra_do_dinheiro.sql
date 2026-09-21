-- ════════════════════════════════════════════════════════════════════════════
-- 0026 · LIFEBOARD v3 · a ÚLTIMA PALAVRA da ordem volta a ser a versão certa
-- ════════════════════════════════════════════════════════════════════════════
--
-- O QUE ACONTECEU (achado da rodada 11, conferido contra o histórico do banco).
-- As migrations 0022, 0023 e 0024 são VERSÕES ANTIGAS. Elas rodaram em
-- produção em 13/09/2026 — ANTES da 0019 (o livro-razão) — mas chegaram ao
-- repositório depois, recuperadas do histórico do banco, com números que as
-- põem no FIM da ordem de aplicação.
--
-- Em produção nada quebrou: lá a ordem REAL foi 0022/0023/0024 primeiro e
-- 0019/0025 depois, então a última palavra sempre foi a certa. Quem quebra é
-- quem segue o DEPLOY.md e aplica `0001` … `0025` em ordem num banco NOVO:
--
--   · `fila_prompts_pegar_interno`  — última definição: 0022. Sem o
--     lançamento no livro-razão do item que morre (D37), sem a recusa por
--     medição velha (D32c), sem a recusa de conta sem teto declarado, e com o
--     teto fantasma `v_teto := 150` de volta (BAIXO 4).
--   · `fila_prompts_fechar_interno` — última definição: 0023. **Fechar um
--     item não escreve no livro-razão**: o custo do item some do gasto do dia.
--   · `painel_fila_motivo_do_pull`  — a 0022/0024 RECRIARAM a sobrecarga de 13
--     argumentos que a 0016 tinha apagado de propósito. Com as duas vivas, a
--     chamada de 13 argumentos nomeados (é a que `supabase/tests/
--     fila_prompts.test.sql` faz, blocos T13/T29) fica ambígua entre as duas.
--
-- O QUE ESTA MIGRATION FAZ. Redeclara, como última palavra da ordem, a versão
-- CORRETA das duas funções do dinheiro — o texto da 0019, verbatim — e apaga
-- de novo a sobrecarga de 13 argumentos. Nenhum arquivo é renumerado: os nomes
-- de 0022/0023/0024 já estão gravados no histórico do banco.
--
-- O QUE FOI PRESERVADO DAS 0022/0023/0024: nada delas é melhoria que a 0019
-- não tenha.
--   · 0022 "motivo puro": a frase já é função pura desde a 0015, e a 0016 a
--     ampliou (defasagem + recusa por medição). A 0019 chama a versão ampliada.
--   · 0023 "fechar pelo último dono" (D26): a 0019 tem o MESMO ramo
--     `v_reabrir`, e ainda estorna a estimativa do dia da morte (D38), grava
--     `custo_origem`, checa a conta dona da sessão (D34a) e tirou o UUID cru
--     das recusas (BAIXO 1). A 0023 é a versão anterior a tudo isso.
--   · 0024 "motivo em texto literal": o `::text` que ela acrescenta JÁ EXISTE
--     na versão de 15 argumentos da 0016, linha a linha. A 0024 conserta a
--     cópia de 13 argumentos que não deveria existir.
--
-- Re-aplicável: tudo é `create or replace` / `drop … if exists` / `alter …`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · fila_prompts_pegar_interno — o texto da 0019 §17, verbatim ─────────
-- D32c (recusa por medição velha antes de qualquer escrita) · BAIXO 4 (sem
-- teto declarado recusa, não inventa 150) · BAIXO 5 (headroom nunca negativo)
-- · D37 (o item que morre LANÇA a estimativa da casa no livro-razão).
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
  v_mortos_ids      uuid[] := '{}'::uuid[];
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
  v_morto           record;
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

  perform 1 from public.painel_teto_diario where conta = p_conta for update;

  select teto_usd, coalesce(exigir_medicao_recente, false)
    into v_teto, v_exigir
    from public.painel_teto_diario where conta = p_conta;
  -- BAIXO 4 (rodada 8): sem teto DECLARADO não se inventa teto.
  if v_teto is null then
    raise exception 'A conta % não tem teto diário declarado no painel — declare o teto em painel_teto_diario antes de pegar item.',
      p_conta using errcode = 'check_violation';
  end if;

  v_defasagem := public.painel_fila_defasagem_horas(p_conta);

  -- D32c (rodada 7): a recusa vem ANTES de qualquer escrita.
  if v_exigir and (v_defasagem is null or v_defasagem > 12) then
    v_medido   := public.painel_fila_consumo_hoje(p_conta);
    v_execucao := public.painel_fila_reservado(p_conta);
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', 0, 'mortos', 0, 'pulados', 0, 'travados', 0,
      'mortos_usd', 0,
      'em_espera', public.painel_fila_em_espera(p_conta),
      'headroom_usd', round(greatest(v_teto - v_medido - v_execucao, 0), 2),
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

  -- D2 + D19 + D26, inalterados.
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
           custo_origem = 'estimativa',
           concluido_em = now()
      from alvo a
     where f.id = a.id and a.tentativas >= a.max_tentativas
    returning f.id, f.conta, f.session_id, f.custo_usd
  )
  select
    coalesce((select array_agg(d.id) from dev d), '{}'::uuid[]),
    (select count(*) from dev),
    (select count(*) from mor),
    coalesce((select sum(m.custo_usd) from mor m), 0),
    coalesce((select array_agg(m.id) from mor m), '{}'::uuid[])
  into v_devolvidos_ids, v_devolvidos, v_mortos, v_mortos_usd, v_mortos_ids;

  -- D37 (rodada 9): a estimativa do item que MORREU entra no livro-razão, no
  -- dia em que ele morreu. Quando o último dono voltar com o número real, o
  -- fechamento estorna ESTE lançamento e grava o novo — no dia de LÁ, não
  -- reescrevendo o dia de cá (ALTO 1).
  if v_mortos > 0 then
    for v_morto in
      select f.id, f.conta, f.session_id, f.custo_usd
        from public.painel_fila_prompts f
       where f.id = any (v_mortos_ids)
    loop
      perform public.painel_caixa_lancar_item(
        v_morto.id, v_morto.custo_usd, 'estimativa', null,
        'estimativa da casa: item morreu sem fechar');
    end loop;
  end if;

  v_medido       := public.painel_fila_consumo_hoje(p_conta);
  v_execucao     := public.painel_fila_reservado(p_conta);
  v_headroom     := v_teto - v_medido - v_execucao;
  v_em_espera    := public.painel_fila_em_espera(p_conta);
  v_estimativa   := public.painel_fila_estimativa_usd(p_conta);
  v_estimativa_n := public.painel_fila_estimativa_itens(p_conta);

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
      'em_espera', v_em_espera,
      'headroom_usd', round(greatest(v_headroom, 0), 2),
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
    'em_espera', v_em_espera,
    'headroom_usd', round(greatest(v_headroom, 0), 2),
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
  'D32b/D32c + BAIXO 4/5 (rodada 8) + D37 (rodada 9): o item que MORRE lança a estimativa da casa no livro-razão, no dia da morte. Mantém a recusa por medição velha antes de qualquer escrita, o headroom nunca negativo e a recusa sem teto declarado.';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 2 · fila_prompts_fechar_interno — o texto da 0019 §12, verbatim ────────
-- D37/D38: fechar LANÇA no livro-razão, hoje, sob a entidade canônica do item.
-- É a função que a 0023 tinha jogado para trás — e sem ela o custo de um item
-- fechado simplesmente não existe no gasto do dia.
create or replace function public.fila_prompts_fechar_interno(
  p_id uuid, p_conta text, p_worker_id text, p_estado text,
  p_custo_usd numeric, p_session_id text default null,
  p_sessao_url text default null, p_resultado text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row         public.painel_fila_prompts%rowtype;
  v_sess        text;
  v_outro       uuid;
  v_dona        text;
  v_ultimo_dono boolean;
  v_reabrir     boolean;
  v_caixa       jsonb;
begin
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    raise exception 'worker_id é obrigatório (o mesmo usado no fila_prompts_pegar_interno).'
      using errcode = 'check_violation';
  end if;
  if p_estado is null or p_estado not in ('concluida','falhou') then
    raise exception 'estado de fechamento precisa ser concluida ou falhou.' using errcode = 'check_violation';
  end if;
  if p_custo_usd is null then
    raise exception 'custo_usd é obrigatório ao fechar (use 0 quando não houver custo).'
      using errcode = 'check_violation';
  end if;
  if p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'custo_usd fora da faixa aceita (0 a 500): %', p_custo_usd
      using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');
  if v_sess is not null and v_sess = btrim(p_worker_id) then
    raise exception 'session_id é o id da sessão FILHA, não o da Routine' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts
    where id = p_id and conta = p_conta for update;

  if not found then
    raise exception 'Item não encontrado ou não pertence à conta informada.'
      using errcode = 'check_violation';
  end if;

  -- D26 (rodada 6): a morte tira a posse VIVA para liberar a fila, não para
  -- proibir o único ator com o número honesto de entregá-lo.
  v_ultimo_dono := (
    v_row.worker_id is null
    and v_row.ultimo_worker_id is not null
    and v_row.ultimo_worker_id = btrim(p_worker_id)
  );
  v_reabrir := (v_row.estado = 'falhou' and v_ultimo_dono and v_row.custo_e_estimativa);

  if v_row.estado = 'na_fila' and v_row.worker_id is null then
    raise exception 'Item voltou para a fila (45 min sem sinal) — não pode ser fechado; ele será pego de novo.'
      using errcode = 'check_violation';
  end if;

  -- D1 · fencing: só quem pegou fecha (ou, por D26, quem tinha pegado).
  -- BAIXO 1 (rodada 8): a recusa nomeia quem PEGOU, sem cuspir UUID.
  if not v_ultimo_dono and v_row.worker_id is distinct from p_worker_id then
    raise exception 'Item pertence a outro worker (%).',
      coalesce(v_row.worker_id, v_row.ultimo_worker_id, 'ninguém pegou este item')
      using errcode = 'check_violation';
  end if;

  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'sessão já vinculada ao item %', v_outro using errcode = 'check_violation';
    end if;
    -- D34a (rodada 8) mantida: a porta continua fechada para o caso em que a
    -- sessão JÁ está publicada. O caminho real — a sessão nascer depois — não
    -- depende mais desta guarda para nada: a conta do dinheiro é a do
    -- lançamento (D39), e ela não se remaneja.
    v_dona := public.painel_sessao_dona(v_sess);
    if v_dona is not null and v_dona <> v_row.conta then
      raise exception 'Esta sessão é da conta % — não dá para vinculá-la a um item da conta %.',
        v_dona, v_row.conta using errcode = 'check_violation';
    end if;
  end if;

  if v_reabrir then
    -- D26 + ALTO 1 (rodada 9): `concluido_em = now()` NÃO move mais dinheiro —
    -- o dia do dinheiro é o do lançamento, e o lançamento de ontem fica onde
    -- está. O que `concluido_em` governa é UMA coisa: a janela em que o
    -- operador ainda pode corrigir o número pela tela
    -- (`fila_prompts_ajustar_custo`, "só item fechado hoje"). Este item acabou
    -- de ser fechado AGORA, com o número real — e é hoje que ele é corrigível.
    update public.painel_fila_prompts
       set estado = p_estado,
           custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           custo_origem = 'medido',
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           motivo_falha = case when p_estado = 'falhou' then motivo_falha else null end,
           heartbeat_em = null,
           disponivel_em = null,
           concluido_em = now()
     where id = p_id
    returning * into v_row;

    -- D38: a estimativa lançada no dia da morte é ESTORNADA HOJE e o número
    -- real é lançado HOJE. Ontem continua valendo o que foi relatado.
    v_caixa := public.painel_caixa_lancar_item(
      v_row.id, p_custo_usd, 'medido', now(),
      'fechamento pelo último dono de item que tinha morrido sem fechar');

    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', true, 'estado', p_estado,
      'caixa', v_caixa
    );
  end if;

  -- D8 (rodada 3) · idempotência: a segunda chamada não lança nada.
  if v_row.estado in ('concluida','falhou') then
    return jsonb_build_object(
      'ok', true, 'ja_fechado', true, 'reaberto_e_fechado', false, 'estado', v_row.estado
    );
  end if;

  -- D12 (rodada 4): item cancelado pelo operador durante a execução — a
  -- medição real SUBSTITUI a estimativa, o estado continua `cancelada`.
  if v_row.estado = 'cancelada' then
    -- ALTO 2 (rodada 9): `concluido_em` NÃO anda. O item fechou quando foi
    -- cancelado; esta chamada só troca o NÚMERO. Mover `concluido_em` para
    -- agora reabriria a janela de escrita da tela sobre um item encerrado em
    -- outro dia — e era isso que fazia dinheiro entrar num dia encerrado.
    update public.painel_fila_prompts
       set custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           custo_origem = 'medido',
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           concluido_em = coalesce(concluido_em, now())
     where id = p_id
    returning * into v_row;

    v_caixa := public.painel_caixa_lancar_item(
      v_row.id, p_custo_usd, 'medido', now(),
      'medição real sobre item cancelado durante a execução');

    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', 'cancelada',
      'caixa', v_caixa
    );
  end if;

  update public.painel_fila_prompts
     set estado = p_estado,
         custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         custo_origem = 'medido',
         session_id = coalesce(v_sess, session_id),
         sessao_url = coalesce(p_sessao_url, sessao_url),
         resultado = coalesce(p_resultado, resultado),
         heartbeat_em = null,
         disponivel_em = null,
         concluido_em = now()
   where id = p_id
  returning * into v_row;

  v_caixa := public.painel_caixa_lancar_item(
    v_row.id, p_custo_usd, 'medido', now(),
    'fechamento normal');

  return jsonb_build_object(
    'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', p_estado,
    'caixa', v_caixa
  );
end;
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'D37/D38 (rodada 9): fechar LANÇA no livro-razão, no dia de hoje, sob a entidade canônica do item. O ramo reaberto estorna a estimativa do dia da morte e lança o número real HOJE — o dia da morte não é reescrito (ALTO 1). O ramo `cancelada` não move `concluido_em`: o item fechou quando foi cancelado (ALTO 2). Mantém D1/D8/D11/D12/D26/D34a e BAIXO 1.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;

-- ── 3 · a sobrecarga de 13 argumentos do motivo sai de novo ────────────────
-- A 0016 apagou esta assinatura de propósito quando criou a de 15 argumentos
-- (com `p_defasagem_horas` e `p_exigir_medicao`, ambos com default). A 0022 e a
-- 0024 a recriaram. Com as duas vivas, uma chamada de 13 argumentos nomeados
-- casa com as duas — e é exatamente assim que `supabase/tests/
-- fila_prompts.test.sql` chama a função nos blocos T13 e T29.
-- Apagar a de 13 devolve a resolução para a de 15, que tem o MESMO texto para
-- esses casos (inclusive o `::text` que a 0024 foi acrescentar na cópia) mais
-- o ramo da defasagem. Nada no repositório chama a de 13 de propósito.
drop function if exists public.painel_fila_motivo_do_pull(
  integer, numeric, numeric, numeric, numeric, integer,
  integer, numeric, integer, integer, integer, numeric, integer);

-- ── 4 · M3 · o teto de 500 por conta vira migration (decisão de 14/09/2026) ─
-- Até aqui o número 500 só existia como PROSA no DEPLOY.md ("depois o
-- `alter … teto_usd set default 500`") — um passo manual que nenhum arquivo
-- confere e que some na primeira implantação feita com pressa. O schema
-- continuava com `default 150` (0007 §42) e a seed das três contas também.
--
-- A régua da casa `teto-de-gasto-diario` registrou a decisão do operador em
-- 14/09/2026: **500 por conta**, nas três. O motivo medido: nos 9 dias com
-- dado em `painel_consumo_por_conta_dia`, 9 de 9 ficaram acima de 150
-- (mediana ~2,6× o teto; 12/09 deu US$ 2.513,29). Um teto que nenhum dia real
-- respeita não é freio — é um bloqueio total esperando a medição funcionar.
--
-- O `update` só mexe em quem AINDA está no default antigo (150). Conta em que
-- o operador já escolheu outro número não é tocada — o valor do teto é decisão
-- dele, e esta migration só termina de aplicar a decisão que ele já tomou.
alter table public.painel_teto_diario alter column teto_usd set default 500;

update public.painel_teto_diario
   set teto_usd = 500
 where conta in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
   and teto_usd = 150;

insert into public.painel_teto_diario (conta, teto_usd) values
  ('lucasscudeler@gmail.com', 500),
  ('lsgpandora@gmail.com', 500),
  ('almapetra.ltda@gmail.com', 500)
on conflict (conta) do nothing;

comment on column public.painel_teto_diario.teto_usd is
  'Teto diário de gasto por conta. 500 por decisão do operador em 14/09/2026 (regra da casa `teto-de-gasto-diario`) — calibragem provisória, a reavaliar com 14 dias de dado real nas três contas. Antes: 150.';
