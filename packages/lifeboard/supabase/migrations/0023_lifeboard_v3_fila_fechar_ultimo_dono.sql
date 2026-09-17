-- ════════════════════════════════════════════════════════════════════════════
-- 0023 · LIFEBOARD v3 · recuperada do banco — existia em produção, faltava aqui
-- ════════════════════════════════════════════════════════════════════════════
--
-- Mesma origem da 0022: aplicada em produção por colagem no SQL Editor
-- (versão 20260913224311, nome `lifeboard_v3_fila_fechar_ultimo_dono`),
-- nunca chegou ao repositório. Recuperada pelo PASSO-0c a partir da coluna
-- `statements` do histórico — texto exato, não reconstrução.
--
-- Re-aplicável: `create or replace function`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── fila_prompts_fechar_interno — o ÚLTIMO dono fecha um item morto (D26) ───
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
  v_ultimo_dono boolean;
  v_reabrir     boolean;
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
    raise exception 'Item não encontrado ou não pertence à conta informada: %', p_id
      using errcode = 'check_violation';
  end if;

  -- D26 (rodada 6): a morte tira a posse VIVA para liberar a fila, não para
  -- proibir o único ator com o número honesto de entregá-lo. `v_ultimo_dono`
  -- é quem PEGOU o item e já não o tem; ele atravessa o fencing (e por isso a
  -- SEGUNDA chamada dele cai na idempotência de D8, em vez de bater num
  -- "Item pertence a outro worker (nenhum)" — medido no bloco T06).
  -- `v_reabrir` é o subconjunto que ainda vale reescrever: item morto cujo
  -- custo é ESTIMATIVA da casa.
  v_ultimo_dono := (
    v_row.worker_id is null
    and v_row.ultimo_worker_id is not null
    and v_row.ultimo_worker_id = btrim(p_worker_id)
  );
  v_reabrir := (v_row.estado = 'falhou' and v_ultimo_dono and v_row.custo_e_estimativa);

  if v_row.estado = 'na_fila' and v_row.worker_id is null then
    raise exception 'Item voltou para a fila (45 min sem sinal) — não pode ser fechado; ele será pego de novo: %', p_id
      using errcode = 'check_violation';
  end if;

  -- D1 · fencing: só quem pegou fecha (ou, por D26, quem tinha pegado).
  if not v_ultimo_dono and v_row.worker_id is distinct from p_worker_id then
    raise exception 'Item pertence a outro worker (%): %', coalesce(v_row.worker_id, 'nenhum'), p_id
      using errcode = 'check_violation';
  end if;

  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'sessão já vinculada ao item %', v_outro using errcode = 'check_violation';
    end if;
  end if;

  if v_reabrir then
    update public.painel_fila_prompts
       set estado = p_estado,
           custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           motivo_falha = case when p_estado = 'falhou' then motivo_falha else null end,
           heartbeat_em = null,
           disponivel_em = null,
           -- D25: o dinheiro entra no dia que o RECONHECE.
           concluido_em = now()
     where id = p_id;
    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', true, 'estado', p_estado
    );
  end if;

  -- D8 (rodada 3) · idempotência.
  if v_row.estado in ('concluida','falhou') then
    return jsonb_build_object(
      'ok', true, 'ja_fechado', true, 'reaberto_e_fechado', false, 'estado', v_row.estado
    );
  end if;

  -- D12 (rodada 4): item cancelado pelo operador durante a execução — a
  -- medição real SUBSTITUI a estimativa, o estado continua `cancelada`.
  if v_row.estado = 'cancelada' then
    update public.painel_fila_prompts
       set custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           concluido_em = coalesce(concluido_em, now())
     where id = p_id;
    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', 'cancelada'
    );
  end if;

  update public.painel_fila_prompts
     set estado = p_estado,
         custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         session_id = coalesce(v_sess, session_id),
         sessao_url = coalesce(p_sessao_url, sessao_url),
         resultado = coalesce(p_resultado, resultado),
         heartbeat_em = null,
         disponivel_em = null,
         concluido_em = now()
   where id = p_id;

  return jsonb_build_object(
    'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', p_estado
  );
end;
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'D26 (rodada 6): o ÚLTIMO dono de um item morto (falhou, sem dono vivo, custo = estimativa da casa) fecha idempotentemente com o número medido — grava custo, apaga a marca de estimativa, vincula a sessão, carimba concluido_em = now() (D25) e devolve reaberto_e_fechado: true. Outro worker continua recusado pelo fencing. Mantém D8/D11/D12/D20.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;
