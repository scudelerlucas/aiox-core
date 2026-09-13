-- =============================================================================
-- OS-LIFEBOARD · Migration 0014 — P7: RODADA 5, o pull que não mente.
-- =============================================================================
-- Sobre 0007 + 0009 + 0011 + 0012 + 0013. Tudo ADITIVO e RE-APLICÁVEL
-- (`create or replace function`, `create index if not exists`): nenhuma tabela,
-- coluna, índice ou assinatura é removida por este arquivo — as aridades de
-- `fila_prompts_pegar_interno(text, text)`, `painel_fila_itens_do_dia(text)` e
-- `fila_prompts_ajustar_custo(text, uuid, numeric)` são as MESMAS de 0013.
--
-- PRINCÍPIO DA RODADA (o crítico reprovou com 2 ALTO + 3 MÉDIO + 3 BAIXO, e os
-- dois ALTO são a mesma frase): **a decisão mora no `where`, não no laço; e
-- toda frase que a casa calcula chega à tela.** Onde antes o pull decidia
-- elegibilidade iterando uma janela de 50 linhas — e depois escrevia um motivo
-- sobre o que tinha visto, não sobre o que existe — agora o banco filtra por
-- elegibilidade e conta o resto sem janela nenhuma.
--
-- As decisões desta rodada (D21–D24 + os achados soltos):
--
--  D21 ELEGIBILIDADE NO `WHERE`. `fila_prompts_pegar_interno` iterava
--      `order by criado_em, id limit 50 for update skip locked` e testava o
--      teto DENTRO do laço. Consequência medida: com 50 itens `maxima` (US$
--      120) na frente, um `baixa` (US$ 5) na posição 51 era INVISÍVEL — o pull
--      dizia "nada cabe agora: o mais barato da fila custa US$ 120,00" com um
--      de US$ 5,00 na fila. Agora:
--        · o item sai de um `select … where custo_estimado_usd <= headroom
--          order by criado_em, id limit 1 for update skip locked` — o mais
--          antigo que CABE, esteja ele na posição 1 ou na 5.000ª;
--        · `pulados` = `count(*)` dos `na_fila` disponíveis que NÃO cabem
--          (consulta separada, sem limite);
--        · `menor que não coube` = `min(custo_estimado_usd)` sobre TODOS os que
--          não cabem — nunca sobre os 50 primeiros;
--        · `em_espera` continua sendo `painel_fila_em_espera` (os que ainda
--          cumprem backoff, `disponivel_em > now()`).
--      Índice parcial novo para a ordenação: `(conta, criado_em, id) where
--      estado = 'na_fila'`.
--
--  D23 PULL QUE MATA UM ITEM NÃO DIZ "FILA VAZIA". O `case` do motivo ganha o
--      ramo `mortos > 0` ANTES de "fila vazia": "1 item morreu sem fechar neste
--      disparo e lançou US$ X no dia" (plural quando for mais de um). O item
--      que morre lança o ESTIMADO no gasto do dia (D2/D20) — calar isso era
--      esconder dinheiro que acabou de entrar na conta.
--
--  D24 O DIA QUE RESERVOU PAGA. `painel_fila_itens_do_dia` atribuía o item ao
--      dia de `concluido_em`. Um item pego às 23h50 e fechado às 00h10 gastava
--      o headroom do dia 13 e era cobrado do dia 14: o dia 13 fechava com um
--      buraco e o dia 14 nascia devendo. A atribuição passa a ser
--      `painel_dia_operador(coalesce(pego_em, criado_em))` — o dia da RESERVA.
--      (`coalesce` porque a expiração zera `pego_em` ao devolver o item; aí o
--      dia do item é o da criação dele.)
--
--  #3 `raise` USA `%`, NÃO `%s`. `raise exception '… (este está %s).'` imprimia
--      literalmente "concluidas"/"na_filas" — o `%s` consumia o `%` e deixava o
--      `s` colado no valor. `format()` usa `%s`; `raise` usa `%`. Varredura das
--      6 migrations por `raise .*%s` deve dar 0.
--
--  #7 `ajustar_custo` CHECA `custo_e_estimativa`. O comentário dizia "só o que
--      a casa estimou pode ser corrigido" e o código nunca checou: um custo
--      MEDIDO pelo worker podia ser reescrito pela tela. Agora recusa com
--      "Só custo estimado pela casa pode ser ajustado; este foi medido."
--
--  D22/#6/#8 são de TS (a frase de cancelamento e a de ajuste renderizadas
--  pelos componentes de produção; o espelho do backoff no teste que lê ESTE
--  arquivo; o painel de ajuste virando `<form>`) — sem SQL correspondente.
-- =============================================================================

-- ── 1 · índice da ordenação do pull (D21) ───────────────────────────────────
-- O `where estado = 'na_fila'` é o predicado do índice parcial: a fila
-- histórica (concluída/falhou/cancelada) não entra nele, e a busca do pull
-- (`conta` + ordem `criado_em, id`) sai direto do índice.
create index if not exists painel_fila_prompts_na_fila_ordem_idx
  on public.painel_fila_prompts (conta, criado_em, id)
  where estado = 'na_fila';

-- ── 2 · painel_fila_itens_do_dia — o dia da RESERVA (D24) ───────────────────
create or replace function public.painel_fila_itens_do_dia(p_conta text)
returns table (id uuid, contribuicao numeric, e_estimativa boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    f.id,
    -- D10 (rodada 4, mantida): sem sessão publicada -> o custo inteiro. Com
    -- sessão publicada -> só o que o painel AINDA não viu (nunca negativo,
    -- nunca zerado por uma linha de sessão sem custo).
    case
      when ses.custo_usd is null then f.custo_usd
      else greatest(f.custo_usd - ses.custo_usd, 0)
    end as contribuicao,
    f.custo_e_estimativa
  from public.painel_fila_prompts f
  left join lateral (
    select coalesce(s.custo_usd, 0) as custo_usd
    from public.painel_frentes_sessoes s
    where f.session_id is not null
      and s.sessao_id = f.session_id
      and s.conta = f.conta
      and public.painel_dia_operador(coalesce(s.atualizado_em, s.criado_em, s.publicado_em))
          = public.painel_dia_operador()
    order by coalesce(s.custo_usd, 0) desc
    limit 1
  ) ses on true
  where f.conta = p_conta
    and f.custo_usd is not null
    and f.concluido_em is not null
    -- D24 (rodada 5): o dia é o da RESERVA (pego_em), não o do fechamento.
    -- Um item pego 23h50 e fechado 00h10 gastou o headroom do dia que o
    -- reservou; cobrá-lo do dia seguinte deixava o primeiro fechar com buraco
    -- e o segundo nascer devendo. `coalesce` com `criado_em` porque a
    -- expiração zera `pego_em` ao devolver o item para a fila.
    and public.painel_dia_operador(coalesce(f.pego_em, f.criado_em)) = public.painel_dia_operador()
    and (
      f.estado in ('concluida', 'falhou')
      -- D12 (rodada 4, mantida): cancelada que JÁ TEVE DONO gastou dinheiro.
      or (f.estado = 'cancelada' and (f.worker_id is not null or f.tentativas > 0))
    );
$$;
comment on function public.painel_fila_itens_do_dia(text) is
  'D24 (rodada 5): o dia do item é o da RESERVA — painel_dia_operador(coalesce(pego_em, criado_em)) —, não o de concluido_em: item pego 23h50 e fechado 00h10 gastou o teto do dia anterior. Mantém D10 (subtração, não exclusão) e D12 (cancelada com dono conta).';
revoke all on function public.painel_fila_itens_do_dia(text) from public, anon, authenticated;

-- ── 3 · fila_prompts_pegar_interno — elegibilidade no `where` (D21/D23) ─────
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
  v_menor_nao_coube numeric;
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
  perform 1 from public.painel_teto_diario where conta = p_conta for update;

  -- D2 (rodada 3) + D19 (rodada 4): expira por 45 min SEM SINAL; quem volta
  -- cumpre backoff de 15 min × tentativas. `mor` devolve também o custo
  -- lançado, porque D23 (rodada 5) o diz em voz alta no motivo.
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
           disponivel_em = now() + (interval '15 minutes' * greatest(f.tentativas, 1))
      from alvo a
     where f.id = a.id and a.tentativas < a.max_tentativas
    returning f.id
  ),
  mor as (
    update public.painel_fila_prompts f
       set estado = 'falhou',
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

  -- D21 (rodada 5): a elegibilidade é do `where`, não de um laço sobre uma
  -- janela. O laço com `limit 50` escondia o item elegível da posição 51 em
  -- diante — e, pior, mentia sobre ele: `menor que não coube` era o mínimo dos
  -- 50 vistos, não o da fila. Item devolvido NESTA chamada continua fora
  -- (`<> all`): quem acabou de perdê-lo não o pega de volta no mesmo fôlego.
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

  -- Os que NÃO cabem: contagem e o mais barato, sobre a fila INTEIRA (sem
  -- limite). São dois números que a Routine reporta ao operador — cada um
  -- errado por janela era uma frase falsa no relatório do disparo.
  select count(*)::int, min(f.custo_estimado_usd)
    into v_pulados, v_menor_nao_coube
    from public.painel_fila_prompts f
   where f.conta = p_conta
     and f.estado = 'na_fila'
     and f.id <> all (v_devolvidos_ids)
     and (f.disponivel_em is null or f.disponivel_em <= now())
     and f.custo_estimado_usd > v_headroom;

  if v_escolhido is null then
    -- #11 (rodada 4) + D23 (rodada 5): cada caso tem o seu nome, e o disparo
    -- que MATOU um item diz isso antes de qualquer outra coisa que não seja
    -- "nada cabe" — o item morto acabou de lançar dinheiro no dia.
    v_motivo := case
      when v_menor_nao_coube is not null then
        format('nada cabe agora: o mais barato da fila custa US$ %s e so ha US$ %s livres (medido US$ %s + em execucao US$ %s de teto US$ %s)',
          round(v_menor_nao_coube, 2), round(v_headroom, 2),
          round(v_medido, 2), round(v_execucao, 2), round(v_teto, 2))
      when v_mortos = 1 then
        format('1 item morreu sem fechar neste disparo e lançou US$ %s no dia', round(v_mortos_usd, 2))
      when v_mortos > 1 then
        format('%s itens morreram sem fechar neste disparo e lançaram US$ %s no dia',
          v_mortos, round(v_mortos_usd, 2))
      when v_devolvidos > 0 then
        format('%s item(ns) devolvido(s) para a fila, aguardando nova tentativa', v_devolvidos)
      when v_em_espera > 0 then
        format('%s item(ns) em espera de nova tentativa', v_em_espera)
      else 'fila vazia para esta conta'
    end;
    -- D20 (rodada 4): a parcela estimada é dita em voz alta, sempre que existir.
    if v_estimativa > 0 then
      v_motivo := v_motivo || format(' · US$ %s do consumo sao estimativa de %s item(ns) que morreram sem fechar',
        round(v_estimativa, 2), v_estimativa_n);
    end if;

    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
      'mortos_usd', round(v_mortos_usd, 2),
      'em_espera', v_em_espera, 'headroom_usd', round(v_headroom, 2),
      'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
      'motivo', v_motivo
    );
  end if;

  update public.painel_fila_prompts
     set estado = 'pega',
         worker_id = p_worker_id,
         pego_em = now(),
         heartbeat_em = now(),
         disponivel_em = null,
         tentativas = tentativas + 1
   where id = v_escolhido
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
    'mortos_usd', round(v_mortos_usd, 2),
    'em_espera', v_em_espera, 'headroom_usd', round(v_headroom, 2),
    'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
    'motivo', null,
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
  'D21 (rodada 5): elegibilidade no WHERE (custo_estimado_usd <= headroom, order by criado_em, id, limit 1 for update skip locked) — o item elegível da posição 51 deixou de ser invisível; pulados e o "mais barato que não coube" saem de uma consulta SEM limite, sobre a fila inteira. D23: o disparo que matou um item diz isso no motivo, com o valor lançado, em vez de "fila vazia". Mantém D1/D2/D19/D20.';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 4 · fila_prompts_ajustar_custo — `%` no raise (#3) + estimativa (#7) ────
create or replace function public.fila_prompts_ajustar_custo(
  p_secret text, p_id uuid, p_custo_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_row      public.painel_fila_prompts%rowtype;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_ajustar_custo: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_ajustar_custo: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;
  if p_custo_usd is null or p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'O custo precisa ser um número entre 0 e 500.' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts where id = p_id for update;

  if not found then
    raise exception 'Item nao encontrado: %', p_id using errcode = 'check_violation';
  end if;
  -- #3 (rodada 5): `raise` interpola com `%`, não com `%s` (isso é `format`).
  -- O `%s` consumia o `%` e deixava o `s` colado no valor: "(este está
  -- concluidas)", "(este está na_filas)".
  if v_row.estado not in ('falhou','cancelada') then
    raise exception 'Só dá para ajustar o custo de item que falhou ou foi cancelado (este está %).', v_row.estado
      using errcode = 'check_violation';
  end if;
  if v_row.concluido_em is null
     or public.painel_dia_operador(v_row.concluido_em) <> public.painel_dia_operador() then
    raise exception 'Só dá para ajustar o custo de item fechado hoje.' using errcode = 'check_violation';
  end if;
  -- #7 (rodada 5): a guarda que o comentário prometia e o código não fazia —
  -- número MEDIDO por gente não se reescreve pela tela.
  if not v_row.custo_e_estimativa then
    raise exception 'Só custo estimado pela casa pode ser ajustado; este foi medido.'
      using errcode = 'check_violation';
  end if;

  update public.painel_fila_prompts
     set custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         custo_ajustado_em = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'custo_usd', round(p_custo_usd, 2));
end;
$$;
comment on function public.fila_prompts_ajustar_custo(text, uuid, numeric) is
  'D20 (rodada 4) + #3/#7 (rodada 5): o raise usa % (não %s — imprimia "concluidas"), e só item cujo custo É ESTIMATIVA da casa pode ser ajustado ("Só custo estimado pela casa pode ser ajustado; este foi medido.").';

-- ── 5 · privilégios (mesma disciplina das rodadas anteriores) ───────────────
revoke all on function public.fila_prompts_ajustar_custo(text, uuid, numeric) from public;
grant execute on function public.fila_prompts_ajustar_custo(text, uuid, numeric) to anon, authenticated;
